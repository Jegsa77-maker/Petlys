import { describe, it, expect } from "vitest";
import { occurrenceStageLabel } from "./occurrence-pipeline";

describe("occurrenceStageLabel", () => {
  it("usa o rótulo específico da categoria quando existe", () => {
    expect(occurrenceStageLabel("passeador", "checkin")).toBe("Pet recebido");
    expect(occurrenceStageLabel("hospedagem_creche", "concluido")).toBe("Entregue");
  });

  it("cai no rótulo genérico quando a categoria não tem um específico pra essa fase", () => {
    // passeador não define rótulo próprio pra "concluido" -> cai no genérico
    expect(occurrenceStageLabel("passeador", "concluido")).toBe("Concluído");
  });

  it("categoria sem nenhum mapeamento cai inteiramente no genérico", () => {
    expect(occurrenceStageLabel("veterinario_domiciliar", "checkin")).toBe("Início do atendimento");
  });

  it("status 'agendado' não tem rótulo específico nem genérico -> devolve o próprio status", () => {
    expect(occurrenceStageLabel("passeador", "agendado")).toBe("agendado");
  });
});
