"use client";

import { useState } from "react";
import { declineRequest } from "@/lib/actions/requests";

export function DeclineRequestButton({ requestId }: { requestId: string }) {
  const [showReason, setShowReason] = useState(false);
  const [reason, setReason] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleDecline() {
    setError(null);
    setIsSubmitting(true);
    const result = await declineRequest(requestId, reason || undefined);
    setIsSubmitting(false);
    if (result?.error) setError(result.error);
  }

  if (!showReason) {
    return (
      <button
        type="button"
        onClick={() => setShowReason(true)}
        className="text-sm text-gray-500 hover:text-red-600 underline underline-offset-2"
      >
        Recusar solicitação
      </button>
    );
  }

  return (
    <div className="flex flex-col gap-2 rounded-lg border border-gray-200 bg-white p-3">
      <p className="text-xs text-gray-500">
        Recusar é sem penalidade e sem impacto no seu ranking. Justificativa é opcional.
      </p>
      <input
        value={reason}
        onChange={(e) => setReason(e.target.value)}
        placeholder="Motivo (opcional)"
        className="input"
      />
      {error && <p className="text-sm text-red-600" role="alert">{error}</p>}
      <div className="flex gap-2">
        <button
          type="button"
          onClick={handleDecline}
          disabled={isSubmitting}
          className="flex-1 rounded-lg bg-red-600 px-3 py-2 text-sm font-semibold text-white hover:opacity-90 disabled:opacity-60"
        >
          {isSubmitting ? "Recusando..." : "Confirmar recusa"}
        </button>
        <button
          type="button"
          onClick={() => setShowReason(false)}
          className="flex-1 rounded-lg border border-gray-300 px-3 py-2 text-sm text-black"
        >
          Voltar
        </button>
      </div>
    </div>
  );
}
