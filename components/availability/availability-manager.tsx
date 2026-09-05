"use client";

import { useState } from "react";
import {
  setWorkingHours,
  clearWorkingHours,
  blockDate,
  updateBlock,
  removeAvailabilitySlot,
} from "@/lib/actions/services";
import { workingHoursSchema, blockDateSchema, updateBlockSchema, type BlockType } from "@/lib/validations/services";
import { BLOCK_TYPE_LABEL, BLOCK_TYPE_COLOR } from "@/lib/domain/agenda-calendar";
import { Trash2, Plus } from "lucide-react";

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

type Range = { startTime: string; endTime: string };

/**
 * Horário de trabalho (2026-09-06: virou lista de ranges — turno partido,
 * ex. 9h-12h e 15h-18h) e bloqueios (2026-09-06: só "Bloqueio" cria aqui;
 * compromisso não aparece nessa tela, só existe pelo atalho "+" da
 * Agenda; bloqueio só edita/arrasta aqui, nunca na Agenda).
 */
export function AvailabilityManager({ slots }: { slots: Slot[] }) {
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // As linhas de um único weekday (ex. 0) já têm todos os ranges atuais —
  // os outros 6 dias têm sempre o mesmo conjunto (ver setWorkingHours).
  const currentRanges: Range[] = slots
    .filter((s) => s.weekday === 0)
    .map((s) => ({ startTime: s.start_time!.slice(0, 5), endTime: s.end_time!.slice(0, 5) }))
    .sort((a, b) => a.startTime.localeCompare(b.startTime));

  const hasWorkingHours = currentRanges.length > 0;
  const [ranges, setRanges] = useState<Range[]>(
    hasWorkingHours ? currentRanges : [{ startTime: "09:00", endTime: "18:00" }]
  );

  // Compromisso não aparece aqui (2026-09-06) — só existe pelo atalho "+"
  // da Agenda, editável/arrastável só lá.
  const blockedDates = slots.filter((s) => s.date_override !== null && s.block_type !== "compromisso");

  const [editingBlockId, setEditingBlockId] = useState<string | null>(null);

  const [blockDateValue, setBlockDateValue] = useState("");
  const [allDay, setAllDay] = useState(true);
  const [blockStartTime, setBlockStartTime] = useState("09:00");
  const [blockEndTime, setBlockEndTime] = useState("18:00");
  const [multiDay, setMultiDay] = useState(false);
  const [blockUntilDate, setBlockUntilDate] = useState("");
  const [blockReason, setBlockReason] = useState("");

  function updateRange(index: number, field: keyof Range, value: string) {
    setRanges((prev) => prev.map((r, i) => (i === index ? { ...r, [field]: value } : r)));
  }

  function addRange() {
    setRanges((prev) => [...prev, { startTime: "09:00", endTime: "18:00" }]);
  }

  function removeRange(index: number) {
    setRanges((prev) => prev.filter((_, i) => i !== index));
  }

  async function handleSetWorkingHours(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    const parsed = workingHoursSchema.safeParse({ ranges });
    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message ?? "Horário inválido");
      return;
    }

    setIsSubmitting(true);
    const result = await setWorkingHours(parsed.data);
    setIsSubmitting(false);
    if (result?.error) setError(result.error);
  }

  async function handleClearWorkingHours() {
    setError(null);
    setIsSubmitting(true);
    const result = await clearWorkingHours();
    setIsSubmitting(false);
    if (result?.error) setError(result.error);
    else setRanges([{ startTime: "09:00", endTime: "18:00" }]);
  }

  async function handleBlockDate(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    const parsed = blockDateSchema.safeParse({
      dateOverride: blockDateValue,
      untilDate: multiDay ? blockUntilDate || undefined : undefined,
      blockType: "bloqueio",
      startTime: allDay ? undefined : blockStartTime,
      endTime: allDay ? undefined : blockEndTime,
      reason: blockReason || undefined,
    });
    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message ?? "Data inválida");
      return;
    }

    setIsSubmitting(true);
    const result = await blockDate(parsed.data);
    setIsSubmitting(false);
    if (result?.error) setError(result.error);
    else {
      setBlockDateValue("");
      setBlockUntilDate("");
    }
  }

  async function handleRemove(id: string) {
    await removeAvailabilitySlot(id);
  }

  return (
    <div className="flex flex-col gap-6">
      <section>
        <h2 className="text-sm font-semibold text-black mb-1">Horário de trabalho</h2>
        <p className="text-xs text-gray-500 mb-3">
          Vale pra semana inteira. Turno partido? Adicione mais de um horário — ex.: 9h–12h e 15h–18h.
        </p>
        <form
          onSubmit={handleSetWorkingHours}
          className="flex flex-col gap-2 rounded-lg border border-gray-200 bg-white p-3"
        >
          {ranges.map((range, i) => (
            <div key={i} className="flex items-center gap-2">
              <div className="grid grid-cols-2 gap-2 flex-1">
                <input
                  type="time"
                  value={range.startTime}
                  onChange={(e) => updateRange(i, "startTime", e.target.value)}
                  className="input"
                />
                <input
                  type="time"
                  value={range.endTime}
                  onChange={(e) => updateRange(i, "endTime", e.target.value)}
                  className="input"
                />
              </div>
              {ranges.length > 1 && (
                <button
                  type="button"
                  onClick={() => removeRange(i)}
                  className="text-gray-400 hover:text-red-600"
                  aria-label="Remover horário"
                >
                  <Trash2 size={16} />
                </button>
              )}
            </div>
          ))}
          <button
            type="button"
            onClick={addRange}
            className="flex items-center gap-1 text-xs font-semibold text-teal hover:underline w-fit"
          >
            <Plus size={14} />
            Adicionar horário
          </button>
          <div className="flex gap-2 mt-1">
            <button
              type="submit"
              disabled={isSubmitting}
              className="flex-1 rounded-lg bg-teal px-4 py-2 text-sm font-semibold text-white hover:opacity-90 disabled:opacity-60"
            >
              Salvar horário
            </button>
            {hasWorkingHours && (
              <button
                type="button"
                onClick={handleClearWorkingHours}
                disabled={isSubmitting}
                className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-semibold text-gray-600 hover:bg-gray-50 disabled:opacity-60"
              >
                Remover
              </button>
            )}
          </div>
        </form>
      </section>

      <section>
        <h2 className="text-sm font-semibold text-black mb-1">Bloqueios</h2>
        <p className="text-xs text-gray-500 mb-3">
          Dias ou horários em que você não vai trabalhar. Só edita/arrasta por aqui — na Agenda aparece
          fixo.
        </p>
        <ul className="flex flex-col gap-2 mb-3">
          {blockedDates.map((slot) => {
            const type = (slot.block_type as BlockType) ?? "bloqueio";
            const color = BLOCK_TYPE_COLOR[type];
            return editingBlockId === slot.id ? (
              <li key={slot.id}>
                <BlockEditForm
                  slot={slot}
                  onDone={() => setEditingBlockId(null)}
                />
              </li>
            ) : (
              <li
                key={slot.id}
                className="flex items-center justify-between rounded-lg border border-gray-200 bg-white px-4 py-3"
              >
                <button
                  onClick={() => setEditingBlockId(slot.id)}
                  className="flex flex-col gap-1 text-left flex-1"
                >
                  <span className={`w-fit rounded-full px-2 py-0.5 text-xs font-semibold ${color.bg} ${color.text}`}>
                    {BLOCK_TYPE_LABEL[type]}
                  </span>
                  <span className="text-sm text-black">
                    {slot.date_override}
                    {slot.start_time ? ` · ${slot.start_time.slice(0, 5)}–${slot.end_time?.slice(0, 5)}` : " · dia inteiro"}
                    {slot.reason ? ` — ${slot.reason}` : ""}
                  </span>
                </button>
                <button onClick={() => handleRemove(slot.id)} className="text-gray-400 hover:text-red-600">
                  <Trash2 size={16} />
                </button>
              </li>
            );
          })}
        </ul>
        <form onSubmit={handleBlockDate} className="flex flex-col gap-2 rounded-lg border border-gray-200 bg-white p-3">
          <input
            type="date"
            value={blockDateValue}
            onChange={(e) => setBlockDateValue(e.target.value)}
            className="input"
          />
          <label className="flex items-center gap-2 text-sm text-black">
            <input type="checkbox" checked={multiDay} onChange={(e) => setMultiDay(e.target.checked)} />
            Vários dias seguidos (período de férias, por exemplo)
          </label>
          {multiDay && (
            <input
              type="date"
              value={blockUntilDate}
              onChange={(e) => setBlockUntilDate(e.target.value)}
              placeholder="Até"
              className="input"
            />
          )}
          <label className="flex items-center gap-2 text-sm text-black">
            <input type="checkbox" checked={allDay} onChange={(e) => setAllDay(e.target.checked)} />
            Dia inteiro
          </label>
          {!allDay && (
            <div className="grid grid-cols-2 gap-2">
              <input
                type="time"
                value={blockStartTime}
                onChange={(e) => setBlockStartTime(e.target.value)}
                className="input"
              />
              <input
                type="time"
                value={blockEndTime}
                onChange={(e) => setBlockEndTime(e.target.value)}
                className="input"
              />
            </div>
          )}
          <input
            type="text"
            value={blockReason}
            onChange={(e) => setBlockReason(e.target.value)}
            placeholder="Descrição (opcional)"
            className="input"
          />
          <button
            type="submit"
            disabled={isSubmitting}
            className="rounded-lg border border-teal px-4 py-2 text-sm font-semibold text-teal hover:bg-teal/5 disabled:opacity-60"
          >
            Salvar
          </button>
        </form>
      </section>

      {error && <p className="text-sm text-red-600" role="alert">{error}</p>}
    </div>
  );
}

/** Editar um bloqueio existente — preserva o tipo já gravado (não expõe
 * seletor: só "Bloqueio" pode ser criado aqui, mas uma "Folga" antiga
 * continua editável sem virar Bloqueio à força). */
function BlockEditForm({ slot, onDone }: { slot: Slot; onDone: () => void }) {
  const type = (slot.block_type as BlockType) ?? "bloqueio";
  const [allDay, setAllDay] = useState(!slot.start_time);
  const [startTime, setStartTime] = useState(slot.start_time?.slice(0, 5) ?? "09:00");
  const [endTime, setEndTime] = useState(slot.end_time?.slice(0, 5) ?? "18:00");
  const [reason, setReason] = useState(slot.reason ?? "");
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    const parsed = updateBlockSchema.safeParse({
      id: slot.id,
      blockType: type,
      startTime: allDay ? undefined : startTime,
      endTime: allDay ? undefined : endTime,
      reason: reason || undefined,
    });
    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message ?? "Dados inválidos");
      return;
    }

    setIsSubmitting(true);
    const result = await updateBlock(parsed.data);
    setIsSubmitting(false);
    if (result?.error) setError(result.error);
    else onDone();
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-2 rounded-lg border border-gray-200 bg-gray-50 p-3">
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
        placeholder="Descrição (opcional)"
        className="input"
      />
      <div className="flex gap-2">
        <button
          type="submit"
          disabled={isSubmitting}
          className="flex-1 rounded-lg bg-teal px-4 py-2 text-sm font-semibold text-white hover:opacity-90 disabled:opacity-60"
        >
          Salvar
        </button>
        <button
          type="button"
          onClick={onDone}
          className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-semibold text-gray-600 hover:bg-gray-50"
        >
          Cancelar
        </button>
      </div>
      {error && <p className="text-xs text-red-600" role="alert">{error}</p>}
    </form>
  );
}
