"use client";

import { useState } from "react";
import { ImagePlus, Loader2, Play, Trash2, X } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { addPetMedia, removePetMedia } from "@/lib/actions/pet-media";
import { validateMediaFile, isVideoMimeType } from "@/lib/domain/pet-media-limits";
import type { PetMediaType } from "@/types/database";

type GalleryItem = {
  id: string;
  mediaType: PetMediaType;
  path: string;
  publicUrl: string;
};

/**
 * Galeria de fotos e vídeos extras do pet (seção 6.2, item 3 da lista de
 * ajustes) — diferente da foto de perfil única (PetMediaSection), aqui é
 * uma lista aberta (bucket público, mesmo espírito de pet-photos), com
 * lightbox pra abrir foto em tamanho real ou dar play no vídeo. Limites
 * (tamanho e quantidade) vêm do Admin via `platform_parameters` — ver
 * `getGalleryLimits` em lib/actions/pet-media.ts — resolvidos no server e
 * passados prontos aqui, não hardcoded no client.
 */
export function PetGallerySection({
  petId,
  initialItems,
  maxPhotoBytes,
  maxVideoBytes,
  maxItems,
}: {
  petId: string;
  initialItems: GalleryItem[];
  maxPhotoBytes: number;
  maxVideoBytes: number;
  maxItems: number;
}) {
  const [items, setItems] = useState(initialItems);
  const [isUploading, setIsUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null);
  const [removingId, setRemovingId] = useState<string | null>(null);

  const remainingSlots = maxItems - items.length;
  const maxPhotoMb = Math.round(maxPhotoBytes / (1024 * 1024));
  const maxVideoMb = Math.round(maxVideoBytes / (1024 * 1024));

  async function handleFilesSelected(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files ?? []);
    e.target.value = "";
    if (files.length === 0) return;

    setError(null);

    if (files.length > remainingSlots) {
      setError(
        `Você só pode adicionar mais ${remainingSlots} item(ns) — limite de ${maxItems} fotos/vídeos por pet.`
      );
      return;
    }

    setIsUploading(true);
    const supabase = createClient();

    for (const file of files) {
      const validationError = validateMediaFile(file, { maxPhotoBytes, maxVideoBytes });
      if (validationError) {
        setError(validationError);
        continue;
      }

      const mediaType: PetMediaType = isVideoMimeType(file.type) ? "video" : "foto";
      const path = `${petId}/${Date.now()}-${file.name}`;

      const { error: uploadError } = await supabase.storage.from("pet-gallery").upload(path, file, {
        upsert: false,
      });

      if (uploadError) {
        setError("Não foi possível enviar um dos arquivos. Tente novamente.");
        continue;
      }

      const result = await addPetMedia(petId, mediaType, path);
      if (result?.error) {
        setError(result.error);
        await supabase.storage.from("pet-gallery").remove([path]);
        continue;
      }

      const {
        data: { publicUrl },
      } = supabase.storage.from("pet-gallery").getPublicUrl(path);
      setItems((prev) => [...prev, { id: path, mediaType, path, publicUrl }]);
    }

    setIsUploading(false);
  }

  async function handleRemove(item: GalleryItem) {
    setRemovingId(item.id);
    try {
      const result = await removePetMedia(item.id, petId);
      if (result?.error) {
        setError(result.error);
        return;
      }
      setItems((prev) => prev.filter((i) => i.id !== item.id));
      setLightboxIndex(null);
    } finally {
      setRemovingId(null);
    }
  }

  return (
    <div className="flex flex-col gap-3 rounded-lg border border-gray-200 bg-white p-4">
      <div className="flex items-center justify-between">
        <p className="text-sm font-semibold text-black">Fotos e vídeos</p>
        <span className="text-xs text-gray-400">
          {items.length}/{maxItems}
        </span>
      </div>

      <div className="grid grid-cols-3 gap-2">
        {items.map((item, index) => (
          <button
            key={item.id}
            type="button"
            onClick={() => setLightboxIndex(index)}
            className="relative aspect-square overflow-hidden rounded-lg border border-gray-200 bg-gray"
          >
            {item.mediaType === "video" ? (
              <>
                <video src={item.publicUrl} preload="metadata" muted className="h-full w-full object-cover" />
                <span className="absolute inset-0 flex items-center justify-center bg-black/20">
                  <Play size={24} className="text-white" fill="white" />
                </span>
              </>
            ) : (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={item.publicUrl} alt="" className="h-full w-full object-cover" />
            )}
          </button>
        ))}

        {remainingSlots > 0 && (
          <label className="flex aspect-square cursor-pointer flex-col items-center justify-center gap-1 rounded-lg border border-dashed border-gray-300 text-gray-400 hover:border-teal hover:text-teal">
            {isUploading ? <Loader2 size={20} className="animate-spin" /> : <ImagePlus size={20} />}
            <span className="text-[10px] font-medium">{isUploading ? "Enviando..." : "Adicionar"}</span>
            <input
              type="file"
              accept="image/*,video/*"
              multiple
              onChange={handleFilesSelected}
              disabled={isUploading}
              className="hidden"
            />
          </label>
        )}
      </div>

      <p className="text-xs text-gray-500">
        Foto até {maxPhotoMb}MB, vídeo até {maxVideoMb}MB. Visível pra você, os co-tutores e o profissional
        contratado.
      </p>

      {error && <p className="text-xs text-red-600" role="alert">{error}</p>}

      {lightboxIndex !== null && items[lightboxIndex] && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4"
          onClick={() => setLightboxIndex(null)}
        >
          <div className="relative max-h-full max-w-full" onClick={(e) => e.stopPropagation()}>
            {items[lightboxIndex].mediaType === "video" ? (
              <video src={items[lightboxIndex].publicUrl} controls autoPlay className="max-h-[80vh] max-w-full rounded-lg" />
            ) : (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={items[lightboxIndex].publicUrl}
                alt=""
                className="max-h-[80vh] max-w-full rounded-lg object-contain"
              />
            )}

            <div className="absolute -top-10 right-0 flex items-center gap-3">
              <button
                type="button"
                onClick={() => handleRemove(items[lightboxIndex])}
                disabled={removingId === items[lightboxIndex].id}
                className="flex items-center gap-1 text-xs font-semibold text-white hover:text-red-400 disabled:opacity-60"
              >
                <Trash2 size={16} />
                {removingId === items[lightboxIndex].id ? "Removendo..." : "Remover"}
              </button>
              <button type="button" onClick={() => setLightboxIndex(null)} className="text-white hover:text-gray-300">
                <X size={20} />
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
