"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { Paperclip, Loader2 } from "lucide-react";

export function EvidenceUpload({
  incidentId,
  requestId,
  uploadedBy,
}: {
  incidentId: string;
  requestId: string;
  uploadedBy: string;
}) {
  const [isUploading, setIsUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [uploadedCount, setUploadedCount] = useState(0);

  async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    setError(null);
    setIsUploading(true);

    const supabase = createClient();
    const path = `${requestId}/${incidentId}/${Date.now()}-${file.name}`;

    const { error: uploadError } = await supabase.storage
      .from("incident-evidence")
      .upload(path, file, { upsert: false });

    if (uploadError) {
      setIsUploading(false);
      setError("Não foi possível enviar o arquivo. Tente novamente.");
      return;
    }

    const { error: dbError } = await supabase.from("incident_evidence").insert({
      incident_id: incidentId,
      url: path,
      type: file.type.startsWith("image/") ? "foto" : file.type.startsWith("video/") ? "video" : "documento",
      uploaded_by: uploadedBy,
    });

    setIsUploading(false);
    if (dbError) {
      setError("Arquivo enviado, mas houve um erro ao registrar.");
      return;
    }

    setUploadedCount((c) => c + 1);
    e.target.value = "";
  }

  return (
    <div className="flex flex-col gap-2">
      <label className="flex items-center gap-2 text-xs font-semibold text-teal cursor-pointer hover:underline w-fit">
        {isUploading ? <Loader2 size={14} className="animate-spin" /> : <Paperclip size={14} />}
        {isUploading ? "Enviando..." : "Anexar foto, vídeo ou documento"}
        <input type="file" accept="image/*,video/*,.pdf" onChange={handleFileChange} disabled={isUploading} className="hidden" />
      </label>
      {uploadedCount > 0 && (
        <p className="text-xs text-gray-500">{uploadedCount} arquivo(s) anexado(s) nesta sessão.</p>
      )}
      {error && <p className="text-xs text-red-600" role="alert">{error}</p>}
    </div>
  );
}
