/**
 * Limites de upload da galeria de fotos/vídeos do pet (seção 6.2, item 3 da
 * lista de ajustes). Aplicados no client antes do upload (mensagem de erro
 * amigável e imediata) — o bucket `pet-gallery` (migration 0072) também
 * aplica um teto no Storage como rede de segurança, mas com um limite único
 * (50MB, o maior dos dois) porque o Supabase Storage não diferencia limite
 * por MIME type dentro do mesmo bucket.
 *
 * Valores escolhidos pelo padrão comum de apps de foto/vídeo curto
 * (WhatsApp/Instagram): fotos folgadas o bastante pra foto de celular sem
 * compressão agressiva, vídeo limitado a um clipe curto (não é um app de
 * vídeo longo).
 */
export const MAX_PHOTO_BYTES = 10 * 1024 * 1024; // 10MB
export const MAX_VIDEO_BYTES = 50 * 1024 * 1024; // 50MB
export const MAX_MEDIA_ITEMS_PER_PET = 20;

export const ACCEPTED_PHOTO_MIME_TYPES = ["image/jpeg", "image/png", "image/webp", "image/heic"];
export const ACCEPTED_VIDEO_MIME_TYPES = ["video/mp4", "video/quicktime", "video/webm"];

export function isPhotoMimeType(mimeType: string): boolean {
  return mimeType.startsWith("image/");
}

export function isVideoMimeType(mimeType: string): boolean {
  return mimeType.startsWith("video/");
}

/**
 * Valida um arquivo antes do upload. Retorna `null` quando está tudo certo,
 * ou a mensagem de erro pronta pra mostrar ao usuário.
 */
export function validateMediaFile(file: { type: string; size: number }): string | null {
  if (isPhotoMimeType(file.type)) {
    if (!ACCEPTED_PHOTO_MIME_TYPES.includes(file.type)) {
      return "Formato de imagem não aceito — envie JPEG, PNG, WebP ou HEIC.";
    }
    if (file.size > MAX_PHOTO_BYTES) {
      return `Foto muito grande — limite de ${MAX_PHOTO_BYTES / (1024 * 1024)}MB.`;
    }
    return null;
  }

  if (isVideoMimeType(file.type)) {
    if (!ACCEPTED_VIDEO_MIME_TYPES.includes(file.type)) {
      return "Formato de vídeo não aceito — envie MP4, MOV ou WebM.";
    }
    if (file.size > MAX_VIDEO_BYTES) {
      return `Vídeo muito grande — limite de ${MAX_VIDEO_BYTES / (1024 * 1024)}MB.`;
    }
    return null;
  }

  return "Envie apenas foto ou vídeo.";
}
