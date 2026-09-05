"use server";

import { createClient, createServiceRoleClient } from "@/lib/supabase/server";
import { siteOrigin } from "@/lib/actions/auth";
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
 * Remove strings vazias antes de gravar em `health_info`/`behavior_info`/
 * `routine_info`/`emergency_info` — os schemas (lib/validations/pets.ts)
 * marcam todo campo como opcional, então o zod sempre devolve `""` pros
 * campos que a pessoa não digitou. Sem isso, salvar um formulário
 * completamente em branco gravava um objeto cheio de chaves vazias, que
 * `isSectionFilled` (lib/domain/category-requirements.ts) e o próprio
 * `PetProfileSection` liam como "preenchido" (bug real encontrado
 * navegando o app). Booleano fica como está — `false` num checkbox é uma
 * resposta de verdade, não "campo vazio".
 */
function stripEmptyStrings<T extends Record<string, unknown>>(data: T): Partial<T> {
  const result: Partial<T> = {};
  for (const [key, value] of Object.entries(data)) {
    if (typeof value === "string" && value.trim() === "") continue;
    result[key as keyof T] = value as T[keyof T];
  }
  return result;
}

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
    console.error("[createPet] insert failed", petError);
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
    .update({ health_info: stripEmptyStrings(parsed.data) })
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
    .update({ behavior_info: stripEmptyStrings(parsed.data) })
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
    .update({ routine_info: stripEmptyStrings(parsed.data) })
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
    .update({ emergency_info: stripEmptyStrings(parsed.data) })
    .eq("id", petId);

  if (error) {
    return { error: "Não foi possível salvar as informações de emergência." };
  }

  revalidatePath(`/pets/${petId}`);
  return { error: null };
}

/**
 * Castrado — campo de identificação (2026-09-06, revisão contra o doc
 * "Petlys | Perfis - Pilar 1") que faltava. Coluna própria (`pets.
 * neutered`), não jsonb: diferente de saúde/comportamento/rotina, isso
 * é um fato estruturado que outras partes do sistema podem precisar
 * checar (ex.: um serviço de hospedagem que só aceita pet castrado).
 * `null` = não informado ainda, diferente de `false` = informou que não é.
 */
export async function updatePetNeutered(petId: string, neutered: boolean | null): Promise<ActionResult> {
  const supabase = await createClient();
  const { error } = await supabase.from("pets").update({ neutered }).eq("id", petId);

  if (error) {
    return { error: "Não foi possível salvar." };
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
 * Remove a referência ao documento (achado navegando o app: dava pra
 * anexar mas não pra excluir). Só limpa `document_url` — o objeto em si
 * fica órfão no Storage, mesmo critério já usado em
 * withdrawCertification (lib/actions/professional-certifications.ts), que
 * também só remove a linha/referência, não o arquivo físico.
 */
export async function removePetDocument(petId: string): Promise<ActionResult> {
  const supabase = await createClient();
  const { error } = await supabase.from("pets").update({ document_url: null }).eq("id", petId);

  if (error) {
    return { error: "Não foi possível remover o documento." };
  }

  revalidatePath(`/pets/${petId}`);
  return { error: null };
}

/**
 * Convida outro tutor a ter acesso completo ao pet — múltiplos tutores
 * por pet (seção 2.2). Dois caminhos:
 *  1. E-mail já tem conta na Petlys -> vincula na hora, igual sempre foi.
 *  2. E-mail não tem conta -> convite formal (pendência da Onda 1, seção
 *     6.2): grava a intenção em `pet_co_tutor_invites` e dispara o e-mail
 *     de convite nativo do Supabase Auth (sem provedor de e-mail novo).
 *     `accept_pending_pet_co_tutor_invites()` vincula automaticamente
 *     quando a pessoa completa o cadastro normal (telefone, termos,
 *     papel) com esse mesmo e-mail — chamado em app/(tutor)/inicio/page.tsx.
 */
export async function inviteCoTutorByEmail(petId: string, email: string): Promise<ActionResult> {
  if (!email.trim()) {
    return { error: "Informe o e-mail do co-tutor." };
  }
  const cleanEmail = email.trim().toLowerCase();

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return { error: "Sessão expirada. Faça login novamente." };
  }

  const { data: targetProfile } = await supabase
    .from("profiles")
    .select("id")
    .eq("email", cleanEmail)
    .maybeSingle();

  if (targetProfile) {
    const { error } = await supabase
      .from("pet_tutors")
      .insert({ pet_id: petId, tutor_profile_id: targetProfile.id });

    if (error) {
      return { error: "Não foi possível adicionar o co-tutor. Talvez já esteja vinculado." };
    }

    revalidatePath(`/pets/${petId}`);
    return { error: null };
  }

  const { data: existingInvite } = await supabase
    .from("pet_co_tutor_invites")
    .select("id")
    .eq("pet_id", petId)
    .eq("invited_email", cleanEmail)
    .eq("status", "pendente")
    .maybeSingle();

  if (existingInvite) {
    return { error: "Já existe um convite pendente para esse e-mail neste pet." };
  }

  const { error: insertError } = await supabase
    .from("pet_co_tutor_invites")
    .insert({ pet_id: petId, invited_email: cleanEmail, invited_by: user.id });

  if (insertError) {
    return { error: "Não foi possível registrar o convite. Verifique se você é tutor deste pet." };
  }

  const serviceClient = createServiceRoleClient();
  const { error: inviteError } = await serviceClient.auth.admin.inviteUserByEmail(cleanEmail, {
    redirectTo: `${await siteOrigin()}/callback`,
  });

  if (inviteError) {
    // Não deixa o convite registrado como "pendente" se o e-mail nunca
    // chegou a sair — evita um convite fantasma que nunca vai ser aceito.
    await supabase
      .from("pet_co_tutor_invites")
      .update({ status: "cancelado" })
      .eq("pet_id", petId)
      .eq("invited_email", cleanEmail)
      .eq("status", "pendente");
    return { error: "Não foi possível enviar o convite por e-mail. Tente novamente." };
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
