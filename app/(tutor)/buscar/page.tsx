import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { Search, Star } from "lucide-react";
import type { ServiceCategory } from "@/types/database";
import { UseMyLocationButton } from "@/components/shared/use-my-location-button";
import { haversineKm } from "@/lib/geo";

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
  searchParams: Promise<{ categoria?: string; lat?: string; lng?: string }>;
}) {
  const { categoria, lat, lng } = await searchParams;
  const supabase = await createClient();

  let query = supabase
    .from("professional_services")
    .select("id, category, base_price, pricing_model, professional_id, profiles(id, full_name)")
    .eq("active", true);

  if (categoria && isServiceCategory(categoria)) {
    query = query.eq("category", categoria);
  }

  const { data: services } = await query.limit(60);

  let filteredServices = services ?? [];
  const distanceByProfessional: Record<string, number> = {};

  const userLat = lat ? Number(lat) : null;
  const userLng = lng ? Number(lng) : null;

  if (userLat !== null && userLng !== null && filteredServices.length > 0) {
    const professionalIds = [...new Set(filteredServices.map((s) => s.professional_id))];
    const { data: areas } = await supabase
      .from("professional_service_areas")
      .select("professional_id, center_lat, center_lng, radius_km")
      .in("professional_id", professionalIds);

    const withinRange = new Set<string>();
    (areas ?? []).forEach((area) => {
      const dist = haversineKm(userLat, userLng, area.center_lat, area.center_lng);
      if (dist <= area.radius_km) {
        withinRange.add(area.professional_id);
        distanceByProfessional[area.professional_id] = dist;
      }
    });

    filteredServices = filteredServices.filter((s) => withinRange.has(s.professional_id));
  }

  return (
    <main className="min-h-screen bg-offwhite px-4 py-8">
      <div className="max-w-md mx-auto">
        <h1 className="text-2xl font-bold text-teal mb-4">Buscar profissional</h1>

        <div className="mb-4">
          <UseMyLocationButton />
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
              {userLat !== null
                ? "Nenhum profissional atende sua região nessa categoria ainda."
                : "Nenhum profissional encontrado nessa categoria ainda."}
            </p>
          </div>
        ) : (
          <ul className="flex flex-col gap-3">
            {filteredServices.map((service) => {
              const dist = distanceByProfessional[service.professional_id];
              return (
                <li key={service.id}>
                  <Link
                    href={`/profissional/${service.professional_id}`}
                    className="flex items-center justify-between rounded-lg border border-gray-200 bg-white p-4 hover:border-teal transition-colors"
                  >
                    <div>
                      <p className="font-semibold text-black">
                        {service.profiles?.full_name ?? "Profissional"}
                      </p>
                      <p className="text-xs text-gray-500">{CATEGORY_LABEL[service.category]}</p>
                      {dist !== undefined && (
                        <p className="text-xs text-teal">{dist.toFixed(1)} km de você</p>
                      )}
                    </div>
                    <div className="text-right">
                      <p className="text-sm font-semibold text-teal">
                        {service.base_price ? `R$ ${service.base_price}` : "Sob consulta"}
                      </p>
                      <div className="flex items-center gap-1 justify-end text-xs text-gray-400">
                        <Star size={12} /> novo
                      </div>
                    </div>
                  </Link>
                </li>
              );
            })}
          </ul>
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
