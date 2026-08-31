import { createClient } from "@/lib/supabase/server";
import { AvailabilityManager } from "@/components/availability/availability-manager";

export default async function AgendaPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data: slots } = user
    ? await supabase
        .from("professional_availability")
        .select("id, weekday, start_time, end_time, date_override, blocked, reason")
        .eq("professional_id", user.id)
        .order("weekday")
    : { data: [] };

  return (
    <main className="min-h-screen bg-offwhite px-4 py-8">
      <div className="max-w-md mx-auto">
        <h1 className="text-2xl font-bold text-teal mb-1">Agenda</h1>
        <p className="text-sm text-gray-600 mb-6">
          Você define os horários — a plataforma só avisa sobre conflitos, nunca bloqueia sozinha.
        </p>
        <AvailabilityManager slots={slots ?? []} />
      </div>
    </main>
  );
}
