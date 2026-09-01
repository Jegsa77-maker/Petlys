import { REQUEST_STATUS_LABEL as STATUS_LABEL } from "@/lib/domain/request-status-labels";

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
