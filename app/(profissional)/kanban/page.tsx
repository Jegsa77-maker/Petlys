import { createClient } from "@/lib/supabase/server";
import { KanbanBoard } from "@/components/kanban/kanban-board";

export default async function KanbanPage({
  searchParams,
}: {
  searchParams: Promise<{ occurrence?: string }>;
}) {
  const { occurrence: highlightOccurrenceId } = await searchParams;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  // Uma solicitação passa por rascunho/solicitacao_enviada/em_conversa/
  // proposta_enviada/aguardando_pagamento antes de "confirmado" — a
  // occurrence já nasce com status "agendado" nesse meio tempo todo
  // (lib/actions/requests.ts), então sem esse filtro ela aparecia na
  // coluna "Agendado" do Kanban antes mesmo de existir um compromisso de
  // verdade (achado navegando o app: card "Aguardando confirmação"
  // misturado com atendimento real já confirmado).
  const { data: occurrences } = user
    ? await supabase
        .from("request_occurrences")
        .select(
          "id, request_id, scheduled_at, status, requests!inner(status, category, professional_id, request_pets(pets(name)))"
        )
        .eq("requests.professional_id", user.id)
        .in("status", ["agendado", "checkin", "em_andamento", "finalizacao", "concluido"])
        .not("requests.status", "in", "(rascunho,solicitacao_enviada,em_conversa,proposta_enviada,aguardando_pagamento)")
        .order("scheduled_at", { ascending: true })
    : { data: [] };

  return (
    <main className="min-h-screen bg-offwhite px-4 py-8">
      <div className="max-w-4xl mx-auto">
        <h1 className="text-2xl font-bold text-teal mb-1">Kanban de atendimentos</h1>
        <p className="text-sm text-gray-600 mb-6">
          Mover um cartão atualiza o status para tutor e profissional automaticamente.
        </p>
        <KanbanBoard occurrences={occurrences ?? []} highlightOccurrenceId={highlightOccurrenceId} />
      </div>
    </main>
  );
}
