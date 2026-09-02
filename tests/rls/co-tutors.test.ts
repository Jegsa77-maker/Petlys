import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { provisionTestUser, cleanupTestUser, serviceClient, anonClient, type TestUser } from "./helpers";

/**
 * Teste de regressão do bug corrigido em
 * 0037_fix_co_tutor_name_visibility.sql: `profiles_select` só libera o
 * próprio perfil (ou Admin/Supervisor) — antes da função
 * `get_pet_co_tutor_names`, cada co-tutor só via a si mesmo na lista
 * "Tutores vinculados", nunca o nome do outro.
 */
describe("RLS — get_pet_co_tutor_names", () => {
  let tutorA: TestUser;
  let tutorB: TestUser;
  let estranho: TestUser;
  let petId: string;

  beforeAll(async () => {
    tutorA = await provisionTestUser(["tutor"], "cotutor-a");
    tutorB = await provisionTestUser(["tutor"], "cotutor-b");
    estranho = await provisionTestUser(["tutor"], "cotutor-estranho");

    const service = serviceClient();
    const { data: pet, error: petError } = await service
      .from("pets")
      .insert({ name: "Fixture co-tutor", species: "gato", created_by: tutorA.id })
      .select("id")
      .single();
    if (petError || !pet) throw new Error(`fixture de pet falhou: ${petError?.message}`);
    petId = pet.id;

    const { error: linkError } = await service
      .from("pet_tutors")
      .insert([
        { pet_id: petId, tutor_profile_id: tutorA.id },
        { pet_id: petId, tutor_profile_id: tutorB.id },
      ]);
    if (linkError) throw new Error(`fixture de pet_tutors falhou: ${linkError.message}`);
  }, 30_000);

  afterAll(async () => {
    await serviceClient().from("pets").delete().eq("id", petId);
    await cleanupTestUser(tutorA.id);
    await cleanupTestUser(tutorB.id);
    await cleanupTestUser(estranho.id);
  });

  it("cada co-tutor vê os DOIS nomes, não só o próprio", async () => {
    const { data, error } = await tutorA.client.rpc("get_pet_co_tutor_names", { p_pet_id: petId });
    expect(error).toBeNull();
    const ids = (data ?? []).map((r) => r.tutor_profile_id).sort();
    expect(ids).toEqual([tutorA.id, tutorB.id].sort());

    const fromB = await tutorB.client.rpc("get_pet_co_tutor_names", { p_pet_id: petId });
    const idsFromB = (fromB.data ?? []).map((r) => r.tutor_profile_id).sort();
    expect(idsFromB).toEqual([tutorA.id, tutorB.id].sort());
  });

  it("quem não é tutor desse pet recebe lista vazia (não erro, não dado de terceiro)", async () => {
    const { data, error } = await estranho.client.rpc("get_pet_co_tutor_names", { p_pet_id: petId });
    expect(error).toBeNull();
    expect(data).toEqual([]);
  });

  it("anônimo (sem sessão) não consegue nem chamar a função — bloqueado por GRANT, não silenciosamente vazio", async () => {
    const { error } = await anonClient().rpc("get_pet_co_tutor_names", { p_pet_id: petId });
    expect(error).not.toBeNull();
    expect(error?.code).toBe("42501"); // permission denied for function
  });
});
