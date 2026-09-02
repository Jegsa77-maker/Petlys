import { isSectionFilled } from "@/lib/domain/category-requirements";

/**
 * Alerta de dado desatualizado no prontuário do pet (pendência da Onda 1,
 * seção 6.2 — item que nunca foi implementado desde a entrega original).
 * Sem coluna de timestamp por seção — usa `pets.updated_at` (mantida por
 * trigger genérico em toda alteração do pet) como aproximação: não é
 * exato por seção, mas é o sinal mais barato disponível sem migration
 * nova, e cobre a maior parte do valor (saber que "ninguém revisou isso
 * há muito tempo").
 */
export const PRONTUARIO_STALE_MONTHS = 6;

const AVG_DAYS_PER_MONTH = 30.44;

export function monthsSince(dateIso: string): number {
  const diffMs = Date.now() - new Date(dateIso).getTime();
  return diffMs / (1000 * 60 * 60 * 24 * AVG_DAYS_PER_MONTH);
}

type PetProntuarioInfo = {
  health_info?: unknown;
  behavior_info?: unknown;
  routine_info?: unknown;
  emergency_info?: unknown;
  updated_at: string;
};

/**
 * Retorna o texto do alerta, ou `null` quando não há o que avisar — seja
 * porque o prontuário nunca foi preenchido (aí o alerta certo é "complete",
 * não "revise", ver `missingProntuarioSections`), seja porque foi
 * atualizado dentro do limiar.
 */
export function prontuarioStalenessLabel(pet: PetProntuarioInfo): string | null {
  const hasContent = [pet.health_info, pet.behavior_info, pet.routine_info, pet.emergency_info].some(
    isSectionFilled
  );
  if (!hasContent) return null;

  const months = Math.floor(monthsSince(pet.updated_at));
  if (months < PRONTUARIO_STALE_MONTHS) return null;

  if (months >= 12) {
    const years = Math.floor(months / 12);
    return `Não é atualizado há mais de ${years} ${years > 1 ? "anos" : "ano"}`;
  }
  return `Não é atualizado há ${months} meses`;
}
