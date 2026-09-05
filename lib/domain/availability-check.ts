/**
 * Confere se um horário escolhido pelo Tutor cai dentro da disponibilidade
 * real do Profissional — pedido de 2026-09-05: "o tutor deve ver a
 * disponibilidade somente na solicitação". Usado nos dois lados: no
 * formulário (feedback na hora, `components/requests/new-request-form.tsx`)
 * e em `createRequest` (`lib/actions/requests.ts`, a validação que conta de
 * verdade — nunca confia só no que o cliente calculou).
 *
 * Só checa a data/hora do PRIMEIRO atendimento — um contrato recorrente
 * repete o mesmo dia da semana/horário toda vez, então cobre o caso comum;
 * validar cada ocorrência futura contra bloqueios que ainda nem existem
 * não faz sentido (bloqueio é sempre adicionado depois, olhando pra
 * frente).
 */

export type RecurringWindow = { weekday: number; startTime: string; endTime: string };
export type AvailabilityBlock = { date: string; startTime: string | null; endTime: string | null };

function timeToMinutes(time: string): number {
  const [h, m] = time.split(":").map(Number);
  return h * 60 + m;
}

function toDateKey(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

export function checkAvailability(
  dateTime: Date,
  recurringWindows: RecurringWindow[],
  blocks: AvailabilityBlock[]
): { available: boolean; reason: string | null } {
  const dateKey = toDateKey(dateTime);
  const minutes = dateTime.getHours() * 60 + dateTime.getMinutes();

  const dayBlocks = blocks.filter((b) => b.date === dateKey);
  for (const block of dayBlocks) {
    if (!block.startTime || !block.endTime) {
      return { available: false, reason: "O profissional bloqueou o dia inteiro nessa data." };
    }
    if (minutes >= timeToMinutes(block.startTime) && minutes < timeToMinutes(block.endTime)) {
      return { available: false, reason: "O profissional tem um bloqueio nesse horário." };
    }
  }

  const dayWindows = recurringWindows.filter((w) => w.weekday === dateTime.getDay());
  if (dayWindows.length > 0) {
    const withinWindow = dayWindows.some(
      (w) => minutes >= timeToMinutes(w.startTime) && minutes < timeToMinutes(w.endTime)
    );
    if (!withinWindow) {
      return { available: false, reason: "Esse horário está fora do horário de trabalho do profissional." };
    }
  }

  return { available: true, reason: null };
}
