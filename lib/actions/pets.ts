"use server";

import { createClient } from "@/lib/supabase/server";
import {
  petStep1Schema,
  petHealthSchema,
  petBehaviorSchema,
  petRoutineSchema,
  petEmergencySchema,
} from "@/lib/validations/pets";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

type ActionResult = { error: string | null };

/**
 * Cria um pet com a Etapa 1 (obrigatória) e já vincula o tutor logado
 * em pet_tutors (seção 4.1: todos os campos da Etapa 1 são obrigatórios
 * para o pet ficar apto a receber solicitações).
 */
export async function createPet(input: unknown): Promise<ActionResult> {
  const parsed = petStep1Schema.safeParse(input);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Dados do pet inválidos" };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { error: "Sessão expirada. Faça login novamente." };
  }

  const { data: pet, error: petError } = await supabase
    .from("pets")
    .insert({
      name: parsed.data.name,
      species: parsed.data.species,
      breed: parsed.data.breed,
      sex: parsed.data.sex,
      birth_approx: parsed.data.birthApprox,
      size: parsed.data.size,
      weight: parsed.data.weight,
      created_by: user.id,
    })
    .select("id")
    .single();

  if (petError || !pet) {
    return { error: "Não foi possível cadastrar o pet. Tente novamente." };
  }

  const { error: linkError } = await supabase
    .from("pet_tutors")
    .insert({ pet_id: pet.id, tutor_profile_id: user.id });

  if (linkError) {
    return { error: "Pet criado, mas houve um erro ao vincular o tutor." };
  }

  revalidatePath("/pets");
  redirect(`/pets/${pet.id}`);
}

/**
 * Preenchimento progressivo das etapas 2–5 (saúde, comportamento, rotina,
 * emergência) — qualquer tutor vinculado ao pet pode completar depois.
 */
export async function updatePetHealth(petId: string, input: unknown): Promise<ActionResult> {
  const parsed = petHealthSchema.safeParse(input);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Dados inválidos" };
  }

  const supabase = await createClient();
  const { error } = await supabase
    .from("pets")
    .update({ health_info: parsed.data })
    .eq("id", petId);

  if (error) {
    return { error: "Não foi possível salvar as informações de saúde." };
  }

  revalidatePath(`/pets/${petId}`);
  return { error: null };
}

export async function updatePetBehavior(petId: string, input: unknown): Promise<ActionResult> {
  const parsed = petBehaviorSchema.safeParse(input);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Dados inválidos" };
  }

  const supabase = await createClient();
  const { error } = await supabase
    .from("pets")
    .update({ behavior_info: parsed.data })
    .eq("id", petId);

  if (error) {
    return { error: "Não foi possível salvar as informações de comportamento." };
  }

  revalidatePath(`/pets/${petId}`);
  return { error: null };
}

export async function updatePetRoutine(petId: string, input: unknown): Promise<ActionResult> {
  const parsed = petRoutineSchema.safeParse(input);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Dados inválidos" };
  }

  const supabase = await createClient();
  const { error } = await supabase
    .from("pets")
    .update({ routine_info: parsed.data })
    .eq("id", petId);

  if (error) {
    return { error: "Não foi possível salvar as informações de rotina." };
  }

  revalidatePath(`/pets/${petId}`);
  return { error: null };
}

export async function updatePetEmergency(petId: string, input: unknown): Promise<ActionResult> {
  const parsed = petEmergencySchema.safeParse(input);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Dados inválidos" };
  }

  const supabase = await createClient();
  const { error } = await supabase
    .from("pets")
    .update({ emergency_info: parsed.data })
    .eq("id", petId);

  if (error) {
    return { error: "Não foi possível salvar as informações de emergência." };
  }

  revalidatePath(`/pets/${petId}`);
  return { error: null };
}

/**
 * Foto do pet (upload real, seção 6.2) — bucket público `pet-photos`,
 * caminho `{petId}/...` (ver 0018_terms_consent_documents_certifications.sql).
 */
export async function updatePetPhoto(petId: string, photoUrl: string): Promise<ActionResult> {
  const supabase = await createClient();
  const { error } = await supabase.from("pets").update({ photo_url: photoUrl }).eq("id", petId);

  if (error) {
    return { error: "Não foi possível salvar a foto do pet." };
  }

  revalidatePath(`/pets/${petId}`);
  revalidatePath("/pets");
  return { error: null };
}

/**
 * Carteira de vacinação ou documento similar (upload real, seção 6.2) —
 * bucket privado `pet-documents`, caminho `{petId}/...`. Guardamos só o
 * caminho (não a URL pública, já que o bucket não é público).
 */
export async function updatePetDocument(petId: string, documentPath: string): Promise<ActionResult> {
  const supabase = await createClient();
  const { error } = await supabase.from("pets").update({ document_url: documentPath }).eq("id", petId);

  if (error) {
    return { error: "Não foi possível salvar o documento do pet." };
  }

  revalidatePath(`/pets/${petId}`);
  return { error: null };
}

/**
 * Convida outro tutor (por e-mail já cadastrado na plataforma) a ter
 * acesso completo ao pet — múltiplos tutores por pet (seção 2.2).
 * O co-tutor precisa já ter conta criada; não enviamos convite por
 * e-mail externo no MVP, só vinculamos contas existentes.
 */
export async function inviteCoTutorByEmail(petId: string, email: string): Promise<ActionResult> {
  if (!email.trim()) {
    return { error: "Informe o e-mail do co-tutor." };
  }

  const supabase = await createClient();

  const { data: targetProfile } = await supabase
    .from("profiles")
    .select("id")
    .eq("email", email.trim().toLowerCase())
    .maybeSingle();

  if (!targetProfile) {
    return {
      error: "Não encontramos ninguém com esse e-mail na plataforma. A pessoa precisa criar uma conta primeiro.",
    };
  }

  const { error } = await supabase
    .from("pet_tutors")
    .insert({ pet_id: petId, tutor_profile_id: targetProfile.id });

  if (error) {
    return { error: "Não foi possível adicionar o co-tutor. Talvez já esteja vinculado." };
  }

  revalidatePath(`/pets/${petId}`);
  return { error: null };
}

/**
 * Convida outro tutor (por profile_id já existente na plataforma) a ter
 * acesso completo ao pet — múltiplos tutores por pet (seção 2.2).
 */
export async function addCoTutor(petId: string, coTutorProfileId: string): Promise<ActionResult> {
  const supabase = await createClient();
  const { error } = await supabase
    .from("pet_tutors")
    .insert({ pet_id: petId, tutor_profile_id: coTutorProfileId });

  if (error) {
    return { error: "Não foi possível adicionar o co-tutor. Verifique se o ID está correto." };
  }

  revalidatePath(`/pets/${petId}`);
  return { error: null };
}
