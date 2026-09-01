"use client";

import { useState } from "react";
import { sendMessage } from "@/lib/actions/requests";
import { flagMessage } from "@/lib/actions/moderation";
import { Flag } from "lucide-react";

type Message = {
  id: string;
  sender_id: string;
  content: string;
  created_at: string;
  flagged_reason?: string | null;
  hidden_at?: string | null;
};

export function ChatPanel({
  requestId,
  messages,
  currentUserId,
  staffSenderIds = [],
}: {
  requestId: string;
  messages: Message[];
  currentUserId: string;
  staffSenderIds?: string[];
}) {
  const [content, setContent] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleSend(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (!content.trim()) return;

    setIsSubmitting(true);
    const result = await sendMessage({ requestId, content });
    setIsSubmitting(false);

    if (result?.error) {
      setError(result.error);
      return;
    }
    setContent("");
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-col gap-2 max-h-80 overflow-y-auto rounded-lg border border-gray-200 bg-white p-3">
        {messages.length === 0 ? (
          <p className="text-sm text-gray-400 text-center py-6">
            Nenhuma mensagem ainda. Diga oi!
          </p>
        ) : (
          messages.map((message) => {
            const isMine = message.sender_id === currentUserId;
            const isStaff = staffSenderIds.includes(message.sender_id);
            return (
              <MessageBubble
                key={message.id}
                message={message}
                requestId={requestId}
                isMine={isMine}
                isStaff={isStaff}
              />
            );
          })
        )}
      </div>

      <form onSubmit={handleSend} className="flex gap-2">
        <input
          value={content}
          onChange={(e) => setContent(e.target.value)}
          placeholder="Escreva uma mensagem"
          className="input flex-1"
        />
        <button
          type="submit"
          disabled={isSubmitting || !content.trim()}
          className="rounded-lg bg-teal px-4 py-2 text-sm font-semibold text-white hover:opacity-90 disabled:opacity-60"
        >
          Enviar
        </button>
      </form>
      {error && <p className="text-sm text-red-600" role="alert">{error}</p>}
    </div>
  );
}

/**
 * Moderação de mensagens (seção 12.3, item 4 da Onda 4) — quem não
 * mandou pode sinalizar; uma mensagem oculta pelo Admin/Supervisor
 * aparece com um aviso no lugar do conteúdo, pras duas partes.
 */
function MessageBubble({
  message,
  requestId,
  isMine,
  isStaff,
}: {
  message: Message;
  requestId: string;
  isMine: boolean;
  isStaff: boolean;
}) {
  const [showFlagForm, setShowFlagForm] = useState(false);
  const [reason, setReason] = useState("");
  const [flagged, setFlagged] = useState(!!message.flagged_reason);
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleFlag(e: React.FormEvent) {
    e.preventDefault();
    if (!reason.trim()) return;
    setIsSubmitting(true);
    const result = await flagMessage(message.id, requestId, reason);
    setIsSubmitting(false);
    if (!result?.error) {
      setFlagged(true);
      setShowFlagForm(false);
    }
  }

  return (
    <div
      className={`max-w-[80%] flex flex-col gap-0.5 ${isMine ? "self-end items-end" : "self-start items-start"}`}
    >
      {isStaff && (
        <span className="text-[10px] font-semibold uppercase text-gray-400">Suporte</span>
      )}
      <div
        className={`rounded-lg px-3 py-2 text-sm ${
          message.hidden_at
            ? "bg-gray-100 text-gray-400 italic"
            : isMine
              ? "bg-teal text-white"
              : isStaff
                ? "bg-black text-white"
                : "bg-gray text-black"
        }`}
      >
        {message.hidden_at ? "Mensagem removida pela moderação." : message.content}
      </div>
      {!isMine && !message.hidden_at && (
        <>
          {!showFlagForm ? (
            <button
              type="button"
              onClick={() => setShowFlagForm(true)}
              disabled={flagged}
              className="flex items-center gap-1 text-[10px] text-gray-400 hover:text-red-600 disabled:hover:text-gray-400"
            >
              <Flag size={10} /> {flagged ? "Sinalizada" : "Sinalizar"}
            </button>
          ) : (
            <form onSubmit={handleFlag} className="flex flex-col gap-1 w-full">
              <input
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                placeholder="Por que está sinalizando?"
                className="input text-xs"
              />
              <div className="flex gap-1">
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="text-[10px] font-semibold rounded bg-red-700 text-white px-2 py-1 disabled:opacity-60"
                >
                  Enviar
                </button>
                <button
                  type="button"
                  onClick={() => setShowFlagForm(false)}
                  className="text-[10px] text-gray-500"
                >
                  Cancelar
                </button>
              </div>
            </form>
          )}
        </>
      )}
    </div>
  );
}
