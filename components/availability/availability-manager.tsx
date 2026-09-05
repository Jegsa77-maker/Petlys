"use client";

import { useState } from "react";
import { setWorkingHours, clearWorkingHours, blockDate, removeAvailabilitySlot } from "@/lib/actions/services";
import { workingHoursSchema, blockDateSchema, CONFIG_BLOCK_TYPES, type BlockType } from "@/lib/validations/services";
import { BLOCK_TYPE_LABEL, BLOCK_TYPE_COLOR } from "@/lib/domain/agenda-calendar";
import { Trash2 } from "lucide-react";

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

  // As 7 linhas de weekday têm sempre o mesmo range agora (ver
  // setWorkingHours) — qualquer uma delas serve pra saber o horário atual.
  const currentWorkingHours = slots.find((s) => s.weekday !== null);
  const blockedDates = slots.filter((s) => s.date_override !== null);

  const [startTime, setStartTime] = useState(currentWorkingHours?.start_time?.slice(0, 5) ?? "09:00");
  const [endTime, setEndTime] = useState(currentWorkingHours?.end_time?.slice(0, 5) ?? "18:00");

  const [blockDateValue, setBlockDateValue] = useState("");
  const [blockType, setBlockType] = useState<BlockType>("bloqueio");
  const [allDay, setAllDay] = useState(true);
  const [blockStartTime, setBlockStartTime] = useState("09:00");
  const [blockEndTime, setBlockEndTime] = useState("18:00");
  const [multiDay, setMultiDay] = useState(false);
  const [blockUntilDate, setBlockUntilDate] = useState("");
  const [blockReason, setBlockReason] = useState("");

  async function handleSetWorkingHours(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    const parsed = workingHoursSchema.safeParse({ startTime, endTime });
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
  }

  async function handleBlockDate(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    const parsed = blockDateSchema.safeParse({
      dateOverride: blockDateValue,
      untilDate: multiDay ? blockUntilDate || undefined : undefined,
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
          Um único horário pra semana inteira — ex.: das 9h às 18h. Pra um dia específico que você não
          vai trabalhar, use &quot;Bloqueios e folgas&quot; abaixo, não mude o horário aqui.
        </p>
        <form
          onSubmit={handleSetWorkingHours}
          className="flex flex-col gap-2 rounded-lg border border-gray-200 bg-white p-3"
        >
          <div className="grid grid-cols-2 gap-2">
            <input type="time" value={startTime} onChange={(e) => setStartTime(e.target.value)} className="input" />
            <input type="time" value={endTime} onChange={(e) => setEndTime(e.target.value)} className="input" />
          </div>
          <div className="flex gap-2">
            <button
              type="submit"
              disabled={isSubmitting}
              className="flex-1 rounded-lg bg-teal px-4 py-2 text-sm font-semibold text-white hover:opacity-90 disabled:opacity-60"
            >
              Salvar horário
            </button>
            {currentWorkingHours && (
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
        <h2 className="text-sm font-semibold text-black mb-3">Bloqueios e folgas</h2>
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
            {CONFIG_BLOCK_TYPES.map((type) => (
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
