"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { Loader2, Paperclip, FileText } from "lucide-react";

/**
 * Upload real de arquivo pro Storage do Supabase (seção 6.1/6.2/6.3 —
 * "upload direto de arquivo" era só um campo de URL até aqui). O caminho
 * segue sempre `{pathPrefix}/{timestamp}-{nome}` — as políticas de RLS de
 * cada bucket (ver 0017/0018) exigem que o primeiro segmento do caminho
 * seja o id do dono (profile_id ou pet_id), por isso `pathPrefix` deve ser
 * exatamente esse id.
 *
 * Reaproveitado por: avatar do profissional, foto do pet, carteira de
 * vacinação do pet e documento de habilitação do profissional.
 */
export function FileUploadField({
  bucket,
  pathPrefix,
  accept,
  currentUrl,
  currentLabel,
  buttonLabel,
  isPrivateBucket,
  onUploaded,
}: {
  bucket: string;
  pathPrefix: string;
  accept: string;
  currentUrl?: string | null;
  currentLabel?: string;
  buttonLabel: string;
  /** Bucket privado -> não há URL pública pra pré-visualizar (só link de download assinado, fora de escopo aqui). */
  isPrivateBucket?: boolean;
  onUploaded: (publicUrl: string) => void | Promise<void>;
}) {
  const [isUploading, setIsUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    setError(null);
    setIsUploading(true);

    const supabase = createClient();
    const path = `${pathPrefix}/${Date.now()}-${file.name}`;

    const { error: uploadError } = await supabase.storage.from(bucket).upload(path, file, {
      upsert: false,
    });

    if (uploadError) {
      setIsUploading(false);
      // Alguns buckets restringem o tipo de arquivo no próprio Storage
      // (ex.: pet-documents, migration 0071) — essa é a mensagem real que
      // o Supabase devolve quando o arquivo não bate com o tipo permitido.
      const isMimeRejection = /mime type .* is not supported/i.test(uploadError.message);
      setError(
        isMimeRejection
          ? "Esse tipo de arquivo não é permitido aqui — envie PDF ou imagem."
          : "Não foi possível enviar o arquivo. Tente novamente."
      );
      return;
    }

    const {
      data: { publicUrl },
    } = supabase.storage.from(bucket).getPublicUrl(path);

    await onUploaded(isPrivateBucket ? path : publicUrl);
    setIsUploading(false);
    e.target.value = "";
  }

  return (
    <div className="flex flex-col gap-2">
      {currentUrl && !isPrivateBucket && (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={currentUrl} alt="" className="h-20 w-20 rounded-lg object-cover border border-gray-200" />
      )}
      {currentUrl && isPrivateBucket && (
        <p className="flex items-center gap-1 text-xs text-gray-600">
          <FileText size={14} /> {currentLabel ?? "Arquivo enviado"}
        </p>
      )}

      <label className="flex items-center gap-2 text-xs font-semibold text-teal cursor-pointer hover:underline w-fit">
        {isUploading ? <Loader2 size={14} className="animate-spin" /> : <Paperclip size={14} />}
        {isUploading ? "Enviando..." : buttonLabel}
        <input
          type="file"
          accept={accept}
          onChange={handleFileChange}
          disabled={isUploading}
          className="hidden"
        />
      </label>

      {error && <p className="text-xs text-red-600" role="alert">{error}</p>}
    </div>
  );
}
