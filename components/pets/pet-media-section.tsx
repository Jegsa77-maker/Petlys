"use client";

import { useState } from "react";
import { FileText, Eye, Trash2 } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { FileUploadField } from "@/components/shared/file-upload-field";
import { updatePetPhoto, updatePetDocument, removePetDocument } from "@/lib/actions/pets";

/**
 * Upload real de foto e carteira de vacinação/documento do pet (seção
 * 6.2). Cada upload salva imediatamente — diferente do formulário de
 * texto (PetProfileSection), que só salva ao confirmar.
 */
export function PetMediaSection({
  petId,
  photoUrl,
  documentUrl,
}: {
  petId: string;
  photoUrl: string | null;
  /** Caminho no bucket privado `pet-documents`, não URL pública. */
  documentUrl: string | null;
}) {
  const [error, setError] = useState<string | null>(null);
  const [documentPath, setDocumentPath] = useState(documentUrl);
  const [isRemoving, setIsRemoving] = useState(false);

  async function handlePhotoUploaded(url: string) {
    const result = await updatePetPhoto(petId, url);
    if (result?.error) setError(result.error);
  }

  async function handleDocumentUploaded(path: string) {
    const result = await updatePetDocument(petId, path);
    if (result?.error) {
      setError(result.error);
      return;
    }
    setDocumentPath(path);
  }

  async function handleViewDocument() {
    if (!documentPath) return;
    const supabase = createClient();
    const { data, error: signError } = await supabase.storage
      .from("pet-documents")
      .createSignedUrl(documentPath, 60);
    if (signError || !data?.signedUrl) {
      setError("Não foi possível abrir o documento.");
      return;
    }
    window.open(data.signedUrl, "_blank", "noopener,noreferrer");
  }

  async function handleRemoveDocument() {
    setIsRemoving(true);
    try {
      const result = await removePetDocument(petId);
      if (result?.error) {
        setError(result.error);
        return;
      }
      setDocumentPath(null);
    } finally {
      setIsRemoving(false);
    }
  }

  return (
    <div className="flex flex-col gap-4 rounded-lg border border-gray-200 bg-white p-4">
      <div>
        <p className="text-sm font-semibold text-black mb-2">Foto do pet</p>
        <FileUploadField
          bucket="pet-photos"
          pathPrefix={petId}
          accept="image/*"
          currentUrl={photoUrl}
          buttonLabel={photoUrl ? "Trocar foto" : "Enviar foto"}
          onUploaded={handlePhotoUploaded}
        />
      </div>

      <div>
        <p className="text-sm font-semibold text-black mb-2">Carteira de vacinação / documento</p>

        {documentPath && (
          <div className="flex items-center gap-3 mb-2">
            <span className="flex items-center gap-1 text-xs text-gray-600">
              <FileText size={14} /> Documento enviado
            </span>
            <button
              type="button"
              onClick={handleViewDocument}
              className="flex items-center gap-1 text-xs font-semibold text-teal hover:underline"
            >
              <Eye size={14} /> Visualizar
            </button>
            <button
              type="button"
              onClick={handleRemoveDocument}
              disabled={isRemoving}
              className="flex items-center gap-1 text-xs font-semibold text-red-600 hover:underline disabled:opacity-60"
            >
              <Trash2 size={14} /> {isRemoving ? "Removendo..." : "Remover"}
            </button>
          </div>
        )}

        <FileUploadField
          bucket="pet-documents"
          pathPrefix={petId}
          accept="image/*,.pdf"
          isPrivateBucket
          currentUrl={null}
          buttonLabel={documentPath ? "Enviar outro documento" : "Enviar documento"}
          onUploaded={handleDocumentUploaded}
        />
        <p className="text-xs text-gray-500 mt-1">
          Só PDF ou imagem. Visível só para você, os co-tutores, o profissional contratado e o suporte.
        </p>
      </div>

      {error && <p className="text-xs text-red-600" role="alert">{error}</p>}
    </div>
  );
}
