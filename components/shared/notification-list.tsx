"use client";

import { useState } from "react";
import Link from "next/link";
import { markNotificationRead, markAllNotificationsRead } from "@/lib/actions/notifications";
import { Bell, MessageCircle, FileText, Star, AlertTriangle, BadgeCheck } from "lucide-react";

type Notification = {
  id: string;
  type: string;
  payload: unknown;
  read_at: string | null;
  created_at: string;
};

const TYPE_ICON: Record<string, React.ReactNode> = {
  nova_mensagem: <MessageCircle size={16} />,
  proposta_recebida: <FileText size={16} />,
  avaliacao_recebida: <Star size={16} />,
  status_atendimento: <AlertTriangle size={16} />,
  incidente_aberto: <AlertTriangle size={16} className="text-red-700" />,
  certificacao_enviada: <BadgeCheck size={16} />,
};

const TYPE_LABEL: Record<string, string> = {
  nova_mensagem: "Nova mensagem",
  proposta_recebida: "Proposta recebida",
  avaliacao_recebida: "Avaliação recebida",
  status_atendimento: "Status atualizado",
  incidente_aberto: "Incidente aberto — Preciso de ajuda",
  certificacao_enviada: "Nova habilitação enviada pra revisão",
};

export function NotificationList({ notifications }: { notifications: Notification[] }) {
  const [items, setItems] = useState(notifications);

  async function handleMarkRead(id: string) {
    setItems((prev) => prev.map((n) => (n.id === id ? { ...n, read_at: new Date().toISOString() } : n)));
    await markNotificationRead(id);
  }

  async function handleMarkAll() {
    setItems((prev) => prev.map((n) => ({ ...n, read_at: n.read_at ?? new Date().toISOString() })));
    await markAllNotificationsRead();
  }

  const unreadCount = items.filter((n) => !n.read_at).length;

  return (
    <div className="flex flex-col gap-3">
      {unreadCount > 0 && (
        <button
          onClick={handleMarkAll}
          className="self-end text-xs text-teal font-semibold hover:underline"
        >
          Marcar todas como lidas
        </button>
      )}

      {items.length === 0 ? (
        <div className="text-center py-16 text-gray-500">
          <Bell size={40} className="mx-auto mb-3 text-gray-300" />
          <p className="text-sm">Nenhuma notificação por aqui ainda.</p>
        </div>
      ) : (
        <ul className="flex flex-col gap-2">
          {items.map((n) => {
            const requestId = (n.payload as Record<string, unknown> | null)?.request_id as
              | string
              | undefined;
            const certificationId = (n.payload as Record<string, unknown> | null)?.certification_id as
              | string
              | undefined;
            return (
              <li
                key={n.id}
                className={`rounded-lg border p-3 flex items-start gap-3 ${
                  n.read_at ? "border-gray-200 bg-white" : "border-teal bg-teal/5"
                }`}
              >
                <div className="text-teal mt-0.5">{TYPE_ICON[n.type] ?? <Bell size={16} />}</div>
                <div className="flex-1">
                  <p className="text-sm font-semibold text-black">{TYPE_LABEL[n.type] ?? n.type}</p>
                  <p className="text-xs text-gray-500">
                    {new Date(n.created_at).toLocaleString("pt-BR")}
                  </p>
                  {requestId && (
                    <Link
                      href={`/solicitacoes/${requestId}`}
                      onClick={() => !n.read_at && handleMarkRead(n.id)}
                      className="text-xs text-teal font-semibold hover:underline"
                    >
                      Ver atendimento
                    </Link>
                  )}
                  {certificationId && (
                    <Link
                      href="/admin/habilitacoes"
                      onClick={() => !n.read_at && handleMarkRead(n.id)}
                      className="text-xs text-teal font-semibold hover:underline"
                    >
                      Revisar habilitação
                    </Link>
                  )}
                </div>
                {!n.read_at && (
                  <button
                    onClick={() => handleMarkRead(n.id)}
                    className="h-2 w-2 rounded-full bg-teal shrink-0 mt-1.5"
                    aria-label="Marcar como lida"
                  />
                )}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
