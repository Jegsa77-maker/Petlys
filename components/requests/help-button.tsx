"use client";

import { useState } from "react";
import { openIncident, appealIncident } from "@/lib/actions/incidents";
import { INCIDENT_TYPE_OPTIONS, incidentTypeLabel } from "@/lib/domain/incident-types";

const INCIDENT_STATUS_LABEL: Record<string, string> = {
  aberto: "Aberto",
  em_analise: "Em análise pelo suporte",
  escalado: "Escalado pro Administrador",
  resolvido: "Resolvido",
};

type IncidentSummary = {
  id: string;
  type: string;
  status: string;
  description: string;
  resolution: string | null;
};

/**
 * Botão "Preciso de ajuda" (seção 8.2) + apelação de um incidente já
 * resolvido (seção 12.3, item 3 da Onda 4 — "disputas e apelação").
 * `currentIncident` é o incidente ainda ABERTO desta solicitação (bloqueia
 * abrir um segundo); `lastResolvedIncident` é o último já resolvido — só
 * aparece quando não há nenhum em aberto, com opção de apelar (reabre pro
 * Administrador, não pra fila normal — apelação já é segunda instância).
 */
export function HelpButton({
  requestId,
  occurrenceId,
  currentIncident,
  lastResolvedIncident,
}: {
  requestId: string;
  occurrenceId?: string;
  currentIncident: IncidentSummary | null;
  lastResolvedIncident?: IncidentSummary | null;
}) {
  const [isOpen, setIsOpen] = useState(false);
  const [type, setType] = useState("");
  const [description, setDescription] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const [isAppealing, setIsAppealing] = useState(false);
  const [appealReason, setAppealReason] = useState("");
  const [appealSent, setAppealSent] = useState(false);
  const [appealError, setAppealError] = useState<string | null>(null);
  const [isAppealSubmitting, setIsAppealSubmitting] = useState(false);

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

  async function handleAppeal(e: React.FormEvent, incidentId: string) {
    e.preventDefault();
    setAppealError(null);
    setIsAppealSubmitting(true);
    const result = await appealIncident(incidentId, appealReason);
    setIsAppealSubmitting(false);

    if (result?.error) {
      setAppealError(result.error);
      return;
    }
    setAppealSent(true);
    setIsAppealing(false);
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

  return (
    <div className="flex flex-col gap-2">
      {!isOpen ? (
        <button
          type="button"
          onClick={() => setIsOpen(true)}
          className="text-xs font-semibold text-red-700 hover:underline w-fit"
        >
          Preciso de ajuda
        </button>
      ) : (
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
      )}

      {lastResolvedIncident && !appealSent && (
        <div className="rounded-lg border border-gray-200 bg-white p-3">
          <div className="flex items-center justify-between mb-1">
            <p className="text-xs font-semibold text-black">
              Último incidente: {incidentTypeLabel(lastResolvedIncident.type)}
            </p>
            <span className="text-xs font-semibold text-gray-500 bg-gray px-2 py-0.5 rounded-full">Resolvido</span>
          </div>
          {lastResolvedIncident.resolution && (
            <p className="text-xs text-gray-500 mb-2">
              <span className="font-semibold">Resposta do suporte:</span> {lastResolvedIncident.resolution}
            </p>
          )}
          {!isAppealing ? (
            <button
              type="button"
              onClick={() => setIsAppealing(true)}
              className="text-xs font-semibold text-teal hover:underline"
            >
              Não concordo com essa resolução — apelar
            </button>
          ) : (
            <form
              onSubmit={(e) => handleAppeal(e, lastResolvedIncident.id)}
              className="flex flex-col gap-2 mt-1"
            >
              <textarea
                value={appealReason}
                onChange={(e) => setAppealReason(e.target.value)}
                placeholder="Por que você discorda dessa resolução?"
                rows={2}
                className="input text-xs"
              />
              <div className="flex gap-2">
                <button
                  type="submit"
                  disabled={isAppealSubmitting}
                  className="flex-1 rounded-lg border border-teal px-3 py-1.5 text-xs font-semibold text-teal hover:bg-teal/5 disabled:opacity-60"
                >
                  {isAppealSubmitting ? "Enviando..." : "Enviar apelação pro Administrador"}
                </button>
                <button
                  type="button"
                  onClick={() => setIsAppealing(false)}
                  className="rounded-lg border border-gray-300 px-3 py-1.5 text-xs font-semibold text-gray-600"
                >
                  Cancelar
                </button>
              </div>
              {appealError && <p className="text-xs text-red-600" role="alert">{appealError}</p>}
            </form>
          )}
        </div>
      )}

      {appealSent && (
        <p className="text-xs text-teal font-semibold">
          Apelação enviada — o Administrador vai revisar o caso.
        </p>
      )}
    </div>
  );
}
