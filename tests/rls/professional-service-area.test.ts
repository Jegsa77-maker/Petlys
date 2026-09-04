import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { provisionTestUser, cleanupTestUser, type TestUser } from "./helpers";

/**
 * Área de atendimento do profissional (raio configurável, item pedido pelo
 * usuário depois de ver o mapa de cobertura do Admin sem nenhum tutor —
 * 0069_professional_service_area_radius.sql). RLS de insert/update/delete
 * já existia desde 0012; o que muda aqui é radius_km aceitar null ("sem
 * restrição") e a constraint única por profissional (upsert, não múltiplas
 * áreas).
 */
describe("RLS — professional_service_areas (raio de atendimento)", () => {
  let profissional: TestUser;
  let outroProfissional: TestUser;

  beforeAll(async () => {
    profissional = await provisionTestUser(["profissional"], "service-area-prof");
    outroProfissional = await provisionTestUser(["profissional"], "service-area-outro");
  }, 30_000);

  afterAll(async () => {
    await profissional.client.from("professional_service_areas").delete().eq("professional_id", profissional.id);
    await outroProfissional.client
      .from("professional_service_areas")
      .delete()
      .eq("professional_id", outroProfissional.id);
    await cleanupTestUser(profissional.id);
    await cleanupTestUser(outroProfissional.id);
  });

  it("profissional insere sua própria área com radius_km null (sem restrição)", async () => {
    const { error } = await profissional.client.from("professional_service_areas").insert({
      professional_id: profissional.id,
      center_lat: -23.55,
      center_lng: -46.63,
      center_zip: "01310100",
      radius_km: null,
    });
    expect(error).toBeNull();
  });

  it("constraint única bloqueia uma segunda área pro mesmo profissional (upsert é o caminho certo)", async () => {
    const { error } = await profissional.client.from("professional_service_areas").insert({
      professional_id: profissional.id,
      center_lat: -22.9,
      center_lng: -43.2,
      radius_km: 10,
    });
    expect(error).not.toBeNull();
  });

  it("upsert por professional_id atualiza a área existente em vez de duplicar", async () => {
    const { error } = await profissional.client
      .from("professional_service_areas")
      .upsert(
        { professional_id: profissional.id, center_lat: -22.9, center_lng: -43.2, radius_km: 20 },
        { onConflict: "professional_id" }
      );
    expect(error).toBeNull();

    const { data } = await profissional.client
      .from("professional_service_areas")
      .select("radius_km")
      .eq("professional_id", profissional.id);
    expect(data).toHaveLength(1);
    expect(data?.[0]?.radius_km).toBe(20);
  });

  it("outro profissional não consegue atualizar a área alheia", async () => {
    const { data } = await outroProfissional.client
      .from("professional_service_areas")
      .update({ radius_km: 1 })
      .eq("professional_id", profissional.id)
      .select();
    expect(data ?? []).toHaveLength(0);
  });
});
