import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { Search, Star } from "lucide-react";
import type { ServiceCategory } from "@/types/database";
import { UseMyLocationButton } from "@/components/shared/use-my-location-button";
import { SearchFiltersForm } from "@/components/search/search-filters-form";
import { FavoriteButton } from "@/components/search/favorite-button";
import { SearchViewToggle } from "@/components/search/search-view-toggle";
import type { MapPin } from "@/components/search/results-map";
import { haversineKm } from "@/lib/geo";
import { averageRating } from "@/lib/domain/professional-reputation";
import { trackEventServer } from "@/lib/analytics/track-server";

const CATEGORY_LABEL: Record<ServiceCategory, string> = {
  pet_sitter: "Pet sitter / cuidador",
  passeador: "Passeador de cães",
  hospedagem_creche: "Hospedagem / creche",
  adestrador: "Adestrador / comportamentalista",
  banho_tosa: "Banho e tosa",
  veterinario_domiciliar: "Veterinário domiciliar",
};

const VALID_CATEGORIES = Object.keys(CATEGORY_LABEL) as ServiceCategory[];

function isServiceCategory(value: string): value is ServiceCategory {
  return (VALID_CATEGORIES as string[]).includes(value);
}

export default async function BuscarPage({
  searchParams,
}: {
  searchParams: Promise<{
    categoria?: string;
    lat?: string;
    lng?: string;
    precoMin?: string;
    precoMax?: string;
    notaMin?: string;
    subcategoria?: string;
    especie?: string;
    favoritos?: string;
  }>;
}) {
  const { categoria, lat, lng, precoMin, precoMax, notaMin, subcategoria, especie, favoritos } =
    await searchParams;
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  let query = supabase
    .from("professional_services")
    .select(
      "id, category, subcategory, base_price, pricing_model, professional_id, species_accepted"
    )
    .eq("active", true);

  if (categoria && isServiceCategory(categoria)) {
    query = query.eq("category", categoria);
  }
  if (subcategoria) {
    query = query.eq("subcategory", subcategoria);
  }
  if (precoMin) {
    query = query.gte("base_price", Number(precoMin));
  }
  if (precoMax) {
    query = query.lte("base_price", Number(precoMax));
  }
  if (especie) {
    // Vazio em species_accepted = atende qualquer espécie (seção 12.1).
    query = query.or(`species_accepted.cs.{${especie}},species_accepted.eq.{}`);
  }

  const { data: services } = await query.limit(60);

  // Evento agregado por busca (não por card individual — impressão por
  // card exigiria converter a lista pra client component com
  // IntersectionObserver, fora de escopo por enquanto). Alimenta o KPI
  // de funil "busca -> perfil".
  void trackEventServer("search_result_view", {
    profile_id: user?.id,
    category: categoria && isServiceCategory(categoria) ? categoria : undefined,
    metadata: { result_count: services?.length ?? 0 },
  });

  let filteredServices = services ?? [];
  const distanceByProfessional: Record<string, number> = {};
  // Área de atendimento de cada profissional (lat/lng do centro) — buscada
  // sempre que há resultado, não só quando o Tutor compartilha localização,
  // porque o mapa visual (item 2 da Onda 2) precisa dos pins mesmo sem
  // filtro de distância ativo.
  const areaByProfessional = new Map<string, { lat: number; lng: number }>();

  const userLat = lat ? Number(lat) : null;
  const userLng = lng ? Number(lng) : null;

  if (filteredServices.length > 0) {
    const professionalIds = [...new Set(filteredServices.map((s) => s.professional_id))];
    const { data: areas } = await supabase
      .from("professional_service_areas")
      .select("professional_id, center_lat, center_lng, radius_km")
      .in("professional_id", professionalIds);

    (areas ?? []).forEach((area) => {
      // Um profissional pode ter mais de uma área cadastrada — fica só a
      // primeira como referência do pin, igual ao critério de "serviço
      // principal" já usado na tela de favoritos.
      if (!areaByProfessional.has(area.professional_id)) {
        areaByProfessional.set(area.professional_id, { lat: area.center_lat, lng: area.center_lng });
      }
    });

    if (userLat !== null && userLng !== null) {
      const withinRange = new Set<string>();
      (areas ?? []).forEach((area) => {
        const dist = haversineKm(userLat, userLng, area.center_lat, area.center_lng);
        // radius_km null = profissional marcou "sem restrição" — sempre
        // dentro do raio, independente da distância.
        if (area.radius_km === null || dist <= area.radius_km) {
          withinRange.add(area.professional_id);
          distanceByProfessional[area.professional_id] = dist;
        }
      });

      filteredServices = filteredServices.filter((s) => withinRange.has(s.professional_id));
    }
  }

  // Nota média agregada (seção 12.3, item 5 da Onda 4) — buscada sempre
  // que há resultado, não só quando o filtro de nota mínima está ativo:
  // antes disso, todo card na busca mostrava "novo" fixo no lugar da nota
  // de verdade, mesmo profissionais com dezenas de avaliações 5 estrelas.
  const ratingByProfessional = new Map<string, { avg: number | null; count: number }>();
  if (filteredServices.length > 0) {
    const professionalIds = [...new Set(filteredServices.map((s) => s.professional_id))];
    const { data: reviews } = await supabase
      .from("reviews")
      .select("reviewee_id, rating")
      .in("reviewee_id", professionalIds)
      .is("hidden_at", null);

    const reviewsByProfessional = new Map<string, { rating: unknown }[]>();
    (reviews ?? []).forEach((r) => {
      const list = reviewsByProfessional.get(r.reviewee_id) ?? [];
      list.push({ rating: r.rating });
      reviewsByProfessional.set(r.reviewee_id, list);
    });

    professionalIds.forEach((id) => {
      const list = reviewsByProfessional.get(id) ?? [];
      ratingByProfessional.set(id, { avg: averageRating(list), count: list.length });
    });

    if (notaMin) {
      const minRating = Number(notaMin);
      filteredServices = filteredServices.filter((s) => {
        const avg = ratingByProfessional.get(s.professional_id)?.avg ?? null;
        return avg !== null && avg >= minRating;
      });
    }
  }

  // Favoritos do Tutor logado (seção 12.1) — precisa vir antes do filtro
  // "somente favoritos" e também alimenta o coração preenchido/vazio de
  // cada card.
  let favoriteProfessionalIds = new Set<string>();
  if (user) {
    const { data: favoriteRows } = await supabase
      .from("tutor_favorites")
      .select("professional_id")
      .eq("tutor_profile_id", user.id);
    favoriteProfessionalIds = new Set((favoriteRows ?? []).map((f) => f.professional_id));
  }

  if (favoritos === "1") {
    filteredServices = filteredServices.filter((s) => favoriteProfessionalIds.has(s.professional_id));
  }

  // Nome de cada profissional via RPC estreito (0073) em vez do embed
  // `profiles(id, full_name)` que existia aqui antes — o embed dependia da
  // policy pública de profiles, removida por vazar a linha inteira (ver
  // migration). Todo professional_id já vem de um serviço ativo, então
  // bate exatamente com o filtro do RPC.
  const nameByProfessional = new Map<string, string>();
  if (filteredServices.length > 0) {
    const professionalIdsForNames = [...new Set(filteredServices.map((s) => s.professional_id))];
    const { data: names } = await supabase.rpc("get_public_professional_names", {
      p_professional_ids: professionalIdsForNames,
    });
    (names ?? []).forEach((n) => nameByProfessional.set(n.id, n.full_name));
  }

  // Um card por profissional+categoria, não por serviço — um profissional
  // com vários serviços na mesma categoria (ex.: "banho" e "tosa" dentro de
  // banho_tosa) aparecia repetido na busca. Fica o de menor preço, que é o
  // que a etiqueta "a partir de" do card já promete.
  const bestServiceByProfessionalCategory = new Map<string, (typeof filteredServices)[number]>();
  filteredServices.forEach((service) => {
    const key = `${service.professional_id}:${service.category}`;
    const current = bestServiceByProfessionalCategory.get(key);
    if (!current) {
      bestServiceByProfessionalCategory.set(key, service);
      return;
    }
    if (current.base_price === null && service.base_price !== null) {
      bestServiceByProfessionalCategory.set(key, service);
    } else if (
      current.base_price !== null &&
      service.base_price !== null &&
      service.base_price < current.base_price
    ) {
      bestServiceByProfessionalCategory.set(key, service);
    }
  });
  filteredServices = [...bestServiceByProfessionalCategory.values()];

  // Mais próximos primeiro quando o Tutor compartilhou localização — sem
  // isso a ordem era a que o Postgres decidisse devolver, sem garantia
  // nenhuma de proximidade (item encontrado navegando o app).
  if (userLat !== null && userLng !== null) {
    filteredServices = [...filteredServices].sort((a, b) => {
      const distA = distanceByProfessional[a.professional_id] ?? Infinity;
      const distB = distanceByProfessional[b.professional_id] ?? Infinity;
      return distA - distB;
    });
  }

  // Um pin por profissional (não por serviço) — mesmo critério de
  // deduplicação da tela de favoritos.
  const pins: MapPin[] = [];
  const seenInMap = new Set<string>();
  filteredServices.forEach((service) => {
    if (seenInMap.has(service.professional_id)) return;
    const area = areaByProfessional.get(service.professional_id);
    if (!area) return;
    seenInMap.add(service.professional_id);
    pins.push({
      professionalId: service.professional_id,
      name: nameByProfessional.get(service.professional_id) ?? "Profissional",
      categoryLabel: `${CATEGORY_LABEL[service.category]}${service.subcategory ? ` · ${service.subcategory}` : ""}`,
      basePrice: service.base_price,
      lat: area.lat,
      lng: area.lng,
    });
  });
  const userLocation: [number, number] | null = userLat !== null && userLng !== null ? [userLat, userLng] : null;

  return (
    <main className="min-h-screen bg-offwhite px-4 py-8">
      <div className="max-w-md mx-auto">
        <div className="flex items-center justify-between mb-4">
          <h1 className="text-2xl font-bold text-teal">Buscar profissional</h1>
          {user && (
            <Link href="/favoritos" className="text-xs font-semibold text-teal hover:underline">
              Ver favoritos
            </Link>
          )}
        </div>

        <div className="mb-4 flex flex-wrap gap-2 items-center">
          <UseMyLocationButton />
          <SearchFiltersForm isTutorLoggedIn={!!user} />
        </div>

        <div className="flex flex-wrap gap-2 mb-6">
          <CategoryChip href="/buscar" label="Todos" active={!categoria} />
          {Object.entries(CATEGORY_LABEL).map(([value, label]) => (
            <CategoryChip
              key={value}
              href={`/buscar?categoria=${value}`}
              label={label}
              active={categoria === value}
            />
          ))}
        </div>

        {filteredServices.length === 0 ? (
          <div className="text-center py-16 text-gray-500">
            <Search size={40} className="mx-auto mb-3 text-gray-300" />
            <p className="text-sm">
              {favoritos === "1"
                ? "Você ainda não favoritou nenhum profissional nessa busca."
                : userLat !== null
                  ? "Nenhum profissional atende sua região com esses filtros ainda."
                  : "Nenhum profissional encontrado com esses filtros ainda."}
            </p>
          </div>
        ) : (
          <SearchViewToggle pins={pins} userLocation={userLocation} list={
          <ul className="flex flex-col gap-3">
            {filteredServices.map((service) => {
              const dist = distanceByProfessional[service.professional_id];
              const rating = ratingByProfessional.get(service.professional_id);
              return (
                <li key={service.id}>
                  <Link
                    href={`/profissional/${service.professional_id}`}
                    className="flex items-center justify-between rounded-lg border border-gray-200 bg-white p-4 hover:border-teal transition-colors"
                  >
                    <div>
                      <p className="font-semibold text-black">
                        {nameByProfessional.get(service.professional_id) ?? "Profissional"}
                      </p>
                      <p className="text-xs text-gray-500">
                        {CATEGORY_LABEL[service.category]}
                        {service.subcategory ? ` · ${service.subcategory}` : ""}
                      </p>
                      {dist !== undefined && (
                        <p className="text-xs text-teal">{dist.toFixed(1)} km de você</p>
                      )}
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="text-right">
                        <p className="text-sm font-semibold text-teal">
                          {service.base_price ? (
                            <>
                              <span className="block text-[10px] font-normal text-gray-400 leading-none">
                                a partir de
                              </span>
                              R$ {service.base_price}
                            </>
                          ) : (
                            "Sob consulta"
                          )}
                        </p>
                        <div className="flex items-center gap-1 justify-end text-xs text-gray-400">
                          <Star size={12} className={rating?.avg ? "text-teal fill-teal" : ""} />
                          {rating?.avg ? (
                            <span className="text-teal font-semibold">
                              {rating.avg.toFixed(1)} ({rating.count})
                            </span>
                          ) : (
                            "novo"
                          )}
                        </div>
                      </div>
                      {user && (
                        <FavoriteButton
                          professionalId={service.professional_id}
                          initialFavorited={favoriteProfessionalIds.has(service.professional_id)}
                        />
                      )}
                    </div>
                  </Link>
                </li>
              );
            })}
          </ul>
          } />
        )}
      </div>
    </main>
  );
}

function CategoryChip({ href, label, active }: { href: string; label: string; active: boolean }) {
  return (
    <Link
      href={href}
      className={`rounded-full border px-3 py-1.5 text-xs font-medium transition-colors
        ${active ? "border-teal bg-teal text-white" : "border-gray-300 text-gray-600"}`}
    >
      {label}
    </Link>
  );
}
