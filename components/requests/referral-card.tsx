"use client";

import { useState } from "react";
import Link from "next/link";
import { acceptReferral } from "@/lib/actions/requests";

/**
 * Aparece pro Tutor quando o Profissional recusou/cancelou e indicou um
 * colega (itens 25-26). Aceitar cria uma conversa vinculada (item 27) —
 * nunca transfere a solicitação original sozinho (item 28).
 */
export function ReferralCard({
  requestId,
  referredProfessionalName,
}: {
  requestId: string;
  referredProfessionalName: string;
}) {
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleAccept() {
    setError(null);
    setIsSubmitting(true);
    const result = await acceptReferral(requestId);
    setIsSubmitting(false);
    if (result?.error) setError(result.error);
  }

  return (
    <div className="rounded-lg border border-teal/30 bg-teal/5 p-4 flex flex-col gap-2">
      <p className="text-sm text-black">
        <strong>{referredProfessionalName}</strong> foi indicado como alternativa.
      </p>
      {error && <p role="alert" className="text-sm text-red-600">{error}</p>}
      <div className="flex flex-col gap-2 sm:flex-row">
        <button
          type="button"
          onClick={handleAccept}
          disabled={isSubmitting}
          className="flex-1 rounded-lg bg-teal px-3 py-2 text-sm font-semibold text-white disabled:opacity-60"
        >
          {isSubmitting ? "Abrindo..." : "Aceitar indicação"}
        </button>
        <Link
          href="/buscar"
          className="flex-1 text-center rounded-lg border border-gray-300 px-3 py-2 text-sm text-black"
        >
          Procurar outro profissional
        </Link>
      </div>
    </div>
  );
}
