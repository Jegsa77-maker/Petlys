import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { provisionTestUser, cleanupTestUser, anonClient, serviceClient, type TestUser } from "./helpers";

/**
 * analytics_events (dashboard de KPIs do Admin, itens 19-20) — log
 * write-only pros KPIs de funil/aquisição. Qualquer visitante (anônimo ou
 * logado) pode inserir, mas só Admin/Supervisor lê. Sem policy de
 * update/delete — log imutável.
 */
describe("RLS — analytics_events", () => {
  let tutor: TestUser;
  let admin: TestUser;
  const sessionId = crypto.randomUUID();

  beforeAll(async () => {
    tutor = await provisionTestUser(["tutor"], "analytics-tutor");
    admin = await provisionTestUser(["administrador"], "analytics-admin");
  }, 30_000);

  afterAll(async () => {
    const svc = serviceClient();
    await svc.from("analytics_events").delete().eq("session_id", sessionId);
    await cleanupTestUser(tutor.id);
    await cleanupTestUser(admin.id);
  });

  it("visitante anônimo consegue registrar um evento", async () => {
    const { error } = await anonClient()
      .from("analytics_events")
      .insert({ event_name: "signup_started", session_id: sessionId, source: "google", medium: "cpc" });
    expect(error).toBeNull();
  });

  it("usuário logado (não-admin) consegue registrar um evento", async () => {
    const { error } = await tutor.client
      .from("analytics_events")
      .insert({ event_name: "professional_profile_view", session_id: sessionId, profile_id: tutor.id });
    expect(error).toBeNull();
  });

  it("usuário logado (não-admin) NÃO consegue ler analytics_events", async () => {
    const { data } = await tutor.client.from("analytics_events").select("id").eq("session_id", sessionId);
    expect(data ?? []).toHaveLength(0);
  });

  it("visitante anônimo NÃO consegue ler analytics_events", async () => {
    const { data } = await anonClient().from("analytics_events").select("id").eq("session_id", sessionId);
    expect(data ?? []).toHaveLength(0);
  });

  it("Admin consegue ler analytics_events", async () => {
    const { data, error } = await admin.client
      .from("analytics_events")
      .select("id, event_name")
      .eq("session_id", sessionId);
    expect(error).toBeNull();
    expect((data ?? []).length).toBe(2);
  });

  it("ninguém consegue dar update (log imutável — sem policy de update)", async () => {
    const { data } = await admin.client
      .from("analytics_events")
      .update({ event_name: "adulterado" })
      .eq("session_id", sessionId)
      .select();
    expect(data ?? []).toHaveLength(0);
  });
});
