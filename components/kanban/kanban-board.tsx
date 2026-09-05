"use client";

import { useState } from "react";
import { registerCheckin, advanceOccurrence, submitOccurrenceReport } from "@/lib/actions/occurrences";
import { createClient } from "@/lib/supabase/client";
import { Paperclip, Loader2 } from "lucide-react";
import { occurrenceStageLabel } from "@/lib/domain/occurrence-pipeline";
import type { OccurrenceStatus, ServiceCategory } from "@/types/database";

type OccurrenceCard = {
  id: string;
  request_id: string;
  scheduled_at: string;
  status: string;
  requests: {
    status: string;
    category: string;
    request_pets: { pets: { name: string } | null }[];
  } | null;
};

const COLUMNS: { status: string; label: string }[] = [
  { status: "agendado", label: "Agendado" },
  { status: "checkin", label: "Check-in" },
  { status: "em_andamento", label: "Em andamento" },
  { status: "finalizacao", label: "Finalização" },
  { status: "concluido", label: "Concluído" },
];

export function KanbanBoard({ occurrences }: { occurrences: OccurrenceCard[] }) {
  const [items, setItems] = useState(occurrences);

  function updateLocal(id: string, status: string) {
    setItems((prev) => prev.map((o) => (o.id === id ? { ...o, status } : o)));
  }

  return (
    <div className="flex gap-3 overflow-x-auto pb-4">
      {COLUMNS.map((column) => (
        <div key={column.status} className="flex-shrink-0 w-64">
          <p className="text-xs font-semibold text-gray-500 uppercase mb-2 px-1">
            {column.label} ({items.filter((o) => o.status === column.status).length})
          </p>
          <div className="flex flex-col gap-2">
            {items
              .filter((o) => o.status === column.status)
              .map((occ) => (
                <OccurrenceCardView key={occ.id} occurrence={occ} onUpdated={updateLocal} />
              ))}
          </div>
        </div>
      ))}
    </div>
  );
}

function OccurrenceCardView({
  occurrence,
  onUpdated,
}: {
  occurrence: OccurrenceCard;
  onUpdated: (id: string, status: string) => void;
}) {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [notes, setNotes] = useState("");
  const [showReportForm, setShowReportForm] = useState(false);
  const [attachmentPaths, setAttachmentPaths] = useState<string[]>([]);
  const [isUploading, setIsUploading] = useState(false);

  const petNames = (occurrence.requests?.request_pets ?? [])
    .map((rp) => rp.pets?.name)
    .filter(Boolean)
    .join(", ");

  const category = occurrence.requests?.category as ServiceCategory | undefined;
  // Nome da fase específico da categoria (seção 5.2) — a coluna do Kanban
  // continua genérica, só o card fala a língua do serviço.
  const stageLabel = (status: OccurrenceStatus) =>
    category ? occurrenceStageLabel(category, status) : status;

  async function handleCheckin() {
    setIsSubmitting(true);
    let coords: { lat?: number; lng?: number } = {};
    if (typeof window !== "undefined" && navigator.geolocation) {
      try {
        const position = await new Promise<GeolocationPosition>((resolve, reject) =>
          navigator.geolocation.getCurrentPosition(resolve, reject, { timeout: 5000 })
        );
        coords = { lat: position.coords.latitude, lng: position.coords.longitude };
      } catch {
        // Geolocalização negada ou indisponível — check-in segue sem coordenadas.
      }
    }
    await registerCheckin({ occurrenceId: occurrence.id, ...coords });
    setIsSubmitting(false);
    onUpdated(occurrence.id, "checkin");
  }

  async function handleAdvance(next: "em_andamento" | "concluido") {
    setIsSubmitting(true);
    await advanceOccurrence(occurrence.id, next);
    setIsSubmitting(false);
    onUpdated(occurrence.id, next);
  }

  async function handleAttachmentChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsUploading(true);
    const supabase = createClient();
    const path = `${occurrence.request_id}/${occurrence.id}/${Date.now()}-${file.name}`;

    const { error } = await supabase.storage.from("occurrence-reports").upload(path, file, {
      upsert: false,
    });

    setIsUploading(false);
    if (!error) {
      setAttachmentPaths((prev) => [...prev, path]);
    }
    e.target.value = "";
  }

  async function handleReport(e: React.FormEvent) {
    e.preventDefault();
    if (!notes.trim()) return;
    setIsSubmitting(true);
    await submitOccurrenceReport({ occurrenceId: occurrence.id, notes, attachmentPaths });
    setIsSubmitting(false);
    onUpdated(occurrence.id, "finalizacao");
    setShowReportForm(false);
  }

  return (
    <div className="rounded-lg border border-gray-200 bg-white p-3">
      <p className="text-sm font-semibold text-black">{petNames || "Atendimento"}</p>
      <p className="text-xs text-gray-500 mb-1">
        {new Date(occurrence.scheduled_at).toLocaleString("pt-BR", {
          day: "2-digit",
          month: "2-digit",
          hour: "2-digit",
          minute: "2-digit",
        })}
      </p>
      {occurrence.status !== "agendado" && occurrence.status !== "concluido" && (
        <p className="text-xs font-semibold text-teal mb-2">
          {stageLabel(occurrence.status as OccurrenceStatus)}
        </p>
      )}

      {occurrence.status === "agendado" && (
        <button
          onClick={handleCheckin}
          disabled={isSubmitting}
          className="w-full text-xs font-semibold rounded-lg bg-teal text-white px-3 py-2 hover:opacity-90 disabled:opacity-60"
        >
          Marcar: {stageLabel("checkin")}
        </button>
      )}

      {occurrence.status === "checkin" && (
        <button
          onClick={() => handleAdvance("em_andamento")}
          disabled={isSubmitting}
          className="w-full text-xs font-semibold rounded-lg bg-teal text-white px-3 py-2 hover:opacity-90 disabled:opacity-60"
        >
          Marcar: {stageLabel("em_andamento")}
        </button>
      )}

      {occurrence.status === "em_andamento" && !showReportForm && (
        <button
          onClick={() => setShowReportForm(true)}
          disabled={isSubmitting}
          className="w-full text-xs font-semibold rounded-lg bg-teal text-white px-3 py-2 hover:opacity-90 disabled:opacity-60"
        >
          Enviar relatório
        </button>
      )}

      {occurrence.status === "em_andamento" && showReportForm && (
        <form onSubmit={handleReport} className="flex flex-col gap-2">
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="O que foi feito no atendimento"
            rows={2}
            className="input text-xs"
          />
          <label className="flex items-center gap-1 text-xs text-teal font-semibold cursor-pointer hover:underline w-fit">
            {isUploading ? <Loader2 size={12} className="animate-spin" /> : <Paperclip size={12} />}
            {isUploading ? "Enviando..." : "Anexar foto"}
            <input type="file" accept="image/*" onChange={handleAttachmentChange} disabled={isUploading} className="hidden" />
          </label>
          {attachmentPaths.length > 0 && (
            <p className="text-xs text-gray-500">{attachmentPaths.length} foto(s) anexada(s)</p>
          )}
          <button
            type="submit"
            disabled={isSubmitting}
            className="w-full text-xs font-semibold rounded-lg bg-teal text-white px-3 py-2 hover:opacity-90 disabled:opacity-60"
          >
            Salvar relatório
          </button>
        </form>
      )}

      {occurrence.status === "finalizacao" && (
        <button
          onClick={() => handleAdvance("concluido")}
          disabled={isSubmitting}
          className="w-full text-xs font-semibold rounded-lg bg-teal text-white px-3 py-2 hover:opacity-90 disabled:opacity-60"
        >
          Marcar: {stageLabel("concluido")}
        </button>
      )}

      {occurrence.status === "concluido" && (
        <p className="text-xs font-semibold text-black bg-green inline-block px-2 py-0.5 rounded-full">
          {stageLabel("concluido")}
        </p>
      )}
    </div>
  );
}
