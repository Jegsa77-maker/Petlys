import { createClient } from "@/lib/supabase/server";
import { KanbanBoard } from "@/components/kanban/kanban-board";

export default async function KanbanPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data: occurrences } = user
    ? await supabase
        .from("request_occurrences")
        .select(
          "id, request_id, scheduled_at, status, requests!inner(status, category, professional_id, request_pets(pets(name)))"
        )
        .eq("requests.professional_id", user.id)
        .in("status", ["agendado", "checkin", "em_andamento", "finalizacao", "concluido"])
        .order("scheduled_at", { ascending: true })
    : { data: [] };

  return (
    <main className="min-h-screen bg-offwhite px-4 py-8">
      <div className="max-w-4xl mx-auto">
        <h1 className="text-2xl font-bold text-teal mb-1">Kanban de atendimentos</h1>
        <p className="text-sm text-gray-600 mb-6">
          Mover um cartão atualiza o status para tutor e profissional automaticamente.
        </p>
        <KanbanBoard occurrences={occurrences ?? []} />
      </div>
    </main>
  );
}
