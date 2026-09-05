"use server";

import { createClient } from "@/lib/supabase/server";
import { professionalProfileSchema } from "@/lib/validations/professional-profile";
import { revalidatePath } from "next/cache";

type ActionResult = { error: string | null };

/**
 * Cria ou atualiza a apresentação pública do Profissional (bio,
 * experiência, especializações, idiomas, políticas, foto). Upsert é
 * seguro aqui porque as duas policies (insert/update) usam a mesma
 * condição de dono — diferente do caso de account_roles (ver
 * lib/actions/auth.ts:chooseProfile), que só tem policy de insert.
 */
export async function upsertProfessionalProfile(input: unknown): Promise<ActionResult> {
  const parsed = professionalProfileSchema.safeParse(input);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Dados inválidos" };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { error: "Sessão expirada. Faça login novamente." };
  }

  const { error } = await supabase.from("professional_profiles").upsert(
    {
      profile_id: user.id,
      bio: parsed.data.bio || null,
      experience_years: parsed.data.experienceYears ?? null,
      specializations: parsed.data.specializations,
      languages: parsed.data.languages,
      policies: parsed.data.policies || null,
      avatar_url: parsed.data.avatarUrl || null,
      formation: parsed.data.formation || null,
      social_url: parsed.data.socialUrl || null,
      professional_name: parsed.data.professionalName || null,
      visita_inicial_enabled: parsed.data.visitaInicialEnabled,
      visita_inicial_price: parsed.data.visitaInicialPrice ?? null,
      visita_inicial_duration_minutes: parsed.data.visitaInicialDurationMinutes ?? null,
      visita_inicial_modality: parsed.data.visitaInicialModality ?? null,
      visita_inicial_deductible: parsed.data.visitaInicialDeductible,
    },
    { onConflict: "profile_id" }
  );

  if (error) {
    return { error: "Não foi possível salvar seu perfil. Tente novamente." };
  }

  revalidatePath("/perfil");
  revalidatePath(`/profissional/${user.id}`);
  return { error: null };
}
