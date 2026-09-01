"use client";

import { useState } from "react";
import { FileUploadField } from "@/components/shared/file-upload-field";
import { updatePetPhoto, updatePetDocument } from "@/lib/actions/pets";

/**
 * Upload real de foto e carteira de vacinação/documento do pet (seção
 * 6.2). Cada upload salva imediatamente — diferente do formulário de
 * texto (PetProfileSection), que só salva ao confirmar.
 */
export function PetMediaSection({
  petId,
  photoUrl,
  hasDocument,
}: {
  petId: string;
  photoUrl: string | null;
  hasDocument: boolean;
}) {
  const [error, setError] = useState<string | null>(null);
  const [documentSaved, setDocumentSaved] = useState(hasDocument);

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
    setDocumentSaved(true);
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
        <FileUploadField
          bucket="pet-documents"
          pathPrefix={petId}
          accept="image/*,.pdf"
          isPrivateBucket
          currentUrl={documentSaved ? "enviado" : null}
          currentLabel="Documento enviado"
          buttonLabel={documentSaved ? "Enviar outro documento" : "Enviar documento"}
          onUploaded={handleDocumentUploaded}
        />
        <p className="text-xs text-gray-500 mt-1">
          Visível só para você, os co-tutores, o profissional contratado e o suporte.
        </p>
      </div>

      {error && <p className="text-xs text-red-600" role="alert">{error}</p>}
    </div>
  );
}
