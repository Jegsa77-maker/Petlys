"use client";

import { useState } from "react";
import { Paperclip } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { FileUploadField } from "@/components/shared/file-upload-field";
import { addRequestAttachment } from "@/lib/actions/request-attachments";

type Attachment = { id: string; url: string; created_at: string };

export function RequestAttachmentsSection({
  requestId,
  attachments,
}: {
  requestId: string;
  attachments: Attachment[];
}) {
  const [error, setError] = useState<string | null>(null);
  const [list, setList] = useState(attachments);

  async function handleUploaded(path: string) {
    const result = await addRequestAttachment(requestId, path);
    if (result?.error) {
      setError(result.error);
      return;
    }
    setList((prev) => [...prev, { id: path, url: path, created_at: new Date().toISOString() }]);
  }

  async function handleView(path: string) {
    const supabase = createClient();
    const { data, error: signError } = await supabase.storage
      .from("request-attachments")
      .createSignedUrl(path, 60);
    if (signError || !data?.signedUrl) {
      setError("Não foi possível abrir o anexo.");
      return;
    }
    window.open(data.signedUrl, "_blank", "noopener,noreferrer");
  }

  return (
    <div className="rounded-lg border border-gray-200 bg-white p-4">
      <p className="text-sm font-semibold text-black mb-2">Anexos</p>
      {list.length > 0 && (
        <ul className="flex flex-col gap-1 mb-3">
          {list.map((a) => (
            <li key={a.id}>
              <button
                type="button"
                onClick={() => handleView(a.url)}
                className="flex items-center gap-1 text-xs text-teal hover:underline"
              >
                <Paperclip size={12} /> {a.url.split("/").pop()}
              </button>
            </li>
          ))}
        </ul>
      )}
      <FileUploadField
        bucket="request-attachments"
        pathPrefix={requestId}
        accept="image/*,.pdf"
        isPrivateBucket
        currentUrl={null}
        buttonLabel="Anexar foto ou documento"
        onUploaded={handleUploaded}
      />
      {error && <p className="text-xs text-red-600 mt-1" role="alert">{error}</p>}
    </div>
  );
}
