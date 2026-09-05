"use client";

import { useState } from "react";
import { addAvailabilitySlot, blockDate, removeAvailabilitySlot } from "@/lib/actions/services";
import { availabilitySlotSchema, blockDateSchema, BLOCK_TYPES, type BlockType } from "@/lib/validations/services";
import { BLOCK_TYPE_LABEL, BLOCK_TYPE_COLOR } from "@/lib/domain/agenda-calendar";
import { Trash2 } from "lucide-react";

const WEEKDAY_LABEL = ["Domingo", "Segunda", "Terça", "Quarta", "Quinta", "Sexta", "Sábado"];

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

export function AvailabilityManager({ slots }: { slots: Slot[] }) {
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const weekdaySlots = slots.filter((s) => s.weekday !== null);
  const blockedDates = slots.filter((s) => s.date_override !== null);

  const [weekday, setWeekday] = useState("1");
  const [startTime, setStartTime] = useState("09:00");
  const [endTime, setEndTime] = useState("18:00");

  const [blockDateValue, setBlockDateValue] = useState("");
  const [blockType, setBlockType] = useState<BlockType>("bloqueio");
  const [allDay, setAllDay] = useState(true);
  const [blockStartTime, setBlockStartTime] = useState("09:00");
  const [blockEndTime, setBlockEndTime] = useState("18:00");
  const [blockReason, setBlockReason] = useState("");

  async function handleAddSlot(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    const parsed = availabilitySlotSchema.safeParse({
      weekday: Number(weekday),
      startTime,
      endTime,
    });
    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message ?? "Horário inválido");
      return;
    }

    setIsSubmitting(true);
    const result = await addAvailabilitySlot(parsed.data);
    setIsSubmitting(false);
    if (result?.error) setError(result.error);
  }

  async function handleBlockDate(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    const parsed = blockDateSchema.safeParse({
      dateOverride: blockDateValue,
      blockType,
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
    else setBlockDateValue("");
  }

  async function handleRemove(id: string) {
    await removeAvailabilitySlot(id);
  }

  return (
    <div className="flex flex-col gap-6">
      <section>
        <h2 className="text-sm font-semibold text-black mb-1">Horários de trabalho</h2>
        <p className="text-xs text-gray-500 mb-3">
          Sua disponibilidade semanal — aparece esmaecida no calendário da Agenda fora desses horários.
        </p>
        <ul className="flex flex-col gap-2 mb-3">
          {weekdaySlots.map((slot) => (
            <li
              key={slot.id}
              className="flex items-center justify-between rounded-lg border border-gray-200 bg-white px-4 py-3"
            >
              <span className="text-sm text-black">
                {WEEKDAY_LABEL[slot.weekday!]}: {slot.start_time?.slice(0, 5)}–{slot.end_time?.slice(0, 5)}
              </span>
              <button onClick={() => handleRemove(slot.id)} className="text-gray-400 hover:text-red-600">
                <Trash2 size={16} />
              </button>
            </li>
          ))}
        </ul>
        <form onSubmit={handleAddSlot} className="flex flex-col gap-2 rounded-lg border border-gray-200 bg-white p-3">
          <select value={weekday} onChange={(e) => setWeekday(e.target.value)} className="input">
            {WEEKDAY_LABEL.map((label, i) => (
              <option key={i} value={i}>{label}</option>
            ))}
          </select>
          <div className="grid grid-cols-2 gap-2">
            <input type="time" value={startTime} onChange={(e) => setStartTime(e.target.value)} className="input" />
            <input type="time" value={endTime} onChange={(e) => setEndTime(e.target.value)} className="input" />
          </div>
          <button
            type="submit"
            disabled={isSubmitting}
            className="rounded-lg bg-teal px-4 py-2 text-sm font-semibold text-white hover:opacity-90 disabled:opacity-60"
          >
            Adicionar horário
          </button>
        </form>
      </section>

      <section>
        <h2 className="text-sm font-semibold text-black mb-3">Bloqueios, folgas e compromissos</h2>
        <ul className="flex flex-col gap-2 mb-3">
          {blockedDates.map((slot) => {
            const type = (slot.block_type as BlockType) ?? "bloqueio";
            const color = BLOCK_TYPE_COLOR[type];
            return (
              <li
                key={slot.id}
                className="flex items-center justify-between rounded-lg border border-gray-200 bg-white px-4 py-3"
              >
                <div className="flex flex-col gap-1">
                  <span className={`w-fit rounded-full px-2 py-0.5 text-xs font-semibold ${color.bg} ${color.text}`}>
                    {BLOCK_TYPE_LABEL[type]}
                  </span>
                  <span className="text-sm text-black">
                    {slot.date_override}
                    {slot.start_time ? ` · ${slot.start_time.slice(0, 5)}–${slot.end_time?.slice(0, 5)}` : " · dia inteiro"}
                    {slot.reason ? ` — ${slot.reason}` : ""}
                  </span>
                </div>
                <button onClick={() => handleRemove(slot.id)} className="text-gray-400 hover:text-red-600">
                  <Trash2 size={16} />
                </button>
              </li>
            );
          })}
        </ul>
        <form onSubmit={handleBlockDate} className="flex flex-col gap-2 rounded-lg border border-gray-200 bg-white p-3">
          <select value={blockType} onChange={(e) => setBlockType(e.target.value as BlockType)} className="input">
            {BLOCK_TYPES.map((type) => (
              <option key={type} value={type}>{BLOCK_TYPE_LABEL[type]}</option>
            ))}
          </select>
          <input
            type="date"
            value={blockDateValue}
            onChange={(e) => setBlockDateValue(e.target.value)}
            className="input"
          />
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
