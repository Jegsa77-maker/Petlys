"use server";

import { createClient } from "@/lib/supabase/server";
import type { SupabaseClient } from "@supabase/supabase-js";
import { revalidatePath } from "next/cache";
import {
  DEFAULT_MAX_PHOTO_MB,
  DEFAULT_MAX_VIDEO_MB,
  DEFAULT_MAX_MEDIA_ITEMS_PER_PET,
} from "@/lib/domain/pet-media-limits";
import type { Database, PetMediaType } from "@/types/database";

type ActionResult = { error: string | null };

/**
 * Limites da galeria (item 3 da lista de ajustes), configuráveis pelo Admin
 * em `platform_parameters` (galeria_pet_foto_max_mb/galeria_pet_video_max_mb/
 * galeria_pet_max_itens) — mesmo padrão já usado pra comissão/taxa de
 * serviço. Sem RPC: `platform_parameters_select_all` (0009) já libera select
 * pra qualquer client, então dá pra ler direto tanto daqui (Server Action)
 * quanto de um Server Component (ver app/(tutor)/pets/[petId]/page.tsx).
 * Se o parâmetro ainda não foi cadastrado, cai no default — pedido explícito
 * do usuário: 1MB/5MB/10 itens.
 */
export async function getGalleryLimits(): Promise<{
  maxPhotoBytes: number;
  maxVideoBytes: number;
  maxItems: number;
}> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("platform_parameters")
    .select("chave1, valor1")
    .in("chave1", ["galeria_pet_foto_max_mb", "galeria_pet_video_max_mb", "galeria_pet_max_itens"])
    .eq("chave2", "")
    .eq("status", "ativo");

  const valueByKey = new Map((data ?? []).map((p) => [p.chave1, p.valor1]));
  const photoMb = Number(valueByKey.get("galeria_pet_foto_max_mb")) || DEFAULT_MAX_PHOTO_MB;
  const videoMb = Number(valueByKey.get("galeria_pet_video_max_mb")) || DEFAULT_MAX_VIDEO_MB;
  const maxItems = Number(valueByKey.get("galeria_pet_max_itens")) || DEFAULT_MAX_MEDIA_ITEMS_PER_PET;

  return {
    maxPhotoBytes: photoMb * 1024 * 1024,
    maxVideoBytes: videoMb * 1024 * 1024,
    maxItems,
  };
}

/**
 * Adiciona um item (foto ou vídeo) na galeria do pet (seção 6.2, item 3 —
 * "mais fotos extras e vídeos"). O arquivo em si já foi enviado direto pro
 * bucket `pet-gallery` pelo client antes desta chamada (mesmo padrão de
 * updatePetPhoto/updatePetDocument) — aqui só grava a referência. Reconfere
 * o tamanho do arquivo já enviado contra o limite configurado: a checagem
 * no client (lib/domain/pet-media-limits.ts) é só UX, alguém podia sempre
 * chamar o Storage direto contornando ela.
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

  const limits = await getGalleryLimits();

  const { count } = await supabase
    .from("pet_media")
    .select("id", { count: "exact", head: true })
    .eq("pet_id", petId);

  if ((count ?? 0) >= limits.maxItems) {
    await supabase.storage.from("pet-gallery").remove([path]);
    return { error: `Limite de ${limits.maxItems} fotos/vídeos por pet atingido.` };
  }

  const maxBytes = mediaType === "video" ? limits.maxVideoBytes : limits.maxPhotoBytes;
  const uploadedSize = await getUploadedObjectSize(supabase, path);
  if (uploadedSize !== null && uploadedSize > maxBytes) {
    await supabase.storage.from("pet-gallery").remove([path]);
    const label = mediaType === "video" ? "Vídeo" : "Foto";
    return { error: `${label} maior que o limite atual (${Math.round(maxBytes / (1024 * 1024))}MB).` };
  }

  const { error } = await supabase
    .from("pet_media")
    .insert({ pet_id: petId, media_type: mediaType, url: path, created_by: user.id });

  if (error) {
    await supabase.storage.from("pet-gallery").remove([path]);
    return { error: "Não foi possível salvar a mídia." };
  }

  revalidatePath(`/pets/${petId}`);
  return { error: null };
}

async function getUploadedObjectSize(
  supabase: SupabaseClient<Database>,
  path: string
): Promise<number | null> {
  const lastSlash = path.lastIndexOf("/");
  const folder = path.slice(0, lastSlash);
  const filename = path.slice(lastSlash + 1);
  const { data } = await supabase.storage.from("pet-gallery").list(folder, { search: filename });
  return data?.find((f) => f.name === filename)?.metadata?.size ?? null;
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
