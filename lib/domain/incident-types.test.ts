import { describe, it, expect } from "vitest";
import { incidentTypeLabel, defaultUrgencyForType, INCIDENT_TYPE_OPTIONS } from "./incident-types";

describe("incidentTypeLabel", () => {
  it("devolve o rótulo cadastrado pra tipo conhecido", () => {
    expect(incidentTypeLabel("emergencia_medica")).toBe("Emergência médica");
  });

  it("tipo legado (texto livre de seed antigo) só tira o underscore, não mostra vazio", () => {
    // achado da auditoria de CX: incidentes de antes da lista fixa existir
    expect(incidentTypeLabel("pet_machucado")).toBe("pet machucado");
  });

  it("tipo sem underscore nenhum devolve como está", () => {
    expect(incidentTypeLabel("outro")).toBe("Outro"); // esse é conhecido, tem rótulo próprio
  });
});

describe("defaultUrgencyForType", () => {
  it("agressão e emergência médica são urgência máxima", () => {
    expect(defaultUrgencyForType("agressao_comportamento_perigoso")).toBe("emergencia");
    expect(defaultUrgencyForType("emergencia_medica")).toBe("emergencia");
  });

  it("tipo desconhecido cai em urgência média (nunca crasha, nunca vira urgência máxima por engano)", () => {
    expect(defaultUrgencyForType("tipo_inventado_no_teste")).toBe("media");
  });

  it("toda opção declarada tem uma urgência válida atribuída", () => {
    for (const opt of INCIDENT_TYPE_OPTIONS) {
      expect(defaultUrgencyForType(opt.value)).toBe(opt.defaultUrgency);
    }
  });
});
