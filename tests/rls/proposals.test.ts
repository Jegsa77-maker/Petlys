import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { provisionTestUser, cleanupTestUser, serviceClient, type TestUser } from "./helpers";

/**
 * Teste de regressão do bug corrigido em 0022_fix_proposals_accept_rls.sql:
 * `proposals` nunca teve policy de UPDATE — `acceptProposal` sempre
 * "funcionava" (sem erro) mas gravava zero linhas de verdade, porque o
 * Postgres nega UPDATE por padrão sem policy. Também cobre a restrição de
 * coluna que complementa a policy (RLS filtra linha, não coluna — sem o
 * grant restrito, o Tutor conseguiria alterar price/scope também).
 */
describe("RLS — proposals (aceite)", () => {
  let tutor: TestUser;
  let outroTutor: TestUser;
  let profissional: TestUser;
  let requestId: string;
  let proposalId: string;

  beforeAll(async () => {
    tutor = await provisionTestUser(["tutor"], "proposals-tutor");
    outroTutor = await provisionTestUser(["tutor"], "proposals-outro");
    profissional = await provisionTestUser(["profissional"], "proposals-prof");

    const admin = serviceClient();
    const { data: request, error: requestError } = await admin
      .from("requests")
      .insert({
        tutor_id: tutor.id,
        professional_id: profissional.id,
        category: "passeador",
        status: "proposta_enviada",
      })
      .select("id")
      .single();
    if (requestError || !request) throw new Error(`fixture de request falhou: ${requestError?.message}`);
    requestId = request.id;

    const { data: proposal, error: proposalError } = await admin
      .from("proposals")
      .insert({
        request_id: requestId,
        scope: "Passeio de 30 minutos",
        price: 50,
        validity_at: new Date(Date.now() + 86_400_000).toISOString(),
        created_by: profissional.id,
      })
      .select("id")
      .single();
    if (proposalError || !proposal) throw new Error(`fixture de proposal falhou: ${proposalError?.message}`);
    proposalId = proposal.id;
  }, 30_000);

  afterAll(async () => {
    const admin = serviceClient();
    // requests.tutor_id/professional_id não têm ON DELETE CASCADE até
    // profiles — precisa apagar a request (que cascateia pra proposals)
    // ANTES de apagar os usuários, senão deleteUser falha silenciosamente.
    await admin.from("requests").delete().eq("id", requestId);
    await cleanupTestUser(tutor.id);
    await cleanupTestUser(outroTutor.id);
    await cleanupTestUser(profissional.id);
  });

  it("o tutor da solicitação consegue aceitar (grava accepted_at de verdade)", async () => {
    const now = new Date().toISOString();
    const { error } = await tutor.client.from("proposals").update({ accepted_at: now }).eq("id", proposalId);
    expect(error).toBeNull();

    const { data } = await serviceClient().from("proposals").select("accepted_at").eq("id", proposalId).single();
    expect(data?.accepted_at).not.toBeNull();
  });

  it("tutor não consegue alterar o preço da proposta via update direto (só accepted_at é liberado)", async () => {
    const { error } = await tutor.client.from("proposals").update({ price: 1 }).eq("id", proposalId);
    expect(error).not.toBeNull();

    const { data } = await serviceClient().from("proposals").select("price").eq("id", proposalId).single();
    expect(Number(data?.price)).toBe(50); // não mudou
  });

  it("tutor de outra solicitação não consegue aceitar essa proposta", async () => {
    const before = await serviceClient().from("proposals").select("accepted_at").eq("id", proposalId).single();

    // RLS filtra a linha (0 linhas afetadas) — Postgres/PostgREST não
    // necessariamente devolve erro pra update que afeta 0 linhas, então
    // o que prova o bloqueio é o valor continuar exatamente o mesmo.
    await outroTutor.client
      .from("proposals")
      .update({ accepted_at: new Date(Date.now() + 999_999).toISOString() })
      .eq("id", proposalId);

    const after = await serviceClient().from("proposals").select("accepted_at").eq("id", proposalId).single();
    expect(after.data?.accepted_at).toBe(before.data?.accepted_at);
  });
});
