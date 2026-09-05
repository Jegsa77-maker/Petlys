"use client";

import { useState } from "react";
import Link from "next/link";
import { ChevronLeft, ChevronRight, Ban } from "lucide-react";
import { AvailabilityManager } from "@/components/availability/availability-manager";
import {
  WEEKDAY_SHORT_LABEL,
  MONTH_LABEL,
  toDateKey,
  monthParam,
  addMonths,
  getMonthMatrix,
} from "@/lib/domain/agenda-calendar";
import { occurrenceStageLabel } from "@/lib/domain/occurrence-pipeline";
import { SERVICE_CATEGORY_LABEL } from "@/lib/domain/service-catalog";
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
  reason: string | null;
};

type Slot = {
  id: string;
  weekday: number | null;
  start_time: string | null;
  end_time: string | null;
  date_override: string | null;
  blocked: boolean;
  reason: string | null;
};

function statusLabel(occ: OccurrenceItem): string {
  if (occ.status === "agendado") return "Agendado";
  return occ.category ? occurrenceStageLabel(occ.category, occ.status) : occ.status;
}

/**
 * Calendário mensal da Agenda do Profissional (item 1 dos achados de
 * 2026-09-04, "estilo agenda Google"). Navegação de mês é feita por
 * <Link> pra /agenda?mes=YYYY-MM — o Server Component (page.tsx) refaz a
 * busca com o novo intervalo, sem precisar de client-side fetch nenhum;
 * a seleção do dia é só estado local, já que todas as ocorrências do mês
 * visível já chegaram prontas por props.
 */
export function AgendaView({
  year,
  month,
  occurrences,
  blockedDates,
  slots,
}: {
  year: number;
  month: number;
  occurrences: OccurrenceItem[];
  blockedDates: BlockedDate[];
  slots: Slot[];
}) {
  const [tab, setTab] = useState<"calendario" | "horarios">("calendario");
  const today = new Date();
  const isCurrentMonth = today.getFullYear() === year && today.getMonth() === month;
  const [selectedDate, setSelectedDate] = useState<string | null>(
    isCurrentMonth ? toDateKey(today) : null
  );

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

  const blocksByDay = new Map<string, BlockedDate>();
  for (const block of blockedDates) {
    blocksByDay.set(block.date, block);
  }

  const todayKey = toDateKey(today);
  const selectedDayOccurrences = selectedDate ? occurrencesByDay.get(selectedDate) ?? [] : [];
  const selectedDayBlock = selectedDate ? blocksByDay.get(selectedDate) : undefined;

  const hours = Array.from({ length: 24 }, (_, h) => h);
  const occurrencesByHour = new Map<number, OccurrenceItem[]>();
  for (const occ of selectedDayOccurrences) {
    const h = new Date(occ.scheduledAt).getHours();
    const list = occurrencesByHour.get(h) ?? [];
    list.push(occ);
    occurrencesByHour.set(h, list);
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
              <p className="text-sm font-semibold text-black">
                {MONTH_LABEL[month]} de {year}
              </p>
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
                      onClick={() => setSelectedDate(key)}
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
              <p className="text-sm font-semibold text-black mb-2">
                {new Date(selectedDate + "T00:00:00").toLocaleDateString("pt-BR", {
                  weekday: "long",
                  day: "2-digit",
                  month: "long",
                })}
              </p>

              {selectedDayBlock && (
                <div className="flex items-center gap-2 rounded-lg bg-red-50 text-red-700 px-3 py-2 mb-3 text-sm">
                  <Ban size={16} />
                  Dia bloqueado{selectedDayBlock.reason ? ` — ${selectedDayBlock.reason}` : ""}
                </div>
              )}

              <div className="flex flex-col divide-y divide-gray-100 max-h-96 overflow-y-auto">
                {hours.map((h) => {
                  const items = occurrencesByHour.get(h) ?? [];
                  return (
                    <div key={h} className="flex gap-3 py-1.5">
                      <p className="w-12 shrink-0 text-xs text-gray-400 pt-0.5">
                        {String(h).padStart(2, "0")}:00
                      </p>
                      <div className="flex flex-col gap-1 flex-1">
                        {items.map((occ) => (
                          <div key={occ.id} className="rounded-lg bg-teal/10 px-2 py-1">
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
