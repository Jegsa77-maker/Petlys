"use server";

import { createClient } from "@/lib/supabase/server";
import { updateTutorAddressSchema } from "@/lib/validations/profile";
import { geocodeCep, GeocodingError } from "@/lib/services/geocoding";
import { revalidatePath } from "next/cache";

type ActionResult = { error: string | null };

/**
 * Salva o CEP do Tutor e geocodifica pra lat/lng (mapa de cobertura do
 * Admin — antes disso, `profiles.address_zip/lat/lng` nunca eram
 * preenchidos pro Tutor por nenhum fluxo do app). Opcional, não bloqueia
 * nada — o Tutor preenche quando quiser, na tela de "Meu perfil".
 */
export async function updateTutorAddress(input: unknown): Promise<ActionResult> {
  const parsed = updateTutorAddressSchema.safeParse(input);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "CEP inválido" };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { error: "Sessão expirada. Faça login novamente." };
  }

  let geocoded;
  try {
    geocoded = await geocodeCep(parsed.data.cep);
  } catch (err) {
    if (err instanceof GeocodingError) return { error: err.message };
    return { error: "Não foi possível localizar esse CEP agora. Tente novamente." };
  }

  const { error } = await supabase
    .from("profiles")
    .update({ address_zip: geocoded.zip, address_lat: geocoded.lat, address_lng: geocoded.lng })
    .eq("id", user.id);

  if (error) {
    return { error: "Não foi possível salvar seu endereço. Tente novamente." };
  }

  revalidatePath("/meu-perfil");
  return { error: null };
}

/**
 * Foto de perfil do Tutor (doc "Petlys | Perfis - Pilar 1": "Foto —
 * Opcional. Ajuda na identificação e humanização da relação") — até
 * 2026-09-06 só o Profissional tinha avatar. Mesmo bucket `avatars`
 * (0017), a policy de storage já é por dono do caminho, não por papel —
 * não precisou de migration nova de storage, só a coluna em `profiles`.
 */
export async function updateTutorAvatar(avatarUrl: string): Promise<ActionResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { error: "Sessão expirada. Faça login novamente." };
  }

  const { error } = await supabase.from("profiles").update({ avatar_url: avatarUrl }).eq("id", user.id);

  if (error) {
    return { error: "Não foi possível salvar a foto." };
  }

  revalidatePath("/meu-perfil");
  return { error: null };
}
