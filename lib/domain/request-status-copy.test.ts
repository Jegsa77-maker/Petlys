import { describe, it, expect } from "vitest";
import { nextActionCopy } from "./request-status-copy";

describe("nextActionCopy", () => {
  it("devolve a frase certa por status e papel de quem olha", () => {
    expect(nextActionCopy("solicitacao_enviada", "tutor")).toBe(
      "Aguardando o profissional responder."
    );
    expect(nextActionCopy("solicitacao_enviada", "profissional")).toBe(
      "Nova solicitação — dê uma olhada e responda."
    );
  });

  it("staff tem frase própria, diferente das partes", () => {
    const staff = nextActionCopy("proposta_enviada", "staff");
    const tutor = nextActionCopy("proposta_enviada", "tutor");
    expect(staff).not.toBe(tutor);
    expect(staff).not.toBeNull();
  });

  it("status desconhecido devolve null (sem erro)", () => {
    expect(nextActionCopy("status_que_nao_existe", "tutor")).toBeNull();
  });

  it("todo RequestStatus mapeado tem as 3 visões preenchidas (tutor/profissional/staff)", () => {
    const statuses = [
      "solicitacao_enviada", "em_conversa", "proposta_enviada", "aguardando_pagamento",
      "confirmado", "checkin", "em_andamento", "finalizacao", "concluido", "avaliacao",
      "recusado", "expirado", "cancelado", "incidente", "em_disputa",
    ] as const;
    for (const status of statuses) {
      for (const role of ["tutor", "profissional", "staff"] as const) {
        expect(nextActionCopy(status, role), `${status}/${role}`).not.toBeNull();
      }
    }
  });
});
