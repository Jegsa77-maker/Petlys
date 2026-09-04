"use client";

import { useState, useEffect } from "react";
import { declineRequest, listEligibleColleagues } from "@/lib/actions/requests";
import type { ServiceCategory } from "@/types/database";

type Colleague = { id: string; fullName: string; avatarUrl: string | null };

export function DeclineRequestButton({
  requestId,
  category,
  professionalId,
}: {
  requestId: string;
  category: ServiceCategory;
  professionalId: string;
}) {
  const [showReason, setShowReason] = useState(false);
  const [reason, setReason] = useState("");
  const [colleagues, setColleagues] = useState<Colleague[]>([]);
  const [referredId, setReferredId] = useState<string>("");
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (!showReason) return;
    listEligibleColleagues(category, professionalId).then(setColleagues);
  }, [showReason, category, professionalId]);

  async function handleDecline() {
    setError(null);
    setIsSubmitting(true);
    const result = await declineRequest({
      requestId,
      reason: reason || undefined,
      referredProfessionalId: referredId || undefined,
    });
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
      {colleagues.length > 0 && (
        <div>
          <label className="block text-xs font-medium text-black mb-1">
            Indicar um colega (opcional)
          </label>
          <select
            value={referredId}
            onChange={(e) => setReferredId(e.target.value)}
            className="input"
          >
            <option value="">Não indicar ninguém</option>
            {colleagues.map((c) => (
              <option key={c.id} value={c.id}>
                {c.fullName}
              </option>
            ))}
          </select>
        </div>
      )}
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
