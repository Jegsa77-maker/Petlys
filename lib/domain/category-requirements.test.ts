import { describe, it, expect } from "vitest";
import {
  missingProntuarioSections,
  isSectionFilled,
  CATEGORY_REQUIRED_SECTIONS,
} from "./category-requirements";

describe("isSectionFilled", () => {
  it("vazio, null ou {} conta como não preenchido", () => {
    expect(isSectionFilled(null)).toBe(false);
    expect(isSectionFilled(undefined)).toBe(false);
    expect(isSectionFilled({})).toBe(false);
  });

  it("objeto com pelo menos uma chave conta como preenchido", () => {
    expect(isSectionFilled({ alergias: "nenhuma" })).toBe(true);
  });

  it("não é objeto (string/número) conta como não preenchido", () => {
    expect(isSectionFilled("texto")).toBe(false);
    expect(isSectionFilled(42)).toBe(false);
  });
});

describe("missingProntuarioSections", () => {
  const petVazio = { health_info: {}, behavior_info: {}, routine_info: {}, emergency_info: {} };
  const petCompleto = {
    health_info: { a: 1 },
    behavior_info: { a: 1 },
    routine_info: { a: 1 },
    emergency_info: { a: 1 },
  };

  it("pet sem nada preenchido falta tudo que a categoria exige", () => {
    // passeador exige behavior + emergency (default de fábrica)
    expect(missingProntuarioSections(petVazio, "passeador")).toEqual(["behavior", "emergency"]);
  });

  it("pet com tudo preenchido não falta nada", () => {
    expect(missingProntuarioSections(petCompleto, "passeador")).toEqual([]);
  });

  it("respeita mapa de requisitos customizado (admin) em vez do default", () => {
    const customRequirements = { ...CATEGORY_REQUIRED_SECTIONS, banho_tosa: ["behavior" as const] };
    // default de banho_tosa é só "health" — com override, passa a exigir "behavior"
    expect(missingProntuarioSections(petVazio, "banho_tosa")).toEqual(["health"]);
    expect(missingProntuarioSections(petVazio, "banho_tosa", customRequirements)).toEqual(["behavior"]);
  });

  it("categoria sem seção exigida nenhuma nunca bloqueia", () => {
    // hospedagem_creche não está no mapa customizado abaixo -> cai em []
    const semExigencia = { ...CATEGORY_REQUIRED_SECTIONS, veterinario_domiciliar: [] };
    expect(missingProntuarioSections(petVazio, "veterinario_domiciliar", semExigencia)).toEqual([]);
  });
});
