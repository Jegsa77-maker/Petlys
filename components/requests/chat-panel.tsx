"use client";

import { useState } from "react";
import { sendMessage } from "@/lib/actions/requests";

type Message = {
  id: string;
  sender_id: string;
  content: string;
  created_at: string;
};

export function ChatPanel({
  requestId,
  messages,
  currentUserId,
}: {
  requestId: string;
  messages: Message[];
  currentUserId: string;
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
            return (
              <div
                key={message.id}
                className={`max-w-[80%] rounded-lg px-3 py-2 text-sm ${
                  isMine ? "self-end bg-teal text-white" : "self-start bg-gray text-black"
                }`}
              >
                {message.content}
              </div>
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
