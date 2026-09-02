import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { provisionTestUser, cleanupTestUser, serviceClient, anonClient, type TestUser } from "./helpers";

describe("RLS — pets", () => {
  let tutorA: TestUser;
  let tutorB: TestUser;
  let petId: string;

  beforeAll(async () => {
    tutorA = await provisionTestUser(["tutor"], "pets-a");
    tutorB = await provisionTestUser(["tutor"], "pets-b");

    // Fixture montada com o client de serviço (bypassa RLS de propósito)
    // — o que está sob teste é a leitura/escrita como usuário depois,
    // não o próprio processo de montar o cenário.
    const admin = serviceClient();
    const { data: pet, error: petError } = await admin
      .from("pets")
      .insert({ name: "Fixture RLS", species: "cachorro", created_by: tutorA.id })
      .select("id")
      .single();
    if (petError || !pet) throw new Error(`fixture de pet falhou: ${petError?.message}`);
    petId = pet.id;

    const { error: linkError } = await admin
      .from("pet_tutors")
      .insert({ pet_id: petId, tutor_profile_id: tutorA.id });
    if (linkError) throw new Error(`fixture de pet_tutors falhou: ${linkError.message}`);
  }, 30_000);

  afterAll(async () => {
    // pets.created_by não tem ON DELETE CASCADE (de propósito, não é bug) —
    // apagar o pet primeiro, senão deleteUser falha silenciosamente e
    // deixa usuário de teste órfão pra trás.
    await serviceClient().from("pets").delete().in("created_by", [tutorA.id, tutorB.id]);
    await cleanupTestUser(tutorA.id);
    await cleanupTestUser(tutorB.id);
  });

  it("o dono enxerga o próprio pet", async () => {
    const { data, error } = await tutorA.client.from("pets").select("id").eq("id", petId).maybeSingle();
    expect(error).toBeNull();
    expect(data?.id).toBe(petId);
  });

  it("outro tutor (sem vínculo) NÃO enxerga o pet — RLS filtra silenciosamente, sem erro", async () => {
    const { data, error } = await tutorB.client.from("pets").select("id").eq("id", petId).maybeSingle();
    expect(error).toBeNull();
    expect(data).toBeNull();
  });

  it("visitante anônimo (sem sessão) também não enxerga", async () => {
    const { data, error } = await anonClient().from("pets").select("id").eq("id", petId).maybeSingle();
    expect(error).toBeNull();
    expect(data).toBeNull();
  });

  it("outro tutor não consegue se auto-adicionar como tutor do pet de alguém", async () => {
    const { error } = await tutorB.client
      .from("pet_tutors")
      .insert({ pet_id: petId, tutor_profile_id: tutorB.id });
    expect(error).not.toBeNull();
  });

  it("um tutor consegue criar o próprio pet (INSERT + WITH CHECK)", async () => {
    const { error } = await tutorA.client
      .from("pets")
      .insert({ name: "Segundo pet", species: "gato", created_by: tutorA.id });
    expect(error).toBeNull();
  });

  it("tutor não consegue criar pet em nome de outro perfil (created_by falsificado)", async () => {
    const { error } = await tutorA.client
      .from("pets")
      .insert({ name: "Pet falso", species: "gato", created_by: tutorB.id });
    expect(error).not.toBeNull();
  });
});
