const STATUS_LABEL: Record<string, string> = {
  rascunho: "Rascunho",
  solicitacao_enviada: "Solicitação enviada",
  em_conversa: "Em conversa",
  proposta_enviada: "Proposta enviada",
  aguardando_pagamento: "Aguardando pagamento",
  confirmado: "Confirmado",
  checkin: "Check-in",
  em_andamento: "Em andamento",
  finalizacao: "Finalização",
  concluido: "Concluído",
  avaliacao: "Avaliação",
  recusado: "Recusado",
  expirado: "Expirado",
  cancelado: "Cancelado",
  incidente: "Incidente",
  em_disputa: "Em disputa",
};

type HistoryEntry = {
  id: string;
  from_status: string | null;
  to_status: string;
  created_at: string;
};

export function RequestTimeline({ history }: { history: HistoryEntry[] }) {
  if (history.length === 0) {
    return <p className="text-sm text-gray-400">Sem histórico ainda.</p>;
  }

  return (
    <ol className="flex flex-col gap-0">
      {history.map((entry, i) => (
        <li key={entry.id} className="flex gap-3">
          <div className="flex flex-col items-center">
            <div className="h-2.5 w-2.5 rounded-full bg-teal shrink-0 mt-1.5" />
            {i < history.length - 1 && <div className="w-px flex-1 bg-gray-200" />}
          </div>
          <div className="pb-4">
            <p className="text-sm font-semibold text-black">{STATUS_LABEL[entry.to_status] ?? entry.to_status}</p>
            <p className="text-xs text-gray-400">
              {new Date(entry.created_at).toLocaleString("pt-BR")}
            </p>
          </div>
        </li>
      ))}
    </ol>
  );
}
