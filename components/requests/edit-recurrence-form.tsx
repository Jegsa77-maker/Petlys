"use client";

import { useState } from "react";
import { updateRecurrence } from "@/lib/actions/requests";

const INTERVAL_LABEL: Record<string, string> = {
  diario: "Todo dia",
  semanal: "Toda semana",
  quinzenal: "A cada 15 dias",
  mensal: "Todo mês",
};

/**
 * Muda a frequência de um contrato recorrente dali pra frente (seção
 * 12.1, item 7) — só afeta ocorrências ainda não executadas; o que já
 * aconteceu fica intacto (garantido pelo server action, não aqui).
 */
export function EditRecurrenceForm({
  requestId,
  currentInterval,
}: {
  requestId: string;
  currentInterval: string | null;
}) {
  const [isOpen, setIsOpen] = useState(false);
  const [newInterval, setNewInterval] = useState(currentInterval ?? "semanal");
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setIsSubmitting(true);
    const result = await updateRecurrence({ requestId, newInterval });
    setIsSubmitting(false);
    if (result?.error) {
      setError(result.error);
      return;
    }
    setSuccess(true);
    setIsOpen(false);
  }

  if (!isOpen) {
    return (
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={() => setIsOpen(true)}
          className="text-xs font-semibold text-teal hover:underline"
        >
          Editar recorrência
        </button>
        {success && <span className="text-xs text-teal">Atualizado.</span>}
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-2">
      <p className="text-xs text-gray-500">
        Vale só pras próximas ocorrências — o que já aconteceu não muda.
      </p>
      <select value={newInterval} onChange={(e) => setNewInterval(e.target.value)} className="input">
        {Object.entries(INTERVAL_LABEL).map(([value, label]) => (
          <option key={value} value={value}>{label}</option>
        ))}
      </select>
      <div className="flex gap-2">
        <button
          type="submit"
          disabled={isSubmitting}
          className="flex-1 rounded-lg bg-teal px-3 py-1.5 text-xs font-semibold text-white hover:opacity-90 disabled:opacity-60"
        >
          {isSubmitting ? "Salvando..." : "Aplicar dali pra frente"}
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
