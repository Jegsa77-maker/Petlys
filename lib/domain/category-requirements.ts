import type { ServiceCategory } from "@/types/database";

/**
 * Requisitos dinâmicos do prontuário por categoria de serviço (seção 6.4 —
 * "perguntas e anexos específicos por categoria"). Cada categoria exige que
 * determinadas seções do prontuário do pet (etapas 2–5, ver
 * lib/validations/pets.ts) estejam preenchidas antes de o Tutor conseguir
 * enviar uma solicitação — ex.: um passeador precisa saber se o pet foge ou
 * puxa a guia; um pet sitter/hospedagem precisa da rotina completa.
 *
 * Serve como *default* de fábrica — desde a pendência resolvida em
 * 2026-09-01, o Admin pode sobrescrever isso por categoria em
 * `/admin/parametros` (`components/admin/prontuario-requirements-manager.tsx`,
 * linhas de `platform_parameters` com `chave1='requisitos_prontuario'`).
 * Ver `lib/domain/category-requirements-store.ts` para a versão que lê o
 * banco — esta constante continua sendo o fallback usado quando o Admin
 * nunca configurou nada pra uma categoria (nunca fica "sem exigência
 * nenhuma" por ausência de configuração).
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

/**
 * Uma seção "preenchida" precisa ter pelo menos um valor de verdade — não
 * basta a chave existir. `updatePetHealth`/etc. (lib/actions/pets.ts) sempre
 * gravam todas as chaves do formulário, vazias ou não (zod atribui `""` a
 * todo campo opcional não digitado), então `Object.keys(...).length > 0`
 * sozinho dava "preenchido" pra um pet sem nada digitado — bug real
 * encontrado navegando o app.
 */
export function isSectionFilled(info: unknown): boolean {
  if (!info || typeof info !== "object") return false;
  return Object.values(info as Record<string, unknown>).some(
    (value) => (typeof value === "string" && value.trim() !== "") || value === true
  );
}

/**
 * Retorna as seções do prontuário exigidas pela categoria que ainda estão
 * vazias para este pet — vazio se está tudo completo.
 */
export function missingProntuarioSections(
  pet: PetProntuarioInfo,
  category: ServiceCategory,
  requiredSections: Record<ServiceCategory, ProntuarioSection[]> = CATEGORY_REQUIRED_SECTIONS
): ProntuarioSection[] {
  const sectionField: Record<ProntuarioSection, unknown> = {
    health: pet.health_info,
    behavior: pet.behavior_info,
    routine: pet.routine_info,
    emergency: pet.emergency_info,
  };
  const required = requiredSections[category] ?? [];
  return required.filter((section) => !isSectionFilled(sectionField[section]));
}
