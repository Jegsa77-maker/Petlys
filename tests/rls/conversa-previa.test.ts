import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { provisionTestUser, cleanupTestUser, serviceClient, type TestUser } from "./helpers";

/**
 * "Conversar" no perfil do profissional — chat antes de formalizar uma
 * solicitação completa (ver 0042_conversa_previa.sql, lib/actions/requests.ts
 * startConversation/endPreChatConversation). Achado-chave que este teste
 * documenta: is_party_of_request() não olha `status` — o chat já funciona
 * num rascunho sem nenhuma mudança de RLS, bastou criar a request de verdade.
 */
describe("RLS — conversa prévia (chat antes de solicitar)", () => {
  let tutor: TestUser;
  let outroTutor: TestUser;
  let profissional: TestUser;
  let requestId: string;

  beforeAll(async () => {
    tutor = await provisionTestUser(["tutor"], "prechat-tutor");
    outroTutor = await provisionTestUser(["tutor"], "prechat-outro");
    profissional = await provisionTestUser(["profissional"], "prechat-prof");
  }, 30_000);

  afterAll(async () => {
    const admin = serviceClient();
    if (requestId) await admin.from("requests").delete().eq("id", requestId);
    await cleanupTestUser(tutor.id);
    await cleanupTestUser(outroTutor.id);
    await cleanupTestUser(profissional.id);
  });

  it("tutor consegue criar uma conversa prévia (rascunho mínimo, só categoria)", async () => {
    const { data, error } = await tutor.client
      .from("requests")
      .insert({
        tutor_id: tutor.id,
        professional_id: profissional.id,
        category: "passeador",
        status: "rascunho",
        is_conversa_previa: true,
      })
      .select("id")
      .single();

    expect(error).toBeNull();
    expect(data?.id).toBeTruthy();
    requestId = data!.id;
  });

  it("tutor e profissional conseguem enviar/ler mensagem num rascunho (is_party_of_request não olha status)", async () => {
    const { error: insertError } = await tutor.client
      .from("messages")
      .insert({ request_id: requestId, sender_id: tutor.id, content: "Oi, tudo bem?" });
    expect(insertError).toBeNull();

    const { data: fromProf, error: selectError } = await profissional.client
      .from("messages")
      .select("content")
      .eq("request_id", requestId);
    expect(selectError).toBeNull();
    expect(fromProf?.some((m) => m.content === "Oi, tudo bem?")).toBe(true);
  });

  it("terceiro tutor (não é parte) não lê nem escreve mensagem nessa conversa", async () => {
    const { data } = await outroTutor.client.from("messages").select("id").eq("request_id", requestId);
    expect(data ?? []).toHaveLength(0);

    const { error } = await outroTutor.client
      .from("messages")
      .insert({ request_id: requestId, sender_id: outroTutor.id, content: "intruso" });
    expect(error).not.toBeNull();
  });

  it("índice único barra uma segunda conversa aberta com o mesmo par (tutor, profissional)", async () => {
    const { error } = await tutor.client.from("requests").insert({
      tutor_id: tutor.id,
      professional_id: profissional.id,
      category: "banho_tosa",
      status: "rascunho",
      is_conversa_previa: true,
    });
    expect(error).not.toBeNull();
  });

  it("transição inválida (rascunho -> recusado) é rejeitada pela máquina de estados", async () => {
    const { error } = await serviceClient().from("requests").update({ status: "recusado" }).eq("id", requestId);
    expect(error).not.toBeNull();

    const { data } = await serviceClient().from("requests").select("status").eq("id", requestId).single();
    expect(data?.status).toBe("rascunho");
  });

  it("encerrar a conversa (rascunho -> cancelado) funciona", async () => {
    const { error } = await tutor.client.from("requests").update({ status: "cancelado" }).eq("id", requestId);
    expect(error).toBeNull();

    const { data } = await serviceClient().from("requests").select("status").eq("id", requestId).single();
    expect(data?.status).toBe("cancelado");
  });
});
