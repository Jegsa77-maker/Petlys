"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { sendStaffMessage } from "@/lib/actions/staff-chat";

type ChatMessage = { id: string; senderId: string; senderName: string; content: string; createdAt: string };

/**
 * Chat de suporte com o usuário, a partir do perfil dele — usado tanto no
 * Admin quanto no Supervisor (ver 0075_staff_conversations.sql). Uma
 * conversa por usuário-alvo, visível a todo o staff — não é DM privado.
 */
export function StaffChatPanel({
  targetProfileId,
  currentUserId,
  messages,
}: {
  targetProfileId: string;
  currentUserId: string;
  messages: ChatMessage[];
}) {
  const router = useRouter();
  const [content, setContent] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleSend(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (!content.trim()) {
      setError("Escreva uma mensagem.");
      return;
    }

    setIsSubmitting(true);
    try {
      const result = await sendStaffMessage(targetProfileId, content);
      if (result?.error) {
        setError(result.error);
        return;
      }
      setContent("");
      router.refresh();
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div className="flex flex-col gap-3 rounded-lg border border-gray-200 bg-white p-4">
      <p className="text-sm font-semibold text-black">Falar com o usuário</p>
      <p className="text-xs text-gray-500">
        Conversa de suporte, visível a qualquer Admin/Supervisor — não passa pelo chat da solicitação.
      </p>

      <div className="flex flex-col gap-2 max-h-64 overflow-y-auto">
        {messages.length === 0 && <p className="text-xs text-gray-400">Nenhuma mensagem ainda.</p>}
        {messages.map((m) => {
          const isMine = m.senderId === currentUserId;
          return (
            <div key={m.id} className={`flex flex-col ${isMine ? "items-end" : "items-start"}`}>
              <div
                className={`max-w-[80%] rounded-lg px-3 py-2 text-sm ${
                  isMine ? "bg-teal text-white" : "bg-gray text-black"
                }`}
              >
                {m.content}
              </div>
              <span className="text-[10px] text-gray-400 mt-0.5">
                {m.senderName} · {new Date(m.createdAt).toLocaleString("pt-BR")}
              </span>
            </div>
          );
        })}
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
          disabled={isSubmitting}
          className="rounded-lg bg-teal px-4 py-2 text-sm font-semibold text-white hover:opacity-90 disabled:opacity-60"
        >
          Enviar
        </button>
      </form>

      {error && <p className="text-xs text-red-600" role="alert">{error}</p>}
    </div>
  );
}
