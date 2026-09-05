import { createClient } from "@/lib/supabase/server";
import { AgendaView } from "@/components/agenda/agenda-view";
import { getMonthMatrix, parseMonthParam } from "@/lib/domain/agenda-calendar";
import type { BlockType } from "@/lib/validations/services";

export default async function AgendaPage({
  searchParams,
}: {
  searchParams: Promise<{ mes?: string }>;
}) {
  const { mes } = await searchParams;
  const { year, month } = parseMonthParam(mes);
  const weeks = getMonthMatrix(year, month);
  const gridStart = weeks[0][0];
  const gridEnd = weeks[weeks.length - 1][6];

  // Intervalo com 1 dia de folga pra cada lado — cobre a diferença de
  // fuso entre o servidor e o navegador de quem está vendo; a
  // classificação por dia de calendário (qual célula ganha o "•") é
  // sempre feita no cliente, em cima do horário local dele.
  const rangeStart = new Date(gridStart);
  rangeStart.setDate(rangeStart.getDate() - 1);
  const rangeEnd = new Date(gridEnd);
  rangeEnd.setDate(rangeEnd.getDate() + 2);

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const [{ data: occurrences }, { data: slots }] = user
    ? await Promise.all([
        supabase
          .from("request_occurrences")
          .select(
            "id, scheduled_at, status, requests!inner(status, category, professional_id, request_pets(pets(name)))"
          )
          .eq("requests.professional_id", user.id)
          // Mesma regra do Kanban (achado de 2026-09-04): uma occurrence
          // nasce "agendado" no momento da solicitação, bem antes dela
          // ser confirmada — sem esse filtro, pedido ainda em conversa/
          // aguardando pagamento aparecia na Agenda como compromisso real.
          .not(
            "requests.status",
            "in",
            "(rascunho,solicitacao_enviada,em_conversa,proposta_enviada,aguardando_pagamento)"
          )
          .gte("scheduled_at", rangeStart.toISOString())
          .lt("scheduled_at", rangeEnd.toISOString())
          .order("scheduled_at", { ascending: true }),
        supabase
          .from("professional_availability")
          .select("id, weekday, start_time, end_time, date_override, blocked, block_type, reason")
          .eq("professional_id", user.id)
          .order("weekday"),
      ])
    : [{ data: [] }, { data: [] }];

  const occurrenceItems = (occurrences ?? []).map((o) => ({
    id: o.id,
    scheduledAt: o.scheduled_at,
    status: o.status,
    category: o.requests?.category ?? null,
    petNames: (o.requests?.request_pets ?? [])
      .map((rp) => rp.pets?.name)
      .filter(Boolean)
      .join(", "),
  }));

  const blockedDates = (slots ?? [])
    .filter((s) => s.date_override !== null)
    .map((s) => ({
      id: s.id,
      date: s.date_override!,
      startTime: s.start_time,
      endTime: s.end_time,
      blockType: (s.block_type ?? "bloqueio") as BlockType,
      reason: s.reason,
    }));

  const recurringWindows = (slots ?? [])
    .filter((s) => s.weekday !== null)
    .map((s) => ({ weekday: s.weekday!, startTime: s.start_time!, endTime: s.end_time! }));

  return (
    <main className="min-h-screen bg-offwhite px-4 py-8">
      <div className="max-w-md mx-auto">
        <h1 className="text-2xl font-bold text-teal mb-1">Agenda</h1>
        <p className="text-sm text-gray-600 mb-6">
          Seus atendimentos, folgas e compromissos num só lugar.
        </p>
        <AgendaView
          year={year}
          month={month}
          occurrences={occurrenceItems}
          blockedDates={blockedDates}
          recurringWindows={recurringWindows}
          slots={slots ?? []}
        />
      </div>
    </main>
  );
}
