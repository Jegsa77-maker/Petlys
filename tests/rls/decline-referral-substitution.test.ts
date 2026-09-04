import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { provisionTestUser, cleanupTestUser, serviceClient, type TestUser } from "./helpers";

/**
 * Indicação/substituição de profissional (itens 25-29). As Server Actions
 * (declineRequest/acceptReferral/substituteProfessional) usam next/headers
 * (cookies), então não dá pra chamá-las direto num teste Vitest fora do
 * request lifecycle do Next — este arquivo testa a camada de RLS que
 * sustenta essas actions (igual ao padrão já usado nos outros testes desta
 * pasta): a lógica de elegibilidade em si (isEligibleColleague) fica
 * coberta por verificação manual/E2E.
 */
describe("RLS — indicação e substituição de profissional", () => {
  let tutor: TestUser;
  let profissional: TestUser;
  let colega: TestUser;
  let terceiro: TestUser;
  let requestId: string;

  beforeAll(async () => {
    tutor = await provisionTestUser(["tutor"], "referral-tutor");
    profissional = await provisionTestUser(["profissional"], "referral-prof");
    colega = await provisionTestUser(["profissional"], "referral-colega");
    terceiro = await provisionTestUser(["tutor"], "referral-terceiro");

    const admin = serviceClient();
    const { data: request, error } = await admin
      .from("requests")
      .insert({
        tutor_id: tutor.id,
        professional_id: profissional.id,
        category: "passeador",
        status: "solicitacao_enviada",
      })
      .select("id")
      .single();
    if (error || !request) throw new Error(`fixture de request falhou: ${error?.message}`);
    requestId = request.id;
  }, 30_000);

  afterAll(async () => {
    const admin = serviceClient();
    await admin.from("requests").delete().eq("origin_request_id", requestId);
    await admin.from("requests").delete().eq("id", requestId);
    await cleanupTestUser(tutor.id);
    await cleanupTestUser(profissional.id);
    await cleanupTestUser(colega.id);
    await cleanupTestUser(terceiro.id);
  });

  it("profissional recusa e indica um colega — grava status e referred_professional_id na própria request", async () => {
    const { error } = await profissional.client
      .from("requests")
      .update({ status: "recusado", referred_professional_id: colega.id })
      .eq("id", requestId);
    expect(error).toBeNull();

    const { data } = await serviceClient()
      .from("requests")
      .select("status, referred_professional_id")
      .eq("id", requestId)
      .single();
    expect(data?.status).toBe("recusado");
    expect(data?.referred_professional_id).toBe(colega.id);
  });

  it("terceiro (não é parte) não consegue mexer na indicação dessa request", async () => {
    const { data } = await terceiro.client
      .from("requests")
      .update({ referred_professional_id: terceiro.id })
      .eq("id", requestId)
      .select();
    expect(data ?? []).toHaveLength(0);

    const { data: unchanged } = await serviceClient()
      .from("requests")
      .select("referred_professional_id")
      .eq("id", requestId)
      .single();
    expect(unchanged?.referred_professional_id).toBe(colega.id);
  });

  it("tutor aceita a indicação: consegue criar a conversa vinculada (origin_request_id -> request original)", async () => {
    const { data, error } = await tutor.client
      .from("requests")
      .insert({
        tutor_id: tutor.id,
        professional_id: colega.id,
        category: "passeador",
        status: "rascunho",
        is_conversa_previa: true,
        origin_request_id: requestId,
      })
      .select("id, origin_request_id")
      .single();
    expect(error).toBeNull();
    expect(data?.origin_request_id).toBe(requestId);
  });

  it("profissional NÃO consegue criar a request vinculada em nome do tutor (requests_insert exige tutor_id = auth.uid())", async () => {
    const { error } = await profissional.client.from("requests").insert({
      tutor_id: tutor.id,
      professional_id: colega.id,
      category: "passeador",
      status: "rascunho",
      is_conversa_previa: true,
      origin_request_id: requestId,
    });
    expect(error).not.toBeNull();
  });

  it("substituição pós-aceite: transição em_andamento/finalizacao -> cancelado já é permitida (0048)", async () => {
    const admin = serviceClient();

    const { data: emAndamento } = await admin
      .from("requests")
      .insert({ tutor_id: tutor.id, professional_id: profissional.id, category: "passeador", status: "confirmado" })
      .select("id")
      .single();
    await admin.from("requests").update({ status: "em_andamento" }).eq("id", emAndamento!.id);

    const { error } = await tutor.client
      .from("requests")
      .update({ status: "cancelado", referred_professional_id: colega.id })
      .eq("id", emAndamento!.id);
    expect(error).toBeNull();

    const { data } = await admin.from("requests").select("status").eq("id", emAndamento!.id).single();
    expect(data?.status).toBe("cancelado");

    await admin.from("requests").delete().eq("id", emAndamento!.id);
  });
});
