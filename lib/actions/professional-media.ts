"use server";

import { createClient } from "@/lib/supabase/server";
import type { SupabaseClient } from "@supabase/supabase-js";
import { revalidatePath } from "next/cache";
import { getGalleryLimits } from "@/lib/actions/pet-media";
import type { Database } from "@/types/database";

type ActionResult = { error: string | null };
type MediaType = "foto" | "video";

/**
 * Galeria de fotos e vídeos do Profissional (2026-09-06) — mesmo padrão de
 * pet_media/pet-gallery (lib/actions/pet-media.ts), reusando os MESMOS
 * limites configurados pelo Admin (pedido explícito do usuário: "limites
 * de tamanho iguais aos já configurados") — não criamos parâmetros novos
 * em platform_parameters, só reaproveitamos getGalleryLimits.
 */
export async function addProfessionalMedia(mediaType: MediaType, path: string): Promise<ActionResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { error: "Sessão expirada. Faça login novamente." };
  }

  const limits = await getGalleryLimits();

  const { count } = await supabase
    .from("professional_media")
    .select("id", { count: "exact", head: true })
    .eq("professional_id", user.id);

  if ((count ?? 0) >= limits.maxItems) {
    await supabase.storage.from("professional-gallery").remove([path]);
    return { error: `Limite de ${limits.maxItems} fotos/vídeos atingido.` };
  }

  const maxBytes = mediaType === "video" ? limits.maxVideoBytes : limits.maxPhotoBytes;
  const uploadedSize = await getUploadedObjectSize(supabase, path);
  if (uploadedSize !== null && uploadedSize > maxBytes) {
    await supabase.storage.from("professional-gallery").remove([path]);
    const label = mediaType === "video" ? "Vídeo" : "Foto";
    return { error: `${label} maior que o limite atual (${Math.round(maxBytes / (1024 * 1024))}MB).` };
  }

  const { error } = await supabase
    .from("professional_media")
    .insert({ professional_id: user.id, media_type: mediaType, url: path, created_by: user.id });

  if (error) {
    await supabase.storage.from("professional-gallery").remove([path]);
    return { error: "Não foi possível salvar a mídia." };
  }

  revalidatePath("/perfil");
  revalidatePath(`/profissional/${user.id}`);
  return { error: null };
}

async function getUploadedObjectSize(
  supabase: SupabaseClient<Database>,
  path: string
): Promise<number | null> {
  const lastSlash = path.lastIndexOf("/");
  const folder = path.slice(0, lastSlash);
  const filename = path.slice(lastSlash + 1);
  const { data } = await supabase.storage.from("professional-gallery").list(folder, { search: filename });
  return data?.find((f) => f.name === filename)?.metadata?.size ?? null;
}

export async function removeProfessionalMedia(mediaId: string): Promise<ActionResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { error: "Sessão expirada. Faça login novamente." };
  }

  const { data: media } = await supabase.from("professional_media").select("url").eq("id", mediaId).single();

  const { error } = await supabase.from("professional_media").delete().eq("id", mediaId);
  if (error) {
    return { error: "Não foi possível remover a mídia." };
  }

  if (media?.url) {
    await supabase.storage.from("professional-gallery").remove([media.url]);
  }

  revalidatePath("/perfil");
  revalidatePath(`/profissional/${user.id}`);
  return { error: null };
}
