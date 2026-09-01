import { createClient } from "@/lib/supabase/server";
import { IncidentQueue } from "@/components/admin/incident-queue";

export default async function SupervisorIncidentesPage() {
  const supabase = await createClient();
  const { data: incidents } = await supabase
    .from("incidents")
    .select("id, type, status, created_at, request_id, requests(status)")
    .in("status", ["aberto", "em_analise"])
    .order("created_at", { ascending: false });

  return (
    <main className="min-h-screen bg-offwhite px-4 py-8">
      <div className="max-w-md mx-auto">
        <h1 className="text-2xl font-bold text-teal mb-1">Fila de incidentes</h1>
        <p className="text-sm text-gray-600 mb-4">
          Assuma um caso pra tratar. Casos complexos podem ser escalados para o Administrador.
        </p>
        <IncidentQueue incidents={incidents ?? []} viewerIsAdmin={false} />
      </div>
    </main>
  );
}
