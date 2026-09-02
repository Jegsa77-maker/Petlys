import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { Heart } from "lucide-react";
import type { ServiceCategory } from "@/types/database";
import { FavoriteButton } from "@/components/search/favorite-button";
import { averageRating } from "@/lib/domain/professional-reputation";

const CATEGORY_LABEL: Record<ServiceCategory, string> = {
  pet_sitter: "Pet sitter / cuidador",
  passeador: "Passeador de cães",
  hospedagem_creche: "Hospedagem / creche",
  adestrador: "Adestrador / comportamentalista",
  banho_tosa: "Banho e tosa",
  veterinario_domiciliar: "Veterinário domiciliar",
};

/**
 * Tela dedicada de favoritos (Onda 2, item adiado no BACKLOG.md — baixo
 * esforço porque reaproveita tudo que `/buscar?favoritos=1` já resolve:
 * a tabela `tutor_favorites`, o `FavoriteButton` e o cálculo de nota
 * média. A diferença é o recorte: aqui é por profissional favoritado,
 * não por serviço publicado, então cada profissional aparece uma única
 * vez mesmo que tenha vários serviços ativos.
 */
export default async function FavoritosPage() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return (
      <main className="min-h-screen bg-offwhite px-4 py-8">
        <div className="max-w-md mx-auto text-center py-16 text-gray-500">
          <p className="text-sm">Entre na sua conta para ver seus favoritos.</p>
        </div>
      </main>
    );
  }

  const { data: favoriteRows } = await supabase
    .from("tutor_favorites")
    .select("professional_id")
    .eq("tutor_profile_id", user.id)
    .order("created_at", { ascending: false });

  const professionalIds = (favoriteRows ?? []).map((f) => f.professional_id);

  if (professionalIds.length === 0) {
    return (
      <main className="min-h-screen bg-offwhite px-4 py-8">
        <div className="max-w-md mx-auto">
          <h1 className="text-2xl font-bold text-teal mb-4">Favoritos</h1>
          <div className="text-center py-16 text-gray-500">
            <Heart size={40} className="mx-auto mb-3 text-gray-300" />
            <p className="text-sm">
              Você ainda não favoritou nenhum profissional. Toque no coração de um
              card na{" "}
              <Link href="/buscar" className="text-teal font-semibold hover:underline">
                busca
              </Link>{" "}
              para guardá-lo aqui.
            </p>
          </div>
        </div>
      </main>
    );
  }

  const [{ data: profiles }, { data: services }, { data: reviews }] = await Promise.all([
    supabase.from("profiles").select("id, full_name").in("id", professionalIds),
    supabase
      .from("professional_services")
      .select("professional_id, category, subcategory, base_price")
      .eq("active", true)
      .in("professional_id", professionalIds),
    supabase
      .from("reviews")
      .select("reviewee_id, rating")
      .in("reviewee_id", professionalIds)
      .is("hidden_at", null),
  ]);

  const nameById = new Map((profiles ?? []).map((p) => [p.id, p.full_name]));

  // Um profissional favoritado pode ter vários serviços ativos — mostramos
  // só o primeiro como referência de categoria/preço, igual a um resumo de
  // card, não a listagem completa (essa fica no perfil dele).
  const primaryServiceByProfessional = new Map<
    string,
    { category: ServiceCategory; subcategory: string | null; base_price: number | null }
  >();
  (services ?? []).forEach((s) => {
    if (!primaryServiceByProfessional.has(s.professional_id)) {
      primaryServiceByProfessional.set(s.professional_id, s);
    }
  });

  const reviewsByProfessional = new Map<string, { rating: unknown }[]>();
  (reviews ?? []).forEach((r) => {
    const list = reviewsByProfessional.get(r.reviewee_id) ?? [];
    list.push({ rating: r.rating });
    reviewsByProfessional.set(r.reviewee_id, list);
  });

  return (
    <main className="min-h-screen bg-offwhite px-4 py-8">
      <div className="max-w-md mx-auto">
        <h1 className="text-2xl font-bold text-teal mb-4">Favoritos</h1>

        <ul className="flex flex-col gap-3">
          {professionalIds.map((professionalId) => {
            const service = primaryServiceByProfessional.get(professionalId);
            const reviewList = reviewsByProfessional.get(professionalId) ?? [];
            const avg = averageRating(reviewList);

            return (
              <li key={professionalId}>
                <Link
                  href={`/profissional/${professionalId}`}
                  className="flex items-center justify-between rounded-lg border border-gray-200 bg-white p-4 hover:border-teal transition-colors"
                >
                  <div>
                    <p className="font-semibold text-black">
                      {nameById.get(professionalId) ?? "Profissional"}
                    </p>
                    <p className="text-xs text-gray-500">
                      {service
                        ? `${CATEGORY_LABEL[service.category]}${service.subcategory ? ` · ${service.subcategory}` : ""}`
                        : "Nenhum serviço ativo no momento"}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    {service?.base_price && (
                      <p className="text-sm font-semibold text-teal text-right">
                        <span className="block text-[10px] font-normal text-gray-400 leading-none">
                          a partir de
                        </span>
                        R$ {service.base_price}
                      </p>
                    )}
                    <FavoriteButton professionalId={professionalId} initialFavorited={true} />
                  </div>
                </Link>
                {avg !== null && (
                  <p className="text-xs text-gray-400 mt-1 pl-1">★ {avg.toFixed(1)} ({reviewList.length})</p>
                )}
              </li>
            );
          })}
        </ul>
      </div>
    </main>
  );
}
