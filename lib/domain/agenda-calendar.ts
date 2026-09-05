import type { BlockType } from "@/lib/validations/services";

/**
 * Cálculo de grade de calendário mensal (item 1 da lista de achados na
 * Visão Profissional, 2026-09-04: "Agenda Profissional, apresentar o
 * calendário do mês atual"). Sem lib de datas nova — projeto não tinha
 * nenhuma, e a conta é simples o bastante pra não justificar uma
 * dependência (mesma decisão já tomada pro drag-and-drop do Kanban).
 */

/** Rótulo e cor de cada tipo de bloqueio (ajuste pedido em 2026-09-05:
 * diferenciar bloqueio/folga/compromisso na lista da Agenda). */
export const BLOCK_TYPE_LABEL: Record<BlockType, string> = {
  bloqueio: "Bloqueio",
  folga: "Folga",
  compromisso: "Compromisso",
};

export const BLOCK_TYPE_COLOR: Record<BlockType, { bg: string; text: string; dot: string }> = {
  bloqueio: { bg: "bg-gray-200", text: "text-gray-700", dot: "bg-gray-500" },
  folga: { bg: "bg-amber-100", text: "text-amber-700", dot: "bg-amber-500" },
  compromisso: { bg: "bg-blue-100", text: "text-blue-700", dot: "bg-blue-500" },
};

export const WEEKDAY_SHORT_LABEL = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];

export const MONTH_LABEL = [
  "Janeiro",
  "Fevereiro",
  "Março",
  "Abril",
  "Maio",
  "Junho",
  "Julho",
  "Agosto",
  "Setembro",
  "Outubro",
  "Novembro",
  "Dezembro",
];

export function toDateKey(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

/** Aceita "YYYY-MM" (parâmetro de URL); cai no mês atual se ausente/inválido. */
export function parseMonthParam(value: string | undefined): { year: number; month: number } {
  if (value && /^\d{4}-\d{2}$/.test(value)) {
    const [y, m] = value.split("-").map(Number);
    if (m >= 1 && m <= 12) return { year: y, month: m - 1 };
  }
  const now = new Date();
  return { year: now.getFullYear(), month: now.getMonth() };
}

export function monthParam(year: number, month: number): string {
  return `${year}-${String(month + 1).padStart(2, "0")}`;
}

export function addMonths(year: number, month: number, delta: number): { year: number; month: number } {
  const total = year * 12 + month + delta;
  return { year: Math.floor(total / 12), month: ((total % 12) + 12) % 12 };
}

/**
 * Matriz de semanas (domingo–sábado) cobrindo o mês inteiro — inclui os
 * dias do mês anterior/seguinte que completam a primeira/última semana,
 * igual ao Google Agenda.
 */
export function getMonthMatrix(year: number, month: number): Date[][] {
  const firstOfMonth = new Date(year, month, 1);
  const lastOfMonth = new Date(year, month + 1, 0);
  const gridStart = new Date(year, month, 1 - firstOfMonth.getDay());
  const totalCells = Math.ceil((lastOfMonth.getDate() + firstOfMonth.getDay()) / 7) * 7;

  const days: Date[] = [];
  for (let i = 0; i < totalCells; i++) {
    days.push(new Date(gridStart.getFullYear(), gridStart.getMonth(), gridStart.getDate() + i));
  }

  const weeks: Date[][] = [];
  for (let i = 0; i < days.length; i += 7) {
    weeks.push(days.slice(i, i + 7));
  }
  return weeks;
}
