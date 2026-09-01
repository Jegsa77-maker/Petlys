import type { ServiceCategory } from "@/types/database";

/**
 * Requisitos dinâmicos do prontuário por categoria de serviço (seção 6.4 —
 * "perguntas e anexos específicos por categoria"). Cada categoria exige que
 * determinadas seções do prontuário do pet (etapas 2–5, ver
 * lib/validations/pets.ts) estejam preenchidas antes de o Tutor conseguir
 * enviar uma solicitação — ex.: um passeador precisa saber se o pet foge ou
 * puxa a guia; um pet sitter/hospedagem precisa da rotina completa.
 *
 * Isto é intencionalmente uma lista curta e explícita, não configurável
 * pelo Admin ainda — a versão "catálogo administrável" (seção 6.3/6.5) fica
 * para uma próxima história.
 */
export type ProntuarioSection = "health" | "behavior" | "routine" | "emergency";

export const CATEGORY_REQUIRED_SECTIONS: Record<ServiceCategory, ProntuarioSection[]> = {
  pet_sitter: ["health", "routine", "emergency"],
  passeador: ["behavior", "emergency"],
  hospedagem_creche: ["health", "routine", "emergency"],
  adestrador: ["behavior"],
  banho_tosa: ["health"],
  veterinario_domiciliar: ["health"],
};

export const PRONTUARIO_SECTION_LABEL: Record<ProntuarioSection, string> = {
  health: "Saúde",
  behavior: "Comportamento",
  routine: "Rotina e cuidados",
  emergency: "Emergência e autorizações",
};

type PetProntuarioInfo = {
  health_info?: unknown;
  behavior_info?: unknown;
  routine_info?: unknown;
  emergency_info?: unknown;
};

function isSectionFilled(info: unknown): boolean {
  return !!info && typeof info === "object" && Object.keys(info as object).length > 0;
}

/**
 * Retorna as seções do prontuário exigidas pela categoria que ainda estão
 * vazias para este pet — vazio se está tudo completo.
 */
export function missingProntuarioSections(
  pet: PetProntuarioInfo,
  category: ServiceCategory
): ProntuarioSection[] {
  const sectionField: Record<ProntuarioSection, unknown> = {
    health: pet.health_info,
    behavior: pet.behavior_info,
    routine: pet.routine_info,
    emergency: pet.emergency_info,
  };
  const required = CATEGORY_REQUIRED_SECTIONS[category] ?? [];
  return required.filter((section) => !isSectionFilled(sectionField[section]));
}
