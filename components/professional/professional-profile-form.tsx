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
    formation: string;
    socialUrl: string;
    professionalName: string;
    visitaInicialEnabled: boolean;
    visitaInicialPrice: string;
    visitaInicialDurationMinutes: string;
    visitaInicialModality: string;
    visitaInicialDeductible: boolean;
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

    // Campos numéricos opcionais: string vazia precisa virar `undefined`
    // antes do parse — z.coerce.number() transforma "" em 0, que quebra
    // .positive() mesmo o campo sendo opcional (mesmo ajuste já usado em
    // ServiceForm.handleSubmit).
    const sanitized = {
      ...values,
      experienceYears: values.experienceYears || undefined,
      visitaInicialPrice: values.visitaInicialPrice || undefined,
      visitaInicialDurationMinutes: values.visitaInicialDurationMinutes || undefined,
      visitaInicialModality: values.visitaInicialModality || undefined,
    };
    const parsed = professionalProfileSchema.safeParse(sanitized);
    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message ?? "Verifique os dados informados");
      return;
    }

    setIsSubmitting(true);
    const result = await upsertProfessionalProfile(sanitized);
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
        <label className="block text-sm font-medium text-black mb-1">Nome profissional</label>
        <input
          value={values.professionalName}
          onChange={(e) => setField("professionalName", e.target.value)}
          placeholder="Ex: Dra. Ana — se diferente do nome da sua conta"
          className="input"
        />
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

      <div>
        <label className="block text-sm font-medium text-black mb-1">Formação</label>
        <textarea
          value={values.formation}
          onChange={(e) => setField("formation", e.target.value)}
          placeholder="Cursos, formação e especialidades — ex: Técnica veterinária; curso de primeiros socorros pet"
          rows={2}
          className="input"
        />
      </div>

      <div>
        <label className="block text-sm font-medium text-black mb-1">Instagram / site</label>
        <input
          value={values.socialUrl}
          onChange={(e) => setField("socialUrl", e.target.value)}
          placeholder="https://instagram.com/seuperfil"
          className="input"
        />
      </div>

      <div className="rounded-lg border border-gray-200 p-3">
        <label className="flex items-center gap-2 text-sm font-medium text-black mb-2">
          <input
            type="checkbox"
            checked={values.visitaInicialEnabled}
            onChange={(e) => setField("visitaInicialEnabled", e.target.checked)}
            className="h-4 w-4 accent-teal"
          />
          Ofereço visita inicial
        </label>
        {values.visitaInicialEnabled && (
          <div className="flex flex-col gap-2">
            <input
              type="number"
              step="0.01"
              min={0}
              value={values.visitaInicialPrice}
              onChange={(e) => setField("visitaInicialPrice", e.target.value)}
              placeholder="Preço (R$) — deixe em branco pra ser gratuita"
              className="input"
            />
            <input
              type="number"
              min={1}
              value={values.visitaInicialDurationMinutes}
              onChange={(e) => setField("visitaInicialDurationMinutes", e.target.value)}
              placeholder="Duração (minutos)"
              className="input"
            />
            <select
              value={values.visitaInicialModality}
              onChange={(e) => setField("visitaInicialModality", e.target.value)}
              className="input"
            >
              <option value="">Modalidade</option>
              <option value="presencial">Presencial</option>
              <option value="online">Online</option>
            </select>
            <label className="flex items-center gap-2 text-xs text-black">
              <input
                type="checkbox"
                checked={values.visitaInicialDeductible}
                onChange={(e) => setField("visitaInicialDeductible", e.target.checked)}
                className="h-4 w-4 accent-teal"
              />
              Abater o valor da visita do atendimento principal, se o Tutor contratar
            </label>
          </div>
        )}
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
