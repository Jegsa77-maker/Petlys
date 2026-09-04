"use client";

import { useState } from "react";
import { proposeScopeChange, respondScopeChange } from "@/lib/actions/requests";

const FIELD_LABEL: Record<string, string> = {
  escopo: "Escopo",
  valor: "Valor",
  data: "Data",
};

type ScopeChange = {
  id: string;
  proposed_by: string;
  field_changed: string;
  old_value: string;
  new_value: string;
  status: string;
  created_at: string;
};

type Occurrence = { id: string; sequence_number: number; scheduled_at: string };

/**
 * Mudança de escopo/valor/data DEPOIS que a proposta já foi aceita (itens
 * 23/24 — diferente de "pedir ajuste", que só existe pré-aceite). Nunca
 * mexe no status da solicitação.
 */
export function ScopeChangePanel({
  requestId,
  currentUserId,
  scopeChanges,
  occurrences,
}: {
  requestId: string;
  currentUserId: string;
  scopeChanges: ScopeChange[];
  occurrences: Occurrence[];
}) {
  const pending = scopeChanges.find((c) => c.status === "pendente");
  const [showForm, setShowForm] = useState(false);

  return (
    <div className="rounded-lg border border-gray-200 bg-white p-4 flex flex-col gap-3">
      <h2 className="text-sm font-semibold text-black">Mudança de escopo</h2>

      {pending && (
        <PendingCard scopeChange={pending} currentUserId={currentUserId} />
      )}

      {scopeChanges.filter((c) => c.status !== "pendente").length > 0 && (
        <details className="text-xs text-gray-500">
          <summary className="cursor-pointer font-semibold text-gray-600">Histórico</summary>
          <ul className="mt-2 flex flex-col gap-1">
            {scopeChanges
              .filter((c) => c.status !== "pendente")
              .map((c) => (
                <li key={c.id}>
                  {FIELD_LABEL[c.field_changed]}: &quot;{c.old_value}&quot; → &quot;{c.new_value}&quot; —{" "}
                  {c.status === "aceito" ? "aceita" : "recusada"}
                </li>
              ))}
          </ul>
        </details>
      )}

      {!pending && !showForm && (
        <button
          type="button"
          onClick={() => setShowForm(true)}
          className="text-sm font-semibold text-teal underline underline-offset-2 self-start"
        >
          Propor mudança
        </button>
      )}
      {!pending && showForm && (
        <ProposeForm requestId={requestId} occurrences={occurrences} onDone={() => setShowForm(false)} />
      )}
    </div>
  );
}

function PendingCard({ scopeChange, currentUserId }: { scopeChange: ScopeChange; currentUserId: string }) {
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const isMine = scopeChange.proposed_by === currentUserId;

  async function respond(decision: "aceito" | "recusado") {
    setError(null);
    setIsSubmitting(true);
    const result = await respondScopeChange({ scopeChangeId: scopeChange.id, decision });
    setIsSubmitting(false);
    if (result?.error) setError(result.error);
  }

  return (
    <div className="rounded-lg bg-amber-50 border border-amber-200 p-3 flex flex-col gap-2">
      <p className="text-sm text-amber-900">
        {FIELD_LABEL[scopeChange.field_changed]}: de &quot;{scopeChange.old_value}&quot; para &quot;
        {scopeChange.new_value}&quot;
      </p>
      {error && <p role="alert" className="text-sm text-red-600">{error}</p>}
      {isMine ? (
        <p className="text-xs text-amber-800">Aguardando resposta da outra parte.</p>
      ) : (
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => respond("aceito")}
            disabled={isSubmitting}
            className="flex-1 rounded-lg bg-teal px-3 py-2 text-sm font-semibold text-white disabled:opacity-60"
          >
            Aceitar
          </button>
          <button
            type="button"
            onClick={() => respond("recusado")}
            disabled={isSubmitting}
            className="flex-1 rounded-lg border border-gray-300 px-3 py-2 text-sm text-black disabled:opacity-60"
          >
            Recusar
          </button>
        </div>
      )}
    </div>
  );
}

function ProposeForm({
  requestId,
  occurrences,
  onDone,
}: {
  requestId: string;
  occurrences: Occurrence[];
  onDone: () => void;
}) {
  const [field, setField] = useState<"escopo" | "valor" | "data">("escopo");
  const [occurrenceId, setOccurrenceId] = useState(occurrences[0]?.id ?? "");
  const [newValue, setNewValue] = useState("");
  const [newDateLocal, setNewDateLocal] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    const finalValue = field === "data" ? newDateLocal : newValue;
    if (!finalValue.trim()) {
      setError("Descreva o novo valor");
      return;
    }
    setIsSubmitting(true);
    const result = await proposeScopeChange({
      requestId,
      fieldChanged: field,
      occurrenceId: field === "data" ? occurrenceId : undefined,
      newValue: field === "data" ? new Date(finalValue).toISOString() : finalValue,
    });
    setIsSubmitting(false);
    if (result?.error) {
      setError(result.error);
      return;
    }
    onDone();
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-2">
      <select value={field} onChange={(e) => setField(e.target.value as typeof field)} className="input">
        <option value="escopo">Escopo</option>
        <option value="valor">Valor</option>
        <option value="data">Data</option>
      </select>
      {field === "data" && occurrences.length > 0 && (
        <select value={occurrenceId} onChange={(e) => setOccurrenceId(e.target.value)} className="input">
          {occurrences.map((o) => (
            <option key={o.id} value={o.id}>
              Ocorrência #{o.sequence_number} — {new Date(o.scheduled_at).toLocaleString("pt-BR")}
            </option>
          ))}
        </select>
      )}
      {field === "data" ? (
        <input
          type="datetime-local"
          value={newDateLocal}
          onChange={(e) => setNewDateLocal(e.target.value)}
          className="input"
        />
      ) : (
        <input
          value={newValue}
          onChange={(e) => setNewValue(e.target.value)}
          placeholder="Novo valor"
          className="input"
        />
      )}
      {error && <p role="alert" className="text-sm text-red-600">{error}</p>}
      <div className="flex gap-2">
        <button
          type="submit"
          disabled={isSubmitting}
          className="flex-1 rounded-lg bg-teal px-3 py-2 text-sm font-semibold text-white disabled:opacity-60"
        >
          {isSubmitting ? "Enviando..." : "Propor"}
        </button>
        <button
          type="button"
          onClick={onDone}
          className="flex-1 rounded-lg border border-gray-300 px-3 py-2 text-sm text-black"
        >
          Cancelar
        </button>
      </div>
    </form>
  );
}
