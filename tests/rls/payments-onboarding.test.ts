import { afterAll, beforeAll, describe, expect, it } from "vitest";
import {
  serviceClient,
  anonClient,
  provisionTestUser,
  cleanupTestUser,
  type TestUser,
} from "./helpers";

/**
 * Onda 3 (fundação sem gateway) — Etapa 1: RLS de `professional_recipients`
 * e `webhook_events`, e comportamento de `promote_scheduled_parameters()`.
 * Nenhum destes testes chama o gateway de pagamento de verdade — só o schema
 * e as funções internas, que não dependem de chave nenhuma.
 */
describe("Onda 3 — fundação sem gateway", () => {
  let profissional: TestUser;
  let tutor: TestUser;
  let admin: TestUser;

  beforeAll(async () => {
    profissional = await provisionTestUser(["profissional"], "onda3-prof");
    tutor = await provisionTestUser(["tutor"], "onda3-tutor");
    admin = await provisionTestUser(["administrador"], "onda3-admin");
  });

  afterAll(async () => {
    const admin_ = serviceClient();
    await admin_.from("professional_recipients").delete().eq("profile_id", profissional.id);
    await cleanupTestUser(profissional.id);
    await cleanupTestUser(tutor.id);
    await cleanupTestUser(admin.id);
  });

  describe("professional_recipients", () => {
    beforeAll(async () => {
      const admin_ = serviceClient();
      const { error } = await admin_.from("professional_recipients").insert({
        profile_id: profissional.id,
        status: "ativo",
        gateway_recipient_id: "rp_teste_fake",
        bank_code: "001",
        agencia: "0001",
        conta: "12345",
        conta_dv: "6",
        conta_tipo: "corrente",
      });
      if (error) throw new Error(`fixture professional_recipients falhou: ${error.message}`);
    });

    it("o próprio profissional vê seu recebedor", async () => {
      const { data, error } = await profissional.client
        .from("professional_recipients")
        .select("status")
        .eq("profile_id", profissional.id)
        .maybeSingle();
      expect(error).toBeNull();
      expect(data?.status).toBe("ativo");
    });

    it("outro profissional/tutor não vê o recebedor alheio", async () => {
      const { data, error } = await tutor.client
        .from("professional_recipients")
        .select("status")
        .eq("profile_id", profissional.id)
        .maybeSingle();
      expect(error).toBeNull();
      expect(data).toBeNull();
    });

    it("admin vê o recebedor de qualquer profissional", async () => {
      const { data, error } = await admin.client
        .from("professional_recipients")
        .select("status")
        .eq("profile_id", profissional.id)
        .maybeSingle();
      expect(error).toBeNull();
      expect(data?.status).toBe("ativo");
    });

    it("anon não vê nada", async () => {
      const { data } = await anonClient()
        .from("professional_recipients")
        .select("status")
        .eq("profile_id", profissional.id)
        .maybeSingle();
      expect(data).toBeNull();
    });

    it("o próprio profissional não consegue inserir/atualizar direto (sem policy — só service_role)", async () => {
      const { error: updateError, data } = await profissional.client
        .from("professional_recipients")
        .update({ status: "ativo" })
        .eq("profile_id", profissional.id)
        .select("*");
      // RLS sem policy de update: 0 linhas afetadas (não necessariamente um erro).
      expect(updateError).toBeNull();
      expect(data ?? []).toHaveLength(0);
    });
  });

  describe("webhook_events", () => {
    let eventId: string;

    beforeAll(async () => {
      const admin_ = serviceClient();
      const { data, error } = await admin_
        .from("webhook_events")
        .insert({
          gateway_event_id: `rls-test-${Date.now()}`,
          type: "charge.paid",
          payload: { teste: true },
          verified: true,
        })
        .select("id")
        .single();
      if (error || !data) throw new Error(`fixture webhook_events falhou: ${error?.message}`);
      eventId = data.id;
    });

    afterAll(async () => {
      await serviceClient().from("webhook_events").delete().eq("id", eventId);
    });

    it("admin vê o evento", async () => {
      const { data, error } = await admin.client.from("webhook_events").select("id").eq("id", eventId).maybeSingle();
      expect(error).toBeNull();
      expect(data?.id).toBe(eventId);
    });

    it("profissional/tutor não veem eventos de webhook", async () => {
      const { data } = await profissional.client.from("webhook_events").select("id").eq("id", eventId).maybeSingle();
      expect(data).toBeNull();
    });

    it("idempotência: gateway_event_id repetido não duplica (índice único)", async () => {
      const admin_ = serviceClient();
      const duplicateId = `rls-test-dup-${Date.now()}`;
      const first = await admin_
        .from("webhook_events")
        .insert({ gateway_event_id: duplicateId, type: "charge.paid", payload: {} });
      expect(first.error).toBeNull();

      const second = await admin_
        .from("webhook_events")
        .insert({ gateway_event_id: duplicateId, type: "charge.paid", payload: {} });
      expect(second.error).not.toBeNull();

      await admin_.from("webhook_events").delete().eq("gateway_event_id", duplicateId);
    });
  });

  describe("promote_scheduled_parameters()", () => {
    const chave1 = "rls-test-comissao";
    const chave2 = `onda3-${Date.now()}`;

    afterAll(async () => {
      // platform_parameters nunca é apagado fisicamente de propósito — a
      // própria trigger de auditoria (log_platform_parameter_change, on
      // delete) tenta gravar um log referenciando a linha que acabou de
      // sumir e falha com violação de FK (achado real, visto rodando esta
      // suíte: um DELETE aqui quebra sempre, é o mesmo motivo de
      // `deleteParameter` em lib/actions/admin.ts fazer soft-delete, nunca
      // DELETE físico). "Limpar" aqui é marcar as duas linhas de teste como
      // substituído — elas ficam para sempre na tabela com uma chave
      // obviamente de teste, igual qualquer outro histórico de parâmetro.
      const admin_ = serviceClient();
      await admin_
        .from("platform_parameters")
        .update({ status: "substituido" })
        .eq("chave1", chave1)
        .eq("chave2", chave2);
    });

    it("promove agendado->ativo e rebaixa o ativo anterior quando a vigência já passou", async () => {
      const admin_ = serviceClient();

      // Usa um admin real e permanente como `atualizado_por` (não um usuário
      // de teste efêmero) — platform_parameters/platform_parameters_log
      // referenciam profiles sem ON DELETE CASCADE, então gravar aqui com um
      // profile de teste deixaria esse usuário permanentemente impossível de
      // apagar depois (mesmo achado do comentário acima).
      const { data: realAdmin, error: realAdminError } = await admin_
        .from("account_roles")
        .select("profile_id")
        .eq("role", "administrador")
        .eq("active", true)
        .limit(1)
        .single();
      expect(realAdminError).toBeNull();
      const atualizadoPor = realAdmin!.profile_id;

      const { error: activeError } = await admin_.from("platform_parameters").insert({
        chave1,
        chave2,
        chave3: "",
        valor1: "10",
        status: "ativo",
        atualizado_por: atualizadoPor,
      });
      expect(activeError).toBeNull();

      const { error: scheduledError } = await admin_.from("platform_parameters").insert({
        chave1,
        chave2,
        chave3: "",
        valor1: "20",
        status: "agendado",
        vigencia_inicio: new Date(Date.now() - 60_000).toISOString(),
        atualizado_por: atualizadoPor,
      });
      expect(scheduledError).toBeNull();

      const { error: rpcError } = await admin_.rpc("promote_scheduled_parameters");
      expect(rpcError).toBeNull();

      const { data: rows } = await admin_
        .from("platform_parameters")
        .select("valor1, status")
        .eq("chave1", chave1)
        .eq("chave2", chave2)
        .order("valor1");

      const ativo = rows?.find((r) => r.status === "ativo");
      const substituido = rows?.find((r) => r.status === "substituido");
      expect(ativo?.valor1).toBe("20");
      expect(substituido?.valor1).toBe("10");
    });
  });
});
