import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { provisionTestUser, cleanupTestUser, serviceClient, type TestUser } from "./helpers";

/**
 * Teste de regressão do bug corrigido em
 * 0034_fix_supervisor_resolve_incident_rls.sql: a policy de UPDATE de
 * `incidents` liberava Admin e Supervisor pra qualquer mudança —
 * incluindo `status = 'resolvido'`, que a regra de produto (seção 10.2)
 * diz que só o Admin pode decidir. Um Supervisor com acesso direto à
 * API conseguia resolver sozinho, mesmo a Server Action bloqueando.
 */
describe("RLS — incidents (resolução Admin vs. Supervisor)", () => {
  let admin: TestUser;
  let supervisor: TestUser;
  let tutor: TestUser;
  let profissional: TestUser;
  let requestId: string;
  let incidentId: string;

  beforeAll(async () => {
    admin = await provisionTestUser(["administrador"], "incidents-admin");
    supervisor = await provisionTestUser(["supervisor"], "incidents-supervisor");
    tutor = await provisionTestUser(["tutor"], "incidents-tutor");
    profissional = await provisionTestUser(["profissional"], "incidents-prof");

    const service = serviceClient();
    const { data: request, error: requestError } = await service
      .from("requests")
      .insert({
        tutor_id: tutor.id,
        professional_id: profissional.id,
        category: "passeador",
        status: "incidente",
      })
      .select("id")
      .single();
    if (requestError || !request) throw new Error(`fixture de request falhou: ${requestError?.message}`);
    requestId = request.id;

    const { data: incident, error: incidentError } = await service
      .from("incidents")
      .insert({ request_id: requestId, opened_by: tutor.id, type: "outro", status: "em_analise" })
      .select("id")
      .single();
    if (incidentError || !incident) throw new Error(`fixture de incident falhou: ${incidentError?.message}`);
    incidentId = incident.id;
  }, 30_000);

  afterAll(async () => {
    const service = serviceClient();
    // Mesma ordem obrigatória de tests/rls/proposals.test.ts: apagar as
    // linhas que referenciam os usuários (incidents.opened_by,
    // requests.tutor_id/professional_id) antes de apagar os usuários.
    await service.from("incidents").delete().eq("id", incidentId);
    await service.from("requests").delete().eq("id", requestId);
    await cleanupTestUser(admin.id);
    await cleanupTestUser(supervisor.id);
    await cleanupTestUser(tutor.id);
    await cleanupTestUser(profissional.id);
  });

  it("Supervisor consegue escalar (transição permitida)", async () => {
    const { error } = await supervisor.client
      .from("incidents")
      .update({ status: "escalado" })
      .eq("id", incidentId);
    expect(error).toBeNull();

    const { data } = await serviceClient().from("incidents").select("status").eq("id", incidentId).single();
    expect(data?.status).toBe("escalado");
  });

  it("Supervisor NÃO consegue resolver diretamente — RLS bloqueia, não só a Server Action", async () => {
    const before = await serviceClient().from("incidents").select("status").eq("id", incidentId).single();

    await supervisor.client.from("incidents").update({ status: "resolvido" }).eq("id", incidentId);

    const after = await serviceClient().from("incidents").select("status").eq("id", incidentId).single();
    expect(after.data?.status).toBe(before.data?.status);
    expect(after.data?.status).not.toBe("resolvido");
  });

  it("Admin consegue resolver", async () => {
    const { error } = await admin.client
      .from("incidents")
      .update({ status: "resolvido", resolution: "Resolvido em teste" })
      .eq("id", incidentId);
    expect(error).toBeNull();

    const { data } = await serviceClient().from("incidents").select("status").eq("id", incidentId).single();
    expect(data?.status).toBe("resolvido");
  });
});
