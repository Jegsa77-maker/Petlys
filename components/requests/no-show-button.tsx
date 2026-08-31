"use client";

import { useState } from "react";
import { reportNoShow } from "@/lib/actions/no-show";

export function NoShowButton({
  requestId,
  occurrenceId,
  viewerRole,
}: {
  requestId: string;
  occurrenceId: string;
  viewerRole: "tutor" | "profissional";
}) {
  const [showForm, setShowForm] = useState(false);
  const [minWaitConfirmed, setMinWaitConfirmed] = useState(false);
  const [checkinConfirmed, setCheckinConfirmed] = useState(false);
  const [contactAttemptConfirmed, setContactAttemptConfirmed] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [sent, setSent] = useState(false);

  // Quem relata sempre aponta o não comparecimento da OUTRA parte.
  const reportedParty = viewerRole === "tutor" ? "profissional" : "tutor";

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setIsSubmitting(true);
    const result = await reportNoShow({
      requestId,
      occurrenceId,
      reportedParty,
      minWaitConfirmed,
      checkinConfirmed,
      contactAttemptConfirmed,
    });
    setIsSubmitting(false);
    if (result?.error) {
      setError(result.error);
      return;
    }
    setSent(true);
  }

  if (sent) {
    return <p className="text-xs text-teal">Não comparecimento registrado.</p>;
  }

  if (!showForm) {
    return (
      <button
        type="button"
        onClick={() => setShowForm(true)}
        className="text-xs text-gray-500 hover:text-red-600 underline underline-offset-2"
      >
        Reportar não comparecimento
      </button>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-2 rounded-lg border border-gray-200 bg-white p-3">
      <p className="text-xs text-gray-500">
        As três evidências abaixo são obrigatórias, conforme a política da plataforma.
      </p>
      <label className="flex items-center gap-2 text-xs text-black">
        <input type="checkbox" checked={minWaitConfirmed} onChange={(e) => setMinWaitConfirmed(e.target.checked)} className="h-4 w-4 accent-teal" />
        Aguardei o tempo mínimo estabelecido
      </label>
      <label className="flex items-center gap-2 text-xs text-black">
        <input type="checkbox" checked={checkinConfirmed} onChange={(e) => setCheckinConfirmed(e.target.checked)} className="h-4 w-4 accent-teal" />
        Fiz check-in no local (com geolocalização, quando disponível)
      </label>
      <label className="flex items-center gap-2 text-xs text-black">
        <input type="checkbox" checked={contactAttemptConfirmed} onChange={(e) => setContactAttemptConfirmed(e.target.checked)} className="h-4 w-4 accent-teal" />
        Tentei contato pelo chat da plataforma
      </label>
      {error && <p className="text-sm text-red-600" role="alert">{error}</p>}
      <button
        type="submit"
        disabled={isSubmitting}
        className="rounded-lg bg-red-600 px-3 py-2 text-xs font-semibold text-white hover:opacity-90 disabled:opacity-60"
      >
        {isSubmitting ? "Registrando..." : "Confirmar não comparecimento"}
      </button>
    </form>
  );
}
