"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";

type ActionResult = { error: string | null; favorited?: boolean };

/**
 * Favoritar/desfavoritar um profissional (seção 7.3/12.1) — Tutor só
 * gerencia os próprios favoritos (RLS em 0020_favoritos.sql).
 */
export async function toggleFavorite(professionalId: string): Promise<ActionResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { error: "Sessão expirada. Faça login novamente." };
  }

  const { data: existing } = await supabase
    .from("tutor_favorites")
    .select("professional_id")
    .eq("tutor_profile_id", user.id)
    .eq("professional_id", professionalId)
    .maybeSingle();

  if (existing) {
    const { error } = await supabase
      .from("tutor_favorites")
      .delete()
      .eq("tutor_profile_id", user.id)
      .eq("professional_id", professionalId);
    if (error) return { error: "Não foi possível remover dos favoritos." };
    revalidatePath("/buscar");
    revalidatePath(`/profissional/${professionalId}`);
    return { error: null, favorited: false };
  }

  const { error } = await supabase
    .from("tutor_favorites")
    .insert({ tutor_profile_id: user.id, professional_id: professionalId });
  if (error) return { error: "Não foi possível favoritar." };

  revalidatePath("/buscar");
  revalidatePath(`/profissional/${professionalId}`);
  return { error: null, favorited: true };
}
