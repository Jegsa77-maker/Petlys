"use client";

import { useState } from "react";
import { FileUploadField } from "@/components/shared/file-upload-field";
import { updateTutorAvatar } from "@/lib/actions/tutor-profile";

export function AvatarForm({ profileId, currentUrl }: { profileId: string; currentUrl: string | null }) {
  const [avatarUrl, setAvatarUrl] = useState(currentUrl);
  const [error, setError] = useState<string | null>(null);

  async function handleUploaded(url: string) {
    setError(null);
    const result = await updateTutorAvatar(url);
    if (result?.error) {
      setError(result.error);
      return;
    }
    setAvatarUrl(url);
  }

  return (
    <div className="rounded-lg border border-gray-200 bg-white p-4">
      <p className="text-sm font-semibold text-black mb-2">Foto de perfil</p>
      <FileUploadField
        bucket="avatars"
        pathPrefix={profileId}
        accept="image/*"
        currentUrl={avatarUrl}
        buttonLabel={avatarUrl ? "Trocar foto" : "Enviar foto"}
        onUploaded={handleUploaded}
      />
      {error && <p className="text-xs text-red-600 mt-1" role="alert">{error}</p>}
    </div>
  );
}
