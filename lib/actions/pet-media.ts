"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";
import { MAX_MEDIA_ITEMS_PER_PET } from "@/lib/domain/pet-media-limits";
import type { PetMediaType } from "@/types/database";

type ActionResult = { error: string | null };

/**
 * Adiciona um item (foto ou vídeo) na galeria do pet (seção 6.2, item 3 —
 * "mais fotos extras e vídeos"). O arquivo em si já foi enviado direto pro
 * bucket `pet-gallery` pelo client antes desta chamada (mesmo padrão de
 * updatePetPhoto/updatePetDocument) — aqui só grava a referência.
 */
export async function addPetMedia(
  petId: string,
  mediaType: PetMediaType,
  path: string
): Promise<ActionResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { error: "Sessão expirada. Faça login novamente." };
  }

  const { count } = await supabase
    .from("pet_media")
    .select("id", { count: "exact", head: true })
    .eq("pet_id", petId);

  if ((count ?? 0) >= MAX_MEDIA_ITEMS_PER_PET) {
    return { error: `Limite de ${MAX_MEDIA_ITEMS_PER_PET} fotos/vídeos por pet atingido.` };
  }

  const { error } = await supabase
    .from("pet_media")
    .insert({ pet_id: petId, media_type: mediaType, url: path, created_by: user.id });

  if (error) {
    return { error: "Não foi possível salvar a mídia." };
  }

  revalidatePath(`/pets/${petId}`);
  return { error: null };
}

/**
 * Remove um item da galeria — referência e arquivo físico (diferente da
 * carteira de vacinação, aqui não deixamos órfão no Storage: a galeria pode
 * crescer bem mais, com arquivos maiores, e o custo de acumular lixo é
 * real).
 */
export async function removePetMedia(mediaId: string, petId: string): Promise<ActionResult> {
  const supabase = await createClient();

  const { data: media } = await supabase.from("pet_media").select("url").eq("id", mediaId).single();

  const { error } = await supabase.from("pet_media").delete().eq("id", mediaId);
  if (error) {
    return { error: "Não foi possível remover a mídia." };
  }

  if (media?.url) {
    await supabase.storage.from("pet-gallery").remove([media.url]);
  }

  revalidatePath(`/pets/${petId}`);
  return { error: null };
}
