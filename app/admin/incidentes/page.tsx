import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { IncidentQueue } from "@/components/admin/incident-queue";
import { NotificationsBadgeLink } from "@/components/shared/notifications-badge-link";

export default async function AdminIncidentesPage() {
  const supabase = await createClient();
  const { data: incidents } = await supabase
    .from("incidents")
    .select("id, type, status, created_at, request_id, requests(status)")
    .order("created_at", { ascending: false });

  return (
    <main className="min-h-screen bg-offwhite px-4 py-8">
      <div className="max-w-md mx-auto">
        <div className="flex items-center justify-between mb-1">
          <h1 className="text-2xl font-bold text-teal">Incidentes e disputas</h1>
          <NotificationsBadgeLink />
        </div>
        <p className="text-sm text-gray-600 mb-2">
          Visão completa — o Supervisor vê só a própria fila em aberto.
        </p>
        <Link href="/admin/moderacao" className="text-xs font-semibold text-teal hover:underline mb-4 inline-block">
          Ver mensagens e avaliações sinalizadas →
        </Link>
        <IncidentQueue incidents={incidents ?? []} viewerIsAdmin={true} />
      </div>
    </main>
  );
}
