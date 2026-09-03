"use client";

import { useState } from "react";
import { confirmPaymentManually } from "@/lib/actions/admin";

/**
 * ⚠️ Mecanismo temporário de beta fechado, sem Onda 3 (financeiro real)
 * ainda existir — ver comentário em lib/actions/admin.ts:confirmPaymentManually.
 * Só aparece pro Admin quando a solicitação está "aguardando_pagamento".
 */
export function ConfirmPaymentButton({ requestId }: { requestId: string }) {
  const [confirming, setConfirming] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [done, setDone] = useState(false);

  async function handleConfirm() {
    setError(null);
    setIsSubmitting(true);
    const result = await confirmPaymentManually(requestId);
    setIsSubmitting(false);
    if (result?.error) {
      setError(result.error);
      return;
    }
    setDone(true);
  }

  if (done) {
    return (
      <p className="text-sm font-semibold text-teal bg-teal/10 rounded-lg px-3 py-2">
        Pagamento confirmado manualmente — a solicitação avançou.
      </p>
    );
  }

  return (
    <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 flex flex-col gap-2">
      <p className="text-xs text-amber-900">
        <strong>Beta:</strong> ainda não há cobrança real (Onda 3). Confirme só depois de
        checar que o pagamento foi combinado por fora entre as partes.
      </p>
      {error && (
        <p role="alert" className="text-sm text-red-600">
          {error}
        </p>
      )}
      {!confirming ? (
        <button
          type="button"
          onClick={() => setConfirming(true)}
          className="self-start text-sm font-semibold text-amber-900 underline underline-offset-2"
        >
          Confirmar pagamento manualmente
        </button>
      ) : (
        <div className="flex gap-2">
          <button
            type="button"
            onClick={handleConfirm}
            disabled={isSubmitting}
            className="flex-1 rounded-lg bg-teal px-3 py-2 text-sm font-semibold text-white disabled:opacity-60"
          >
            {isSubmitting ? "Confirmando..." : "Sim, já foi pago"}
          </button>
          <button
            type="button"
            onClick={() => setConfirming(false)}
            className="flex-1 rounded-lg border border-gray-300 px-3 py-2 text-sm text-black"
          >
            Voltar
          </button>
        </div>
      )}
    </div>
  );
}
