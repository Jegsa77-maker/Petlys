"use client";

import { useState } from "react";
import { addAvailabilitySlot, blockDate, removeAvailabilitySlot } from "@/lib/actions/services";
import { availabilitySlotSchema, blockDateSchema } from "@/lib/validations/services";
import { Trash2 } from "lucide-react";

const WEEKDAY_LABEL = ["Domingo", "Segunda", "Terça", "Quarta", "Quinta", "Sexta", "Sábado"];

type Slot = {
  id: string;
  weekday: number | null;
  start_time: string | null;
  end_time: string | null;
  date_override: string | null;
  blocked: boolean;
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
        <h2 className="text-sm font-semibold text-black mb-3">Horários recorrentes</h2>
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
        <h2 className="text-sm font-semibold text-black mb-3">Bloqueios e folgas</h2>
        <ul className="flex flex-col gap-2 mb-3">
          {blockedDates.map((slot) => (
            <li
              key={slot.id}
              className="flex items-center justify-between rounded-lg border border-gray-200 bg-white px-4 py-3"
            >
              <span className="text-sm text-black">
                {slot.date_override} {slot.reason ? `— ${slot.reason}` : ""}
              </span>
              <button onClick={() => handleRemove(slot.id)} className="text-gray-400 hover:text-red-600">
                <Trash2 size={16} />
              </button>
            </li>
          ))}
        </ul>
        <form onSubmit={handleBlockDate} className="flex flex-col gap-2 rounded-lg border border-gray-200 bg-white p-3">
          <input
            type="date"
            value={blockDateValue}
            onChange={(e) => setBlockDateValue(e.target.value)}
            className="input"
          />
          <input
            type="text"
            value={blockReason}
            onChange={(e) => setBlockReason(e.target.value)}
            placeholder="Motivo (opcional)"
            className="input"
          />
          <button
            type="submit"
            disabled={isSubmitting}
            className="rounded-lg border border-teal px-4 py-2 text-sm font-semibold text-teal hover:bg-teal/5 disabled:opacity-60"
          >
            Bloquear data
          </button>
        </form>
      </section>

      {error && <p className="text-sm text-red-600" role="alert">{error}</p>}
    </div>
  );
}
