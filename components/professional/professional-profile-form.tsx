"use client";

import { useState } from "react";
import { upsertProfessionalProfile } from "@/lib/actions/professional-profile";
import { professionalProfileSchema } from "@/lib/validations/professional-profile";
import { FileUploadField } from "@/components/shared/file-upload-field";

export function ProfessionalProfileForm({
  profileId,
  initial,
}: {
  profileId: string;
  initial: {
    bio: string;
    experienceYears: string;
    specializations: string;
    languages: string;
    policies: string;
    avatarUrl: string;
  };
}) {
  const [values, setValues] = useState(initial);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  function setField<K extends keyof typeof values>(key: K, value: (typeof values)[K]) {
    setValues((prev) => ({ ...prev, [key]: value }));
    setSuccess(false);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    const parsed = professionalProfileSchema.safeParse(values);
    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message ?? "Verifique os dados informados");
      return;
    }

    setIsSubmitting(true);
    const result = await upsertProfessionalProfile(values);
    setIsSubmitting(false);

    if (result?.error) {
      setError(result.error);
      return;
    }
    setSuccess(true);
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4">
      <div>
        <label className="block text-sm font-medium text-black mb-1">Foto de perfil</label>
        <FileUploadField
          bucket="avatars"
          pathPrefix={profileId}
          accept="image/*"
          currentUrl={values.avatarUrl || undefined}
          buttonLabel={values.avatarUrl ? "Trocar foto" : "Enviar foto"}
          onUploaded={(url) => setField("avatarUrl", url)}
        />
        <p className="text-xs text-gray-500 mt-1">
          Clique em &quot;Salvar perfil&quot; depois de enviar pra confirmar.
        </p>
      </div>

      <div>
        <label className="block text-sm font-medium text-black mb-1">Apresentação</label>
        <textarea
          value={values.bio}
          onChange={(e) => setField("bio", e.target.value)}
          placeholder="Conte sua experiência, o que te diferencia, como você trabalha..."
          rows={4}
          className="input"
        />
      </div>

      <div>
        <label className="block text-sm font-medium text-black mb-1">Anos de experiência</label>
        <input
          type="number"
          min={0}
          value={values.experienceYears}
          onChange={(e) => setField("experienceYears", e.target.value)}
          className="input"
        />
      </div>

      <div>
        <label className="block text-sm font-medium text-black mb-1">Especializações</label>
        <input
          value={values.specializations}
          onChange={(e) => setField("specializations", e.target.value)}
          placeholder="Ex: cães idosos, adestramento positivo, filhotes"
          className="input"
        />
        <p className="text-xs text-gray-500 mt-1">Separe por vírgula.</p>
      </div>

      <div>
        <label className="block text-sm font-medium text-black mb-1">Idiomas</label>
        <input
          value={values.languages}
          onChange={(e) => setField("languages", e.target.value)}
          placeholder="Ex: Português, Inglês"
          className="input"
        />
        <p className="text-xs text-gray-500 mt-1">Separe por vírgula.</p>
      </div>

      <div>
        <label className="block text-sm font-medium text-black mb-1">Políticas</label>
        <textarea
          value={values.policies}
          onChange={(e) => setField("policies", e.target.value)}
          placeholder="Regras próprias que o Tutor deve saber antes de contratar (cancelamento, atraso, etc.)"
          rows={3}
          className="input"
        />
      </div>

      {error && <p className="text-sm text-red-600" role="alert">{error}</p>}
      {success && <p className="text-sm text-teal">Perfil salvo!</p>}

      <button
        type="submit"
        disabled={isSubmitting}
        className="w-full rounded-lg bg-teal px-4 py-3 text-sm font-semibold text-white hover:opacity-90 disabled:opacity-60"
      >
        {isSubmitting ? "Salvando..." : "Salvar perfil"}
      </button>
    </form>
  );
}
