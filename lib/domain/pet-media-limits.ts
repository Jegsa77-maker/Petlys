/**
 * Limites de upload da galeria de fotos/vídeos do pet (seção 6.2, item 3 da
 * lista de ajustes) — configuráveis via `platform_parameters`
 * (galeria_pet_foto_max_mb/galeria_pet_video_max_mb/galeria_pet_max_itens,
 * ver lib/actions/pet-media.ts `getGalleryLimits`), com os valores abaixo
 * como fallback caso os parâmetros ainda não tenham sido cadastrados. O
 * bucket `pet-gallery` também aplica um teto no Storage (50MB, o máximo que
 * o Supabase Free aceita por arquivo) como rede de segurança de infra —
 * esse sim é fixo, não muda pelo Admin.
 *
 * Este módulo é isomórfico (usado tanto no client quanto no server) e não
 * faz nenhuma consulta ao banco — quem chama `validateMediaFile` já traz os
 * limites resolvidos.
 */
export const DEFAULT_MAX_PHOTO_MB = 1;
export const DEFAULT_MAX_VIDEO_MB = 5;
export const DEFAULT_MAX_MEDIA_ITEMS_PER_PET = 10;

export const ACCEPTED_PHOTO_MIME_TYPES = ["image/jpeg", "image/png", "image/webp", "image/heic"];
export const ACCEPTED_VIDEO_MIME_TYPES = ["video/mp4", "video/quicktime", "video/webm"];

export function isPhotoMimeType(mimeType: string): boolean {
  return mimeType.startsWith("image/");
}

export function isVideoMimeType(mimeType: string): boolean {
  return mimeType.startsWith("video/");
}

export type MediaSizeLimits = { maxPhotoBytes: number; maxVideoBytes: number };

/**
 * Valida um arquivo antes do upload. Retorna `null` quando está tudo certo,
 * ou a mensagem de erro pronta pra mostrar ao usuário.
 */
export function validateMediaFile(file: { type: string; size: number }, limits: MediaSizeLimits): string | null {
  if (isPhotoMimeType(file.type)) {
    if (!ACCEPTED_PHOTO_MIME_TYPES.includes(file.type)) {
      return "Formato de imagem não aceito — envie JPEG, PNG, WebP ou HEIC.";
    }
    if (file.size > limits.maxPhotoBytes) {
      return `Foto muito grande — limite de ${Math.round(limits.maxPhotoBytes / (1024 * 1024))}MB.`;
    }
    return null;
  }

  if (isVideoMimeType(file.type)) {
    if (!ACCEPTED_VIDEO_MIME_TYPES.includes(file.type)) {
      return "Formato de vídeo não aceito — envie MP4, MOV ou WebM.";
    }
    if (file.size > limits.maxVideoBytes) {
      return `Vídeo muito grande — limite de ${Math.round(limits.maxVideoBytes / (1024 * 1024))}MB.`;
    }
    return null;
  }

  return "Envie apenas foto ou vídeo.";
}
