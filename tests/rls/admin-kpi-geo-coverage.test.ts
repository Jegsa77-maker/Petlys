import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { provisionTestUser, cleanupTestUser, anonClient, type TestUser } from "./helpers";

/**
 * admin_kpi_geo_coverage e cep_to_uf (dashboard de KPIs do Admin, mapa de
 * cobertura por cidade). cep_to_uf é utilitário puro, sem checagem de
 * papel (mesmo tratamento de public.distance_km); admin_kpi_geo_coverage
 * é security definer com checagem de is_admin_or_supervisor() no corpo.
 */
describe("cep_to_uf", () => {
  it("mapeia CEPs conhecidos pra UF certa", async () => {
    const client = anonClient();
    const cases: [string, string][] = [
      ["01310-100", "SP"], // São Paulo capital
      ["20040-020", "RJ"], // Rio de Janeiro capital
      ["70040-010", "DF"], // Brasília
      ["90010-150", "RS"], // Porto Alegre
    ];
    for (const [zip, expected] of cases) {
      const { data, error } = await client.rpc("cep_to_uf", { zip });
      expect(error).toBeNull();
      expect(data).toBe(expected);
    }
  });

  it("retorna null pra CEP inválido/vazio", async () => {
    const { data } = await anonClient().rpc("cep_to_uf", { zip: "abc" });
    expect(data).toBeNull();
  });
});

describe("RLS — admin_kpi_geo_coverage", () => {
  let tutor: TestUser;
  let admin: TestUser;

  beforeAll(async () => {
    tutor = await provisionTestUser(["tutor"], "geo-tutor");
    admin = await provisionTestUser(["administrador"], "geo-admin");
  }, 30_000);

  afterAll(async () => {
    await cleanupTestUser(tutor.id);
    await cleanupTestUser(admin.id);
  });

  it("visitante anônimo não consegue chamar (sem EXECUTE)", async () => {
    const { error } = await anonClient().rpc("admin_kpi_geo_coverage");
    expect(error).not.toBeNull();
  });

  it("usuário logado não-admin recebe erro da própria função (checagem interna)", async () => {
    const { error } = await tutor.client.rpc("admin_kpi_geo_coverage");
    expect(error).not.toBeNull();
  });

  it("Admin consegue chamar sem erro", async () => {
    const { error } = await admin.client.rpc("admin_kpi_geo_coverage");
    expect(error).toBeNull();
  });
});
