"use client";

import { useState } from "react";
import Link from "next/link";
import { MessageCircle } from "lucide-react";
import { takeIncident, escalateIncident } from "@/lib/actions/supervisor";
import { resolveIncident } from "@/lib/actions/admin";

type Incident = {
  id: string;
  type: string;
  status: string;
  created_at: string;
  request_id: string;
};

export function IncidentQueue({
  incidents,
  viewerIsAdmin,
}: {
  incidents: Incident[];
  viewerIsAdmin: boolean;
}) {
  return (
    <ul className="flex flex-col gap-3">
      {incidents.map((incident) => (
        <IncidentRow key={incident.id} incident={incident} viewerIsAdmin={viewerIsAdmin} />
      ))}
    </ul>
  );
}

function IncidentRow({ incident, viewerIsAdmin }: { incident: Incident; viewerIsAdmin: boolean }) {
  const [status, setStatus] = useState(incident.status);
  const [resolution, setResolution] = useState("");
  const [showResolveForm, setShowResolveForm] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleTake() {
    setIsSubmitting(true);
    const result = await takeIncident(incident.id);
    setIsSubmitting(false);
    if (result?.error) setError(result.error);
    else setStatus("em_analise");
  }

  async function handleEscalate() {
    setIsSubmitting(true);
    const result = await escalateIncident(incident.id);
    setIsSubmitting(false);
    if (result?.error) setError(result.error);
    else setStatus("escalado");
  }

  async function handleResolve(e: React.FormEvent) {
    e.preventDefault();
    if (!resolution.trim()) return;
    setIsSubmitting(true);
    const result = await resolveIncident(incident.id, resolution);
    setIsSubmitting(false);
    if (result?.error) setError(result.error);
    else setStatus("resolvido");
  }

  return (
    <li className="rounded-lg border border-gray-200 bg-white p-4">
      <div className="flex items-center justify-between mb-1">
        <p className="text-sm font-semibold text-black capitalize">{incident.type.replace(/_/g, " ")}</p>
        <span className="text-xs font-semibold text-teal bg-teal/10 px-2 py-1 rounded-full capitalize">
          {status.replace(/_/g, " ")}
        </span>
      </div>
      <p className="text-xs text-gray-400 mb-3">
        Aberto em {new Date(incident.created_at).toLocaleString("pt-BR")}
      </p>

      {error && <p className="text-sm text-red-600 mb-2" role="alert">{error}</p>}

      <div className="flex gap-2 flex-wrap">
        <Link
          href={`/solicitacoes/${incident.request_id}`}
          className="flex items-center gap-1 text-xs font-semibold rounded-lg border border-gray-300 text-black px-3 py-2 hover:border-teal"
        >
          <MessageCircle size={14} /> Entrar na conversa
        </Link>
        {status === "aberto" && (
          <button
            onClick={handleTake}
            disabled={isSubmitting}
            className="text-xs font-semibold rounded-lg bg-teal text-white px-3 py-2 hover:opacity-90 disabled:opacity-60"
          >
            Assumir caso
          </button>
        )}
        {status === "em_analise" && (
          <button
            onClick={handleEscalate}
            disabled={isSubmitting}
            className="text-xs font-semibold rounded-lg border border-teal text-teal px-3 py-2 hover:bg-teal/5 disabled:opacity-60"
          >
            Escalar para Admin
          </button>
        )}
        {viewerIsAdmin && status !== "resolvido" && !showResolveForm && (
          <button
            onClick={() => setShowResolveForm(true)}
            className="text-xs font-semibold rounded-lg bg-black text-white px-3 py-2 hover:opacity-90"
          >
            Encerrar incidente
          </button>
        )}
      </div>

      {showResolveForm && (
        <form onSubmit={handleResolve} className="flex flex-col gap-2 mt-3">
          <textarea
            value={resolution}
            onChange={(e) => setResolution(e.target.value)}
            placeholder="Descreva a solução e o impacto financeiro, se houver"
            rows={2}
            className="input text-xs"
          />
          <button
            type="submit"
            disabled={isSubmitting}
            className="text-xs font-semibold rounded-lg bg-teal text-white px-3 py-2 hover:opacity-90 disabled:opacity-60"
          >
            Confirmar encerramento
          </button>
        </form>
      )}
    </li>
  );
}
