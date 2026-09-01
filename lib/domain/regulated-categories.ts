import type { ServiceCategory } from "@/types/database";

/**
 * Categorias que exigem habilitação/documento verificado antes de o
 * Profissional poder publicar um serviço nelas (seção 6.3 — "habilitações e
 * documentos exigidos por atividade regulamentada"). Hoje só veterinário
 * domiciliar — decisão de produto sujeita a revisão jurídica (seção 7 do
 * plano 100%: "atividades regulamentadas e documentos exigidos" está listada
 * como decisão pendente, não fato consolidado).
 */
export const REGULATED_CATEGORIES: ServiceCategory[] = ["veterinario_domiciliar"];

export function categoryRequiresCertification(category: ServiceCategory): boolean {
  return REGULATED_CATEGORIES.includes(category);
}
