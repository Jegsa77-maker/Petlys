import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { provisionTestUser, cleanupTestUser, serviceClient, anonClient, type TestUser } from "./helpers";

/**
 * 0073_narrow_public_professional_profile_read.sql — profiles_select_public_professional
 * (0013) liberava a LINHA INTEIRA de `profiles` (email/phone/cpf_cnpj/
 * birth_date/address_zip/lat/lng) pra qualquer conta com
 * professional_services ativo, porque RLS filtra linha, não coluna. Esse
 * teste prova que: (a) colunas sensíveis do profissional não vazam mais
 * pra outra conta pela leitura direta de `profiles`, (b) o RPC
 * get_public_professional_names continua devolvendo só id/full_name pra
 * quem tem serviço ativo — inclusive anon, mesmo alcance da policy
 * removida — e nada pra quem não tem, (c) o próprio dono ainda lê a
 * linha inteira normalmente (profiles_select, 0009, não foi tocada).
 */
describe("RLS — leitura pública de perfil de profissional (0073)", () => {
  let profissional: TestUser;
  let profissionalSemServico: TestUser;
  let outroTutor: TestUser;
  let serviceId: string;

  beforeAll(async () => {
    profissional = await provisionTestUser(["profissional"], "public-profile-prof");
    profissionalSemServico = await provisionTestUser(["profissional"], "public-profile-prof-sem-servico");
    outroTutor = await provisionTestUser(["tutor"], "public-profile-tutor");

    const admin = serviceClient();

    const { error: profileError } = await admin
      .from("profiles")
      .update({
        phone: "+5511999990000",
        cpf_cnpj: "11122233344",
        birth_date: "1990-01-01",
        address_zip: "01310-100",
        address_lat: -23.561,
        address_lng: -46.656,
      })
      .eq("id", profissional.id);
    if (profileError) throw new Error(`fixture de profile falhou: ${profileError.message}`);

    const { data: service, error: serviceError } = await admin
      .from("professional_services")
      .insert({
        professional_id: profissional.id,
        category: "passeador",
        pricing_model: "fixo",
        base_price: 50,
        active: true,
      })
      .select("id")
      .single();
    if (serviceError || !service) throw new Error(`fixture de professional_services falhou: ${serviceError?.message}`);
    serviceId = service.id;
  }, 30_000);

  afterAll(async () => {
    const admin = serviceClient();
    if (serviceId) await admin.from("professional_services").delete().eq("id", serviceId);
    await cleanupTestUser(profissional.id);
    await cleanupTestUser(profissionalSemServico.id);
    await cleanupTestUser(outroTutor.id);
  });

  it("outra conta não lê mais a linha inteira de profiles do profissional (colunas sensíveis inclusas)", async () => {
    const { data, error } = await outroTutor.client
      .from("profiles")
      .select("id, full_name, phone, cpf_cnpj, birth_date, address_zip, address_lat, address_lng")
      .eq("id", profissional.id)
      .maybeSingle();

    expect(error).toBeNull();
    expect(data).toBeNull();
  });

  it("anon também não lê a linha de profiles direto", async () => {
    const { data } = await anonClient()
      .from("profiles")
      .select("id, phone, cpf_cnpj")
      .eq("id", profissional.id)
      .maybeSingle();

    expect(data).toBeNull();
  });

  it("get_public_professional_names devolve só id/full_name pra quem tem serviço ativo — pra outra conta autenticada", async () => {
    const { data, error } = await outroTutor.client.rpc("get_public_professional_names", {
      p_professional_ids: [profissional.id],
    });

    expect(error).toBeNull();
    expect(data).toHaveLength(1);
    expect(data?.[0]).toEqual({ id: profissional.id, full_name: "Teste RLS public-profile-prof" });
  });

  it("get_public_professional_names funciona pra anon também — mesmo alcance da policy pública removida", async () => {
    const { data, error } = await anonClient().rpc("get_public_professional_names", {
      p_professional_ids: [profissional.id],
    });

    expect(error).toBeNull();
    expect(data).toEqual([{ id: profissional.id, full_name: "Teste RLS public-profile-prof" }]);
  });

  it("get_public_professional_names não devolve nada pra profissional sem serviço ativo", async () => {
    const { data, error } = await outroTutor.client.rpc("get_public_professional_names", {
      p_professional_ids: [profissionalSemServico.id],
    });

    expect(error).toBeNull();
    expect(data ?? []).toHaveLength(0);
  });

  it("o próprio profissional continua lendo a linha inteira do seu perfil (profiles_select, 0009, intacta)", async () => {
    const { data, error } = await profissional.client
      .from("profiles")
      .select("id, full_name, phone, cpf_cnpj, address_zip")
      .eq("id", profissional.id)
      .single();

    expect(error).toBeNull();
    expect(data?.phone).toBe("+5511999990000");
    expect(data?.cpf_cnpj).toBe("11122233344");
    expect(data?.address_zip).toBe("01310-100");
  });
});
