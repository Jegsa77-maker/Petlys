"use client";

import { useState } from "react";
import { rescheduleOccurrence } from "@/lib/actions/requests";

/**
 * Reagendar uma ocorrência específica (seção 12.1, item 7) — nunca
 * bloqueia: qualquer parte pode propor uma nova data, sem depender de
 * aprovação prévia. Combinação fina de horário continua podendo ser feita
 * pelo chat, isto aqui só grava a data acordada.
 */
export function RescheduleOccurrenceButton({ occurrenceId }: { occurrenceId: string }) {
  const [isOpen, setIsOpen] = useState(false);
  const [newDate, setNewDate] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setIsSubmitting(true);
    const result = await rescheduleOccurrence({ occurrenceId, newScheduledAt: newDate });
    setIsSubmitting(false);
    if (result?.error) {
      setError(result.error);
      return;
    }
    setIsOpen(false);
  }

  if (!isOpen) {
    return (
      <button
        type="button"
        onClick={() => setIsOpen(true)}
        className="text-xs font-semibold text-teal hover:underline"
      >
        Reagendar
      </button>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-2 mt-2">
      <input
        type="datetime-local"
        value={newDate}
        onChange={(e) => setNewDate(e.target.value)}
        className="input"
      />
      <div className="flex gap-2">
        <button
          type="submit"
          disabled={isSubmitting}
          className="flex-1 rounded-lg bg-teal px-3 py-1.5 text-xs font-semibold text-white hover:opacity-90 disabled:opacity-60"
        >
          {isSubmitting ? "Salvando..." : "Confirmar nova data"}
        </button>
        <button
          type="button"
          onClick={() => setIsOpen(false)}
          className="rounded-lg border border-gray-300 px-3 py-1.5 text-xs font-semibold text-gray-600"
        >
          Cancelar
        </button>
      </div>
      {error && <p className="text-xs text-red-600" role="alert">{error}</p>}
    </form>
  );
}
