import { describe, it, expect } from "vitest";
import { prontuarioStalenessLabel, monthsSince, PRONTUARIO_STALE_MONTHS } from "./pet-prontuario-freshness";

function monthsAgoIso(months: number): string {
  const d = new Date();
  d.setMonth(d.getMonth() - months);
  return d.toISOString();
}

describe("monthsSince", () => {
  it("data de agora dá ~0 meses", () => {
    expect(monthsSince(new Date().toISOString())).toBeLessThan(0.1);
  });
});

describe("prontuarioStalenessLabel", () => {
  const petVazio = {
    health_info: {},
    behavior_info: {},
    routine_info: {},
    emergency_info: {},
    updated_at: monthsAgoIso(20),
  };

  it("nunca alerta prontuário vazio, mesmo muito antigo — é caso de 'complete', não 'revise'", () => {
    expect(prontuarioStalenessLabel(petVazio)).toBeNull();
  });

  it("não alerta prontuário preenchido e recente (dentro do limiar)", () => {
    const petRecente = {
      health_info: { a: "preenchido" },
      behavior_info: {},
      routine_info: {},
      emergency_info: {},
      updated_at: monthsAgoIso(PRONTUARIO_STALE_MONTHS - 1),
    };
    expect(prontuarioStalenessLabel(petRecente)).toBeNull();
  });

  it("alerta prontuário preenchido e velho, em meses", () => {
    const petVelho = {
      health_info: { a: "preenchido" },
      behavior_info: {},
      routine_info: {},
      emergency_info: {},
      updated_at: monthsAgoIso(8),
    };
    const label = prontuarioStalenessLabel(petVelho);
    expect(label).toContain("meses");
    expect(label).not.toContain("ano");
  });

  it("alerta em anos quando passa de 12 meses", () => {
    const petMuitoVelho = {
      health_info: { a: "preenchido" },
      behavior_info: {},
      routine_info: {},
      emergency_info: {},
      updated_at: monthsAgoIso(20),
    };
    const label = prontuarioStalenessLabel(petMuitoVelho);
    expect(label).toContain("ano");
  });
});
