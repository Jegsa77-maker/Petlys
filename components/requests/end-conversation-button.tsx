"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { endPreChatConversation } from "@/lib/actions/requests";

export function EndConversationButton({ requestId }: { requestId: string }) {
  const router = useRouter();
  const [confirming, setConfirming] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleEnd() {
    setError(null);
    setIsSubmitting(true);
    const result = await endPreChatConversation(requestId);
    setIsSubmitting(false);
    if (result?.error) {
      setError(result.error);
      return;
    }
    router.push("/solicitacoes");
  }

  if (!confirming) {
    return (
      <button
        type="button"
        onClick={() => setConfirming(true)}
        className="text-sm text-gray-500 hover:text-red-600 underline underline-offset-2"
      >
        Encerrar conversa
      </button>
    );
  }

  return (
    <div className="flex flex-col gap-2 rounded-lg border border-gray-200 bg-white p-3">
      {error && (
        <p role="alert" className="text-sm text-red-600">
          {error}
        </p>
      )}
      <div className="flex gap-2">
        <button
          type="button"
          onClick={handleEnd}
          disabled={isSubmitting}
          className="flex-1 rounded-lg bg-red-600 px-3 py-2 text-sm font-semibold text-white hover:opacity-90 disabled:opacity-60"
        >
          {isSubmitting ? "Encerrando..." : "Confirmar"}
        </button>
        <button
          type="button"
          onClick={() => setConfirming(false)}
          className="flex-1 rounded-lg border border-gray-300 px-3 py-2 text-sm text-black"
        >
          Voltar
        </button>
      </div>
    </div>
  );
}
