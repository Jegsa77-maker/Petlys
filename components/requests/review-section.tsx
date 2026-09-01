"use client";

import { useState } from "react";
import { submitReview, respondToReview } from "@/lib/actions/reviews";
import { flagReview } from "@/lib/actions/moderation";

type Review = {
  id: string;
  reviewer_id: string;
  reviewee_id: string;
  rating: { qualidade: number; comunicacao: number; pontualidade: number; aderencia_combinado: number };
  comment: string | null;
  response: string | null;
  flagged_reason?: string | null;
  hidden_at?: string | null;
};

export function ReviewSection({
  requestId,
  currentUserId,
  otherPartyId,
  requestStatus,
  existingReviews,
}: {
  requestId: string;
  currentUserId: string;
  otherPartyId: string;
  requestStatus: string;
  existingReviews: Review[];
}) {
  const myReview = existingReviews.find((r) => r.reviewer_id === currentUserId);

  if (requestStatus !== "avaliacao" && requestStatus !== "concluido" && existingReviews.length === 0) {
    return null;
  }

  return (
    <div className="flex flex-col gap-4">
      {!myReview && requestStatus === "avaliacao" && (
        <ReviewForm requestId={requestId} revieweeId={otherPartyId} />
      )}

      {existingReviews.map((review) => (
        <ReviewCard
          key={review.id}
          review={review}
          requestId={requestId}
          isMine={review.reviewer_id === currentUserId}
          canRespond={review.reviewee_id === currentUserId && !review.response}
          canFlag={review.reviewee_id === currentUserId}
        />
      ))}
    </div>
  );
}

function ReviewForm({ requestId, revieweeId }: { requestId: string; revieweeId: string }) {
  const [ratings, setRatings] = useState({
    qualidade: 5,
    comunicacao: 5,
    pontualidade: 5,
    aderenciaCombinado: 5,
  });
  const [comment, setComment] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [sent, setSent] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setIsSubmitting(true);
    const result = await submitReview({
      requestId,
      revieweeId,
      ...ratings,
      comment: comment || undefined,
    });
    setIsSubmitting(false);
    if (result?.error) {
      setError(result.error);
      return;
    }
    setSent(true);
  }

  if (sent) {
    return (
      <p className="text-sm text-black bg-green inline-block px-3 py-2 rounded-lg">
        Avaliação enviada. Obrigado!
      </p>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-3 rounded-lg border border-gray-200 bg-white p-4">
      <p className="text-sm font-semibold text-black">Avaliar</p>
      {(
        [
          ["qualidade", "Qualidade"],
          ["comunicacao", "Comunicação"],
          ["pontualidade", "Pontualidade"],
          ["aderenciaCombinado", "Aderência ao combinado"],
        ] as const
      ).map(([key, label]) => (
        <StarRating
          key={key}
          label={label}
          value={ratings[key]}
          onChange={(v) => setRatings((prev) => ({ ...prev, [key]: v }))}
        />
      ))}
      <textarea
        value={comment}
        onChange={(e) => setComment(e.target.value)}
        placeholder="Comentário (opcional)"
        rows={2}
        className="input"
      />
      {error && <p className="text-sm text-red-600" role="alert">{error}</p>}
      <button
        type="submit"
        disabled={isSubmitting}
        className="rounded-lg bg-teal px-4 py-2 text-sm font-semibold text-white hover:opacity-90 disabled:opacity-60"
      >
        {isSubmitting ? "Enviando..." : "Enviar avaliação"}
      </button>
    </form>
  );
}

function StarRating({
  label,
  value,
  onChange,
}: {
  label: string;
  value: number;
  onChange: (v: number) => void;
}) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-xs text-gray-600">{label}</span>
      <div className="flex gap-1">
        {[1, 2, 3, 4, 5].map((n) => (
          <button
            key={n}
            type="button"
            onClick={() => onChange(n)}
            className={`text-lg leading-none ${n <= value ? "text-teal" : "text-gray-300"}`}
            aria-label={`${n} estrelas`}
          >
            ★
          </button>
        ))}
      </div>
    </div>
  );
}

function ReviewCard({
  review,
  requestId,
  isMine,
  canRespond,
  canFlag,
}: {
  review: Review;
  requestId: string;
  isMine: boolean;
  canRespond: boolean;
  canFlag: boolean;
}) {
  const [showRespond, setShowRespond] = useState(false);
  const [response, setResponse] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [sent, setSent] = useState(false);
  const [showFlagForm, setShowFlagForm] = useState(false);
  const [flagReason, setFlagReason] = useState("");
  const [flagged, setFlagged] = useState(!!review.flagged_reason);
  const [isFlagSubmitting, setIsFlagSubmitting] = useState(false);

  async function handleFlag(e: React.FormEvent) {
    e.preventDefault();
    if (!flagReason.trim()) return;
    setIsFlagSubmitting(true);
    const result = await flagReview(review.id, requestId, flagReason);
    setIsFlagSubmitting(false);
    if (!result?.error) {
      setFlagged(true);
      setShowFlagForm(false);
    }
  }

  const avg =
    (review.rating.qualidade +
      review.rating.comunicacao +
      review.rating.pontualidade +
      review.rating.aderencia_combinado) /
    4;

  async function handleRespond(e: React.FormEvent) {
    e.preventDefault();
    if (!response.trim()) return;
    setIsSubmitting(true);
    const result = await respondToReview({ reviewId: review.id, response });
    setIsSubmitting(false);
    if (!result?.error) setSent(true);
  }

  if (review.hidden_at) {
    return (
      <div className="rounded-lg border border-gray-200 bg-gray-50 p-4">
        <p className="text-xs font-semibold text-gray-500 mb-1">
          {isMine ? "Sua avaliação" : "Avaliação recebida"}
        </p>
        <p className="text-sm text-gray-400 italic">
          Avaliação removida pela moderação — não conta na nota média.
        </p>
      </div>
    );
  }

  return (
    <div className="rounded-lg border border-gray-200 bg-white p-4">
      <div className="flex items-center justify-between mb-1">
        <p className="text-xs font-semibold text-gray-500">
          {isMine ? "Sua avaliação" : "Avaliação recebida"}
        </p>
        <p className="text-sm font-semibold text-teal">{avg.toFixed(1)} ★</p>
      </div>
      {review.comment && <p className="text-sm text-black">{review.comment}</p>}

      {review.response && (
        <div className="mt-2 pl-3 border-l-2 border-gray-200">
          <p className="text-xs text-gray-500">Resposta</p>
          <p className="text-sm text-black">{review.response}</p>
        </div>
      )}

      {canRespond && !sent && (
        <>
          {!showRespond ? (
            <button
              onClick={() => setShowRespond(true)}
              className="text-xs text-teal font-semibold hover:underline mt-2"
            >
              Responder
            </button>
          ) : (
            <form onSubmit={handleRespond} className="flex flex-col gap-2 mt-2">
              <textarea
                value={response}
                onChange={(e) => setResponse(e.target.value)}
                placeholder="Sua resposta (não altera a nota)"
                rows={2}
                className="input text-xs"
              />
              <button
                type="submit"
                disabled={isSubmitting}
                className="text-xs font-semibold rounded-lg bg-teal text-white px-3 py-2 hover:opacity-90 disabled:opacity-60"
              >
                Enviar resposta
              </button>
            </form>
          )}
        </>
      )}

      {canFlag && !showFlagForm && (
        <button
          onClick={() => setShowFlagForm(true)}
          disabled={flagged}
          className="text-xs text-gray-400 hover:text-red-600 disabled:hover:text-gray-400 mt-2 block"
        >
          {flagged ? "Sinalizada pro suporte" : "Reportar avaliação"}
        </button>
      )}
      {showFlagForm && (
        <form onSubmit={handleFlag} className="flex flex-col gap-2 mt-2">
          <textarea
            value={flagReason}
            onChange={(e) => setFlagReason(e.target.value)}
            placeholder="Por que essa avaliação deveria ser revisada?"
            rows={2}
            className="input text-xs"
          />
          <div className="flex gap-2">
            <button
              type="submit"
              disabled={isFlagSubmitting}
              className="text-xs font-semibold rounded-lg bg-red-700 text-white px-3 py-2 hover:opacity-90 disabled:opacity-60"
            >
              Enviar
            </button>
            <button
              type="button"
              onClick={() => setShowFlagForm(false)}
              className="text-xs text-gray-500"
            >
              Cancelar
            </button>
          </div>
        </form>
      )}
      {sent && <p className="text-xs text-teal mt-2">Resposta enviada.</p>}
    </div>
  );
}
