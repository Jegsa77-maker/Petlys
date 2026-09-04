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

  it("objeto só com strings vazias (formulário enviado em branco) NÃO conta como preenchido", () => {
    // Bug real encontrado navegando o app: updatePetHealth/etc. sempre
    // gravam todas as chaves do formulário (zod atribui "" a campo opcional
    // não digitado) — a chave existir não significa que a pessoa digitou
    // algo.
    expect(isSectionFilled({ veterinario: "", clinica: "", vacinas: "" })).toBe(false);
  });

  it("checkbox marcado (true) conta como preenchido mesmo sem texto", () => {
    expect(isSectionFilled({ aceitaOutrosPets: true, observacoes: "" })).toBe(true);
  });
});

describe("missingProntuarioSections", () => {
  const petVazio = { health_info: {}, behavior_info: {}, routine_info: {}, emergency_info: {} };
  const petCompleto = {
    health_info: { a: "preenchido" },
    behavior_info: { a: "preenchido" },
    routine_info: { a: "preenchido" },
    emergency_info: { a: "preenchido" },
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
