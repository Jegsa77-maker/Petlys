import { createClient } from "@/lib/supabase/server";
import { IncidentQueue } from "@/components/admin/incident-queue";

export default async function AdminIncidentesPage() {
  const supabase = await createClient();
  const { data: incidents } = await supabase
    .from("incidents")
    .select("id, type, status, created_at, request_id, requests(status)")
    .order("created_at", { ascending: false });

  return (
    <main className="min-h-screen bg-offwhite px-4 py-8">
      <div className="max-w-md mx-auto">
        <h1 className="text-2xl font-bold text-teal mb-1">Incidentes e disputas</h1>
        <p className="text-sm text-gray-600 mb-4">
          Visão completa — o Supervisor vê só a própria fila em aberto.
        </p>
        <IncidentQueue incidents={incidents ?? []} viewerIsAdmin={true} />
      </div>
    </main>
  );
}
