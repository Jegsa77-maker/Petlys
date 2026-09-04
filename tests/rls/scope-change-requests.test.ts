import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { provisionTestUser, cleanupTestUser, serviceClient, type TestUser } from "./helpers";

/**
 * Mudança de escopo pós-acordo (itens 23/24) — bidirecional, nunca mexe em
 * requests.status. Só a CONTRAPARTE de quem propôs pode responder (mesmo
 * padrão de 0022_fix_proposals_accept_rls.sql).
 */
describe("RLS — scope_change_requests (mudança de escopo pós-acordo)", () => {
  let tutor: TestUser;
  let profissional: TestUser;
  let terceiro: TestUser;
  let requestId: string;

  beforeAll(async () => {
    tutor = await provisionTestUser(["tutor"], "scope-tutor");
    profissional = await provisionTestUser(["profissional"], "scope-prof");
    terceiro = await provisionTestUser(["tutor"], "scope-terceiro");

    const admin = serviceClient();
    const { data: request, error } = await admin
      .from("requests")
      .insert({
        tutor_id: tutor.id,
        professional_id: profissional.id,
        category: "passeador",
        status: "confirmado",
      })
      .select("id")
      .single();
    if (error || !request) throw new Error(`fixture de request falhou: ${error?.message}`);
    requestId = request.id;
  }, 30_000);

  afterAll(async () => {
    const admin = serviceClient();
    await admin.from("scope_change_requests").delete().eq("request_id", requestId);
    await admin.from("requests").delete().eq("id", requestId);
    await cleanupTestUser(tutor.id);
    await cleanupTestUser(profissional.id);
    await cleanupTestUser(terceiro.id);
  });

  let scopeChangeId: string;

  it("qualquer parte insere proposta de mudança", async () => {
    const { data, error } = await tutor.client
      .from("scope_change_requests")
      .insert({
        request_id: requestId,
        proposed_by: tutor.id,
        field_changed: "data",
        old_value: "2026-01-01T10:00:00Z",
        new_value: "2026-01-02T10:00:00Z",
      })
      .select("id")
      .single();
    expect(error).toBeNull();
    scopeChangeId = data!.id;
  });

  it("quem não é parte não consegue inserir", async () => {
    const { error } = await terceiro.client.from("scope_change_requests").insert({
      request_id: requestId,
      proposed_by: terceiro.id,
      field_changed: "valor",
      old_value: "100",
      new_value: "50",
    });
    expect(error).not.toBeNull();
  });

  it("quem propôs não consegue responder à própria proposta", async () => {
    const { error, data } = await tutor.client
      .from("scope_change_requests")
      .update({ status: "aceito" })
      .eq("id", scopeChangeId)
      .select();
    // RLS bloqueia por linha (proposed_by <> auth.uid()) — 0 linhas afetadas.
    expect(error).toBeNull();
    expect(data ?? []).toHaveLength(0);
  });

  it("contraparte consegue responder, e o valor muda de verdade", async () => {
    const { error } = await profissional.client
      .from("scope_change_requests")
      .update({ status: "aceito", responded_at: new Date().toISOString(), responded_by: profissional.id })
      .eq("id", scopeChangeId);
    expect(error).toBeNull();

    const { data } = await serviceClient()
      .from("scope_change_requests")
      .select("status")
      .eq("id", scopeChangeId)
      .single();
    expect(data?.status).toBe("aceito");
  });

  it("update tentando mexer em old_value/new_value é rejeitado pela restrição de coluna", async () => {
    const { error } = await profissional.client
      .from("scope_change_requests")
      .update({ new_value: "adulterado" })
      .eq("id", scopeChangeId);
    expect(error).not.toBeNull();
  });

  it("índice único rejeita segunda proposta pendente pro mesmo campo", async () => {
    const first = await tutor.client.from("scope_change_requests").insert({
      request_id: requestId,
      proposed_by: tutor.id,
      field_changed: "escopo",
      old_value: "Passeio de 30min",
      new_value: "Passeio de 60min",
    });
    expect(first.error).toBeNull();

    const second = await profissional.client.from("scope_change_requests").insert({
      request_id: requestId,
      proposed_by: profissional.id,
      field_changed: "escopo",
      old_value: "Passeio de 30min",
      new_value: "Passeio de 45min",
    });
    expect(second.error).not.toBeNull();
  });
});
