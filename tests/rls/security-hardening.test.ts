import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { provisionTestUser, cleanupTestUser, serviceClient, anonClient, type TestUser } from "./helpers";

/**
 * Teste de regressão de 0038/0039_fix_security_hardening_grants.sql —
 * confirma que os dois problemas reais encontrados naquela auditoria
 * continuam corrigidos: `notify()` não pode mais ser chamada direto por
 * ninguém (só via trigger interno), e os RPCs de auto-serviço (aqui,
 * `flag_message`) não podem ser chamados por `anon`, só por usuário logado.
 */
describe("RLS/grants — segurança de funções (0038/0039)", () => {
  it("notify() não pode ser chamada direto por ninguém — nem anon, nem authenticated", async () => {
    const tutor = await provisionTestUser(["tutor"], "hardening-notify");
    try {
      const { error: anonError } = await anonClient().rpc("notify", {
        p_profile_id: tutor.id,
        p_type: "exploit_test",
        p_payload: {},
      });
      expect(anonError?.code).toBe("42501");

      const { error: authError } = await tutor.client.rpc("notify", {
        p_profile_id: tutor.id,
        p_type: "exploit_test",
        p_payload: {},
      });
      expect(authError?.code).toBe("42501");
    } finally {
      await cleanupTestUser(tutor.id);
    }
  });

  describe("flag_message — bloqueado pra anon, liberado pra authenticated", () => {
    let tutor: TestUser;
    let profissional: TestUser;
    let requestId: string;
    let messageId: string;

    beforeAll(async () => {
      tutor = await provisionTestUser(["tutor"], "hardening-flag-tutor");
      profissional = await provisionTestUser(["profissional"], "hardening-flag-prof");

      const service = serviceClient();
      const { data: request, error: requestError } = await service
        .from("requests")
        .insert({
          tutor_id: tutor.id,
          professional_id: profissional.id,
          category: "passeador",
          status: "em_conversa",
        })
        .select("id")
        .single();
      if (requestError || !request) throw new Error(`fixture de request falhou: ${requestError?.message}`);
      requestId = request.id;

      const { data: message, error: messageError } = await service
        .from("messages")
        .insert({ request_id: requestId, sender_id: profissional.id, content: "mensagem de teste" })
        .select("id")
        .single();
      if (messageError || !message) throw new Error(`fixture de message falhou: ${messageError?.message}`);
      messageId = message.id;
    }, 30_000);

    afterAll(async () => {
      await serviceClient().from("requests").delete().eq("id", requestId); // cascade cuida de messages
      await cleanupTestUser(tutor.id);
      await cleanupTestUser(profissional.id);
    });

    it("anon não consegue nem chamar a função", async () => {
      const { error } = await anonClient().rpc("flag_message", {
        p_message_id: messageId,
        p_reason: "teste anon",
      });
      expect(error?.code).toBe("42501");
    });

    it("a parte da solicitação (tutor) consegue sinalizar a mensagem do profissional", async () => {
      const { error } = await tutor.client.rpc("flag_message", {
        p_message_id: messageId,
        p_reason: "teste tutor",
      });
      expect(error).toBeNull();

      const { data } = await serviceClient().from("messages").select("flagged_reason").eq("id", messageId).single();
      expect(data?.flagged_reason).toBe("teste tutor");
    });
  });
});
