"use client";

import { useState } from "react";
import { openIncident } from "@/lib/actions/incidents";
import { INCIDENT_TYPE_OPTIONS, incidentTypeLabel } from "@/lib/domain/incident-types";

const INCIDENT_STATUS_LABEL: Record<string, string> = {
  aberto: "Aberto",
  em_analise: "Em análise pelo suporte",
  escalado: "Escalado pro Administrador",
  resolvido: "Resolvido",
};

type CurrentIncident = {
  id: string;
  type: string;
  status: string;
  description: string;
  resolution: string | null;
} | null;

/**
 * Botão "Preciso de ajuda" (seção 8.2 da Especificação v2.0, item 2 da
 * Onda 4). Enquanto houver um incidente em aberto pra esta solicitação,
 * mostra o acompanhamento em vez do botão — evita abrir dois incidentes
 * pro mesmo problema. A urgência não é escolhida aqui: o tipo já define
 * ela (defaultUrgencyForType, na Server Action).
 */
export function HelpButton({
  requestId,
  occurrenceId,
  currentIncident,
}: {
  requestId: string;
  occurrenceId?: string;
  currentIncident: CurrentIncident;
}) {
  const [isOpen, setIsOpen] = useState(false);
  const [type, setType] = useState("");
  const [description, setDescription] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (!type) {
      setError("Selecione o tipo do problema");
      return;
    }

    setIsSubmitting(true);
    const result = await openIncident({ requestId, occurrenceId, type, description });
    setIsSubmitting(false);

    if (result?.error) {
      setError(result.error);
      return;
    }
    setIsOpen(false);
    setType("");
    setDescription("");
  }

  if (currentIncident) {
    return (
      <div className="rounded-lg border border-red-200 bg-red-50 p-3">
        <div className="flex items-center justify-between mb-1">
          <p className="text-sm font-semibold text-black">{incidentTypeLabel(currentIncident.type)}</p>
          <span className="text-xs font-semibold text-red-700 bg-white px-2 py-0.5 rounded-full">
            {INCIDENT_STATUS_LABEL[currentIncident.status] ?? currentIncident.status}
          </span>
        </div>
        <p className="text-xs text-gray-600">{currentIncident.description}</p>
        {currentIncident.resolution && (
          <p className="text-xs text-gray-500 mt-2">
            <span className="font-semibold">Resposta do suporte:</span> {currentIncident.resolution}
          </p>
        )}
      </div>
    );
  }

  if (!isOpen) {
    return (
      <button
        type="button"
        onClick={() => setIsOpen(true)}
        className="text-xs font-semibold text-red-700 hover:underline"
      >
        Preciso de ajuda
      </button>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-2 rounded-lg border border-red-200 bg-red-50 p-3">
      <select value={type} onChange={(e) => setType(e.target.value)} className="input text-sm">
        <option value="">O que está acontecendo?</option>
        {INCIDENT_TYPE_OPTIONS.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
      <textarea
        value={description}
        onChange={(e) => setDescription(e.target.value)}
        placeholder="Conte o que aconteceu, com detalhes e horário"
        rows={3}
        className="input text-sm"
      />
      <div className="flex gap-2">
        <button
          type="submit"
          disabled={isSubmitting}
          className="flex-1 rounded-lg bg-red-700 px-3 py-1.5 text-xs font-semibold text-white hover:opacity-90 disabled:opacity-60"
        >
          {isSubmitting ? "Enviando..." : "Enviar pro suporte"}
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
