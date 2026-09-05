"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ChevronLeft, ChevronRight, Ban, Plus } from "lucide-react";
import { AvailabilityManager } from "@/components/availability/availability-manager";
import { rescheduleOccurrence } from "@/lib/actions/requests";
import { blockDate } from "@/lib/actions/services";
import {
  WEEKDAY_SHORT_LABEL,
  MONTH_LABEL,
  toDateKey,
  monthParam,
  addMonths,
  getMonthMatrix,
  BLOCK_TYPE_LABEL,
  BLOCK_TYPE_COLOR,
} from "@/lib/domain/agenda-calendar";
import { occurrenceStageLabel } from "@/lib/domain/occurrence-pipeline";
import { SERVICE_CATEGORY_LABEL } from "@/lib/domain/service-catalog";
import { blockDateSchema, BLOCK_TYPES, type BlockType } from "@/lib/validations/services";
import type { OccurrenceStatus, ServiceCategory } from "@/types/database";

type OccurrenceItem = {
  id: string;
  scheduledAt: string;
  status: OccurrenceStatus;
  category: ServiceCategory | null;
  petNames: string;
};

type BlockedDate = {
  id: string;
  date: string;
  startTime: string | null;
  endTime: string | null;
  blockType: BlockType;
  reason: string | null;
};

type Slot = {
  id: string;
  weekday: number | null;
  start_time: string | null;
  end_time: string | null;
  date_override: string | null;
  blocked: boolean;
  block_type: string | null;
  reason: string | null;
};

type RecurringWindow = { weekday: number; startTime: string; endTime: string };

function statusLabel(occ: OccurrenceItem): string {
  if (occ.status === "agendado") return "Agendado";
  return occ.category ? occurrenceStageLabel(occ.category, occ.status) : occ.status;
}

/** Horas (inclusive) que um bloco de horário específico cobre — usado pra
 * repetir o card em cada linha da lista que ele atravessa. */
function hoursCovered(startTime: string, endTime: string): number[] {
  const startHour = Number(startTime.slice(0, 2));
  const endHour = Number(endTime.slice(0, 2));
  const endMinute = Number(endTime.slice(3, 5));
  const lastHour = endMinute > 0 ? endHour : endHour - 1;
  const hours: number[] = [];
  for (let h = startHour; h <= Math.max(startHour, lastHour); h++) hours.push(h);
  return hours;
}

/**
 * Calendário mensal da Agenda do Profissional (item 1 dos achados de
 * 2026-09-04, "estilo agenda Google"). Navegação de mês é feita por
 * <Link> pra /agenda?mes=YYYY-MM — o Server Component (page.tsx) refaz a
 * busca com o novo intervalo, sem precisar de client-side fetch nenhum;
 * a seleção do dia é só estado local, já que todas as ocorrências do mês
 * visível já chegaram prontas por props.
 *
 * Ajustes de 2026-09-05 (usuário testou e pediu): arrastar um atendimento
 * agendado pra outro horário do mesmo dia reagenda de verdade (reusa a
 * ação `rescheduleOccurrence` que já existia pro chat da solicitação —
 * "nunca bloqueia", qualquer parte pode mover uma ocorrência ainda não
 * iniciada, sem depender de aprovação prévia); bloqueios/folgas/
 * compromissos ganharam horário específico (antes só dia inteiro) e cor
 * própria na lista; hora fora do "Horário de trabalho" (janela recorrente
 * semanal) fica esmaecida na lista do dia — só quando o profissional
 * declarou pelo menos uma janela pra aquele dia da semana, pra não sugerir
 * "indisponível o dia todo" de quem nunca configurou nada.
 */
export function AgendaView({
  year,
  month,
  occurrences: initialOccurrences,
  blockedDates,
  recurringWindows,
  slots,
}: {
  year: number;
  month: number;
  occurrences: OccurrenceItem[];
  blockedDates: BlockedDate[];
  recurringWindows: RecurringWindow[];
  slots: Slot[];
}) {
  const router = useRouter();
  const [tab, setTab] = useState<"calendario" | "horarios">("calendario");
  const [occurrences, setOccurrences] = useState(initialOccurrences);
  const [dragError, setDragError] = useState<string | null>(null);
  const today = new Date();
  const isCurrentMonth = today.getFullYear() === year && today.getMonth() === month;
  const [selectedDate, setSelectedDate] = useState<string | null>(
    isCurrentMonth ? toDateKey(today) : null
  );
  const [draggedId, setDraggedId] = useState<string | null>(null);
  const [dragOverHour, setDragOverHour] = useState<number | null>(null);
  const [showQuickAdd, setShowQuickAdd] = useState(false);

  const weeks = getMonthMatrix(year, month);
  const prev = addMonths(year, month, -1);
  const next = addMonths(year, month, 1);

  const occurrencesByDay = new Map<string, OccurrenceItem[]>();
  for (const occ of occurrences) {
    const key = toDateKey(new Date(occ.scheduledAt));
    const list = occurrencesByDay.get(key) ?? [];
    list.push(occ);
    occurrencesByDay.set(key, list);
  }

  const blocksByDay = new Map<string, BlockedDate[]>();
  for (const block of blockedDates) {
    const list = blocksByDay.get(block.date) ?? [];
    list.push(block);
    blocksByDay.set(block.date, list);
  }

  const todayKey = toDateKey(today);
  const selectedDayOccurrences = selectedDate ? occurrencesByDay.get(selectedDate) ?? [] : [];
  const selectedDayBlocks = selectedDate ? blocksByDay.get(selectedDate) ?? [] : [];
  const wholeDayBlocks = selectedDayBlocks.filter((b) => !b.startTime);
  const timedBlocks = selectedDayBlocks.filter((b) => b.startTime && b.endTime);

  const hours = Array.from({ length: 24 }, (_, h) => h);
  const occurrencesByHour = new Map<number, OccurrenceItem[]>();
  for (const occ of selectedDayOccurrences) {
    const h = new Date(occ.scheduledAt).getHours();
    const list = occurrencesByHour.get(h) ?? [];
    list.push(occ);
    occurrencesByHour.set(h, list);
  }

  const blocksByHour = new Map<number, BlockedDate[]>();
  for (const block of timedBlocks) {
    for (const h of hoursCovered(block.startTime!, block.endTime!)) {
      const list = blocksByHour.get(h) ?? [];
      list.push(block);
      blocksByHour.set(h, list);
    }
  }

  // Horas fora do horário de trabalho declarado ficam esmaecidas — só
  // quando o profissional declarou pelo menos uma janela pra esse dia da
  // semana; sem nenhuma janela declarada, nenhuma hora fica esmaecida (não
  // dava pra presumir "indisponível o dia todo" de quem nunca configurou
  // nada, pedido de 2026-09-05).
  const selectedWeekday = selectedDate ? new Date(selectedDate + "T00:00:00").getDay() : null;
  const dayWindows = recurringWindows.filter((w) => w.weekday === selectedWeekday);
  // Fim às XX:59 (ex.: o padrão "dia inteiro" 00:00-23:59) precisa contar
  // a própria hora XX como coberta — só "< endHour" excluiria a última
  // hora do dia inteiro.
  const isWithinWorkingHours = (h: number) =>
    dayWindows.length === 0 ||
    dayWindows.some((w) => {
      const startHour = Number(w.startTime.slice(0, 2));
      const endHour = Number(w.endTime.slice(0, 2));
      const endMinute = Number(w.endTime.slice(3, 5));
      return h >= startHour && (h < endHour || (h === endHour && endMinute > 0));
    });

  async function handleDropOnHour(hour: number) {
    const id = draggedId;
    setDraggedId(null);
    setDragOverHour(null);
    if (!id || !selectedDate) return;

    const occ = occurrences.find((o) => o.id === id);
    if (!occ || occ.status !== "agendado") return;

    const original = new Date(occ.scheduledAt);
    if (original.getHours() === hour) return;

    const newDate = new Date(selectedDate + "T00:00:00");
    newDate.setHours(hour, 0, 0, 0);

    const previous = occ.scheduledAt;
    setOccurrences((prev) =>
      prev.map((o) => (o.id === id ? { ...o, scheduledAt: newDate.toISOString() } : o))
    );

    const result = await rescheduleOccurrence({ occurrenceId: id, newScheduledAt: newDate.toISOString() });
    if (result?.error) {
      setDragError(result.error);
      setOccurrences((prev) => prev.map((o) => (o.id === id ? { ...o, scheduledAt: previous } : o)));
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex rounded-lg border border-gray-200 bg-white p-1">
        <button
          onClick={() => setTab("calendario")}
          className={`flex-1 rounded-md py-2 text-sm font-semibold ${
            tab === "calendario" ? "bg-teal text-white" : "text-gray-500"
          }`}
        >
          Calendário
        </button>
        <button
          onClick={() => setTab("horarios")}
          className={`flex-1 rounded-md py-2 text-sm font-semibold ${
            tab === "horarios" ? "bg-teal text-white" : "text-gray-500"
          }`}
        >
          Configurar horários
        </button>
      </div>

      {tab === "horarios" && <AvailabilityManager slots={slots} />}

      {tab === "calendario" && (
        <div className="flex flex-col gap-4">
          <div className="rounded-lg border border-gray-200 bg-white p-3">
            <div className="flex items-center justify-between mb-3">
              <Link
                href={`/agenda?mes=${monthParam(prev.year, prev.month)}`}
                className="p-1 text-gray-500 hover:text-teal"
                aria-label="Mês anterior"
              >
                <ChevronLeft size={20} />
              </Link>
              <div className="flex items-center gap-1">
                <select
                  value={month}
                  onChange={(e) => router.push(`/agenda?mes=${monthParam(year, Number(e.target.value))}`)}
                  className="text-sm font-semibold text-black bg-transparent border-none"
                  aria-label="Mês"
                >
                  {MONTH_LABEL.map((label, i) => (
                    <option key={i} value={i}>{label}</option>
                  ))}
                </select>
                <select
                  value={year}
                  onChange={(e) => router.push(`/agenda?mes=${monthParam(Number(e.target.value), month)}`)}
                  className="text-sm font-semibold text-black bg-transparent border-none"
                  aria-label="Ano"
                >
                  {Array.from({ length: 6 }, (_, i) => today.getFullYear() - 2 + i).map((y) => (
                    <option key={y} value={y}>{y}</option>
                  ))}
                </select>
              </div>
              <Link
                href={`/agenda?mes=${monthParam(next.year, next.month)}`}
                className="p-1 text-gray-500 hover:text-teal"
                aria-label="Próximo mês"
              >
                <ChevronRight size={20} />
              </Link>
            </div>

            <div className="grid grid-cols-7 gap-1 mb-1">
              {WEEKDAY_SHORT_LABEL.map((label) => (
                <p key={label} className="text-center text-xs font-semibold text-gray-400">
                  {label}
                </p>
              ))}
            </div>

            <div className="grid grid-cols-7 gap-1">
              {weeks.flatMap((week) =>
                week.map((day) => {
                  const key = toDateKey(day);
                  const isCurrentMonthDay = day.getMonth() === month;
                  const hasEvent = occurrencesByDay.has(key) || blocksByDay.has(key);
                  const isSelected = key === selectedDate;
                  const isToday = key === todayKey;

                  return (
                    <button
                      key={key}
                      onClick={() => {
                        setSelectedDate(key);
                        setShowQuickAdd(false);
                      }}
                      className={`flex flex-col items-center gap-0.5 rounded-lg py-2 text-sm ${
                        isSelected
                          ? "bg-teal text-white font-semibold"
                          : isToday
                            ? "border border-teal text-teal font-semibold"
                            : isCurrentMonthDay
                              ? "text-black hover:bg-gray-100"
                              : "text-gray-300 hover:bg-gray-50"
                      }`}
                    >
                      {day.getDate()}
                      <span
                        className={`h-1 w-1 rounded-full ${
                          hasEvent ? (isSelected ? "bg-white" : "bg-teal") : "bg-transparent"
                        }`}
                      />
                    </button>
                  );
                })
              )}
            </div>
          </div>

          {selectedDate && (
            <div className="rounded-lg border border-gray-200 bg-white p-3">
              <div className="flex items-center justify-between mb-2">
                <p className="text-sm font-semibold text-black">
                  {new Date(selectedDate + "T00:00:00").toLocaleDateString("pt-BR", {
                    weekday: "long",
                    day: "2-digit",
                    month: "long",
                  })}
                </p>
                <button
                  onClick={() => setShowQuickAdd((v) => !v)}
                  className="flex items-center gap-1 rounded-full bg-teal/10 text-teal text-xs font-semibold px-2 py-1 hover:bg-teal/20"
                  aria-label="Adicionar compromisso, folga ou bloqueio nesse dia"
                >
                  <Plus size={14} />
                  Adicionar
                </button>
              </div>

              {showQuickAdd && (
                <QuickAddForm
                  date={selectedDate}
                  onDone={() => {
                    setShowQuickAdd(false);
                    router.refresh();
                  }}
                />
              )}

              {wholeDayBlocks.map((block) => {
                const color = BLOCK_TYPE_COLOR[block.blockType];
                return (
                  <div
                    key={block.id}
                    className={`flex items-center gap-2 rounded-lg px-3 py-2 mb-2 text-sm ${color.bg} ${color.text}`}
                  >
                    <Ban size={16} />
                    {BLOCK_TYPE_LABEL[block.blockType]} — dia inteiro
                    {block.reason ? ` — ${block.reason}` : ""}
                  </div>
                );
              })}

              {dragError && (
                <p className="text-xs text-red-600 mb-2" role="alert">
                  {dragError}
                </p>
              )}

              <p className="text-xs text-gray-400 mb-1">
                Arraste um atendimento agendado pra outro horário pra reagendar.
              </p>

              <div className="flex flex-col divide-y divide-gray-100 max-h-96 overflow-y-auto">
                {hours.map((h) => {
                  const items = occurrencesByHour.get(h) ?? [];
                  const blocks = blocksByHour.get(h) ?? [];
                  return (
                    <div
                      key={h}
                      onDragOver={(e) => {
                        e.preventDefault();
                        setDragOverHour(h);
                      }}
                      onDragLeave={() => setDragOverHour((c) => (c === h ? null : c))}
                      onDrop={(e) => {
                        e.preventDefault();
                        handleDropOnHour(h);
                      }}
                      className={`flex gap-3 py-1.5 ${
                        dragOverHour === h ? "bg-teal/5" : !isWithinWorkingHours(h) ? "bg-gray-50" : ""
                      }`}
                    >
                      <p
                        className={`w-12 shrink-0 text-xs pt-0.5 ${
                          isWithinWorkingHours(h) ? "text-gray-400" : "text-gray-300"
                        }`}
                      >
                        {String(h).padStart(2, "0")}:00
                      </p>
                      <div className="flex flex-col gap-1 flex-1">
                        {blocks.map((block) => {
                          const color = BLOCK_TYPE_COLOR[block.blockType];
                          return (
                            <div key={block.id} className={`rounded-lg px-2 py-1 ${color.bg}`}>
                              <p className={`text-xs font-semibold ${color.text}`}>
                                {BLOCK_TYPE_LABEL[block.blockType]}
                                {block.reason ? ` — ${block.reason}` : ""}
                              </p>
                              <p className={`text-xs ${color.text}`}>
                                {block.startTime?.slice(0, 5)}–{block.endTime?.slice(0, 5)}
                              </p>
                            </div>
                          );
                        })}
                        {items.map((occ) => (
                          <div
                            key={occ.id}
                            draggable={occ.status === "agendado"}
                            onDragStart={() => setDraggedId(occ.id)}
                            className={`rounded-lg bg-teal/10 px-2 py-1 ${
                              occ.status === "agendado" ? "cursor-grab active:cursor-grabbing" : ""
                            } ${draggedId === occ.id ? "opacity-40" : ""}`}
                          >
                            <p className="text-xs font-semibold text-black">
                              {occ.petNames || "Atendimento"}
                              {occ.category ? ` — ${SERVICE_CATEGORY_LABEL[occ.category] ?? occ.category}` : ""}
                            </p>
                            <p className="text-xs text-teal">{statusLabel(occ)}</p>
                          </div>
                        ))}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

/**
 * Atalho pedido em 2026-09-05: criar um bloqueio/folga/compromisso rápido
 * sem sair da Agenda pra aba "Configurar horários" — mesma ação
 * (`blockDate`) e mesmas regras, só que já com a data do dia selecionado.
 */
function QuickAddForm({ date, onDone }: { date: string; onDone: () => void }) {
  const [blockType, setBlockType] = useState<BlockType>("compromisso");
  const [allDay, setAllDay] = useState(false);
  const [startTime, setStartTime] = useState("12:00");
  const [endTime, setEndTime] = useState("13:00");
  const [reason, setReason] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    const parsed = blockDateSchema.safeParse({
      dateOverride: date,
      blockType,
      startTime: allDay ? undefined : startTime,
      endTime: allDay ? undefined : endTime,
      reason: reason || undefined,
    });
    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message ?? "Dados inválidos");
      return;
    }

    setIsSubmitting(true);
    const result = await blockDate(parsed.data);
    setIsSubmitting(false);
    if (result?.error) setError(result.error);
    else onDone();
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-2 rounded-lg border border-gray-200 bg-gray-50 p-3 mb-3">
      <select value={blockType} onChange={(e) => setBlockType(e.target.value as BlockType)} className="input">
        {BLOCK_TYPES.map((type) => (
          <option key={type} value={type}>{BLOCK_TYPE_LABEL[type]}</option>
        ))}
      </select>
      <label className="flex items-center gap-2 text-sm text-black">
        <input type="checkbox" checked={allDay} onChange={(e) => setAllDay(e.target.checked)} />
        Dia inteiro
      </label>
      {!allDay && (
        <div className="grid grid-cols-2 gap-2">
          <input type="time" value={startTime} onChange={(e) => setStartTime(e.target.value)} className="input" />
          <input type="time" value={endTime} onChange={(e) => setEndTime(e.target.value)} className="input" />
        </div>
      )}
      <input
        type="text"
        value={reason}
        onChange={(e) => setReason(e.target.value)}
        placeholder="Ex: almoço, médico"
        className="input"
      />
      <button
        type="submit"
        disabled={isSubmitting}
        className="rounded-lg bg-teal px-4 py-2 text-sm font-semibold text-white hover:opacity-90 disabled:opacity-60"
      >
        {isSubmitting ? "Salvando..." : "Salvar"}
      </button>
      {error && <p className="text-xs text-red-600" role="alert">{error}</p>}
    </form>
  );
}
