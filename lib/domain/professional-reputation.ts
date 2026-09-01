/**
 * Selos e níveis de carreira do Profissional (seção 6.3 — "selos, níveis,
 * indicador de completude e pré-visualização"). Cálculo simples e
 * explicável a partir de dois sinais que já existem no banco: quantidade de
 * atendimentos concluídos e média das avaliações recebidas. Não pune
 * recusa nem novos profissionais (seção 6.3: "ranking... sem punir recusa e
 * com exposição para novos Profissionais") — por isso o nível mínimo nunca
 * é negativo, só "Novo no Petlys".
 */
export type ProfessionalLevel = "novo" | "experiente" | "top";

export const PROFESSIONAL_LEVEL_LABEL: Record<ProfessionalLevel, string> = {
  novo: "Novo no Petlys",
  experiente: "Profissional experiente",
  top: "Top Petlys",
};

export function computeProfessionalLevel(
  completedCount: number,
  avgRating: number | null
): ProfessionalLevel {
  if (completedCount >= 15 && avgRating !== null && avgRating >= 4.5) {
    return "top";
  }
  if (completedCount >= 3 && (avgRating === null || avgRating >= 4)) {
    return "experiente";
  }
  return "novo";
}

/**
 * `reviews.rating` é um jsonb com critérios múltiplos, ex.:
 * {"qualidade":5,"comunicacao":5} (ver 0007_safety_and_reputation.sql) —
 * a média agrega todos os critérios de todas as avaliações recebidas.
 */
export function averageRating(reviews: { rating: unknown }[]): number | null {
  const values: number[] = [];
  for (const review of reviews) {
    if (review.rating && typeof review.rating === "object") {
      for (const value of Object.values(review.rating as Record<string, unknown>)) {
        if (typeof value === "number") values.push(value);
      }
    }
  }
  if (values.length === 0) return null;
  return values.reduce((sum, v) => sum + v, 0) / values.length;
}
