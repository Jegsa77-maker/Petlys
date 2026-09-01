"use client";

import { useState } from "react";
import Link from "next/link";
import { MessageCircle } from "lucide-react";
import { setMessageHidden, setReviewHidden, dismissMessageFlag, dismissReviewFlag } from "@/lib/actions/moderation";

type FlaggedMessage = {
  id: string;
  content: string;
  flagged_reason: string | null;
  created_at: string;
  request_id: string;
};

type FlaggedReview = {
  id: string;
  comment: string | null;
  flagged_reason: string | null;
  request_id: string;
};

/**
 * Fila de moderação (seção 12.3, item 4 da Onda 4) — mensagens e
 * avaliações sinalizadas por uma das partes, aguardando decisão do
 * Admin/Supervisor: ocultar ou manter.
 */
export function ModerationQueue({
  messages,
  reviews,
}: {
  messages: FlaggedMessage[];
  reviews: FlaggedReview[];
}) {
  if (messages.length === 0 && reviews.length === 0) {
    return <p className="text-sm text-gray-400">Nenhum conteúdo sinalizado no momento.</p>;
  }

  return (
    <div className="flex flex-col gap-6">
      {messages.length > 0 && (
        <section>
          <h2 className="text-sm font-semibold text-black mb-3">Mensagens sinalizadas</h2>
          <ul className="flex flex-col gap-3">
            {messages.map((m) => (
              <ModerationRow
                key={m.id}
                content={m.content}
                reason={m.flagged_reason}
                requestId={m.request_id}
                onHide={() => setMessageHidden(m.id, true)}
                onDismiss={() => dismissMessageFlag(m.id)}
              />
            ))}
          </ul>
        </section>
      )}

      {reviews.length > 0 && (
        <section>
          <h2 className="text-sm font-semibold text-black mb-3">Avaliações sinalizadas</h2>
          <ul className="flex flex-col gap-3">
            {reviews.map((r) => (
              <ModerationRow
                key={r.id}
                content={r.comment ?? "(sem comentário)"}
                reason={r.flagged_reason}
                requestId={r.request_id}
                onHide={() => setReviewHidden(r.id, true)}
                onDismiss={() => dismissReviewFlag(r.id)}
              />
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}

function ModerationRow({
  content,
  reason,
  requestId,
  onHide,
  onDismiss,
}: {
  content: string;
  reason: string | null;
  requestId: string;
  onHide: () => Promise<{ error: string | null }>;
  onDismiss: () => Promise<{ error: string | null }>;
}) {
  const [resolved, setResolved] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleHide() {
    setIsSubmitting(true);
    const result = await onHide();
    setIsSubmitting(false);
    if (result?.error) setError(result.error);
    else setResolved(true);
  }

  async function handleDismiss() {
    setIsSubmitting(true);
    const result = await onDismiss();
    setIsSubmitting(false);
    if (result?.error) setError(result.error);
    else setResolved(true);
  }

  if (resolved) return null;

  return (
    <li className="rounded-lg border border-gray-200 bg-white p-4">
      <p className="text-sm text-black mb-1">{content}</p>
      <p className="text-xs text-red-700 mb-3">Motivo: {reason}</p>
      {error && <p className="text-xs text-red-600 mb-2" role="alert">{error}</p>}
      <div className="flex gap-2 flex-wrap">
        <Link
          href={`/solicitacoes/${requestId}`}
          className="flex items-center gap-1 text-xs font-semibold rounded-lg border border-gray-300 text-black px-3 py-2 hover:border-teal"
        >
          <MessageCircle size={14} /> Ver contexto
        </Link>
        <button
          onClick={handleHide}
          disabled={isSubmitting}
          className="text-xs font-semibold rounded-lg bg-black text-white px-3 py-2 hover:opacity-90 disabled:opacity-60"
        >
          Ocultar
        </button>
        <button
          onClick={handleDismiss}
          disabled={isSubmitting}
          className="text-xs font-semibold rounded-lg border border-gray-300 text-gray-600 px-3 py-2 hover:border-teal disabled:opacity-60"
        >
          Manter (descartar sinalização)
        </button>
      </div>
    </li>
  );
}
