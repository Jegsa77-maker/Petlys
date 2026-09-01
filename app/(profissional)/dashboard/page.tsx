import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { Inbox, Calendar, Wallet, LayoutGrid, PawPrint, UserRound } from "lucide-react";

export default async function ProfessionalDashboardPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return null;

  const [{ count: pendingCount }, { data: today }, { data: roles }] = await Promise.all([
    supabase
      .from("requests")
      .select("id", { count: "exact", head: true })
      .eq("professional_id", user.id)
      .in("status", ["solicitacao_enviada", "em_conversa", "proposta_enviada"]),
    supabase
      .from("request_occurrences")
      .select("id, scheduled_at, status, requests!inner(professional_id)")
      .eq("requests.professional_id", user.id)
      .gte("scheduled_at", new Date(new Date().setHours(0, 0, 0, 0)).toISOString())
      .lte("scheduled_at", new Date(new Date().setHours(23, 59, 59, 999)).toISOString())
      .order("scheduled_at", { ascending: true }),
    supabase.from("account_roles").select("role").eq("profile_id", user.id).eq("active", true),
  ]);

  const isAlsoTutor = (roles ?? []).some((r) => r.role === "tutor");

  return (
    <main className="min-h-screen bg-offwhite px-4 py-8">
      <div className="max-w-md mx-auto">
        <h1 className="text-2xl font-bold text-teal mb-6">Painel</h1>

        <div className="grid grid-cols-2 gap-3 mb-6">
          <Link
            href="/solicitacoes"
            className="rounded-lg border border-gray-200 bg-white p-4 hover:border-teal transition-colors"
          >
            <Inbox size={20} className="text-teal mb-2" />
            <p className="text-2xl font-bold text-black">{pendingCount ?? 0}</p>
            <p className="text-xs text-gray-500">solicitações pendentes</p>
          </Link>
          <Link
            href="/kanban"
            className="rounded-lg border border-gray-200 bg-white p-4 hover:border-teal transition-colors"
          >
            <LayoutGrid size={20} className="text-teal mb-2" />
            <p className="text-2xl font-bold text-black">{today?.length ?? 0}</p>
            <p className="text-xs text-gray-500">atendimentos hoje</p>
          </Link>
        </div>

        <div className="flex flex-col gap-2 mb-6">
          <QuickLink href="/perfil" icon={<UserRound size={16} />} label="Meu perfil" />
          <QuickLink href="/agenda" icon={<Calendar size={16} />} label="Agenda e bloqueios" />
          <QuickLink href="/servicos" icon={<Inbox size={16} />} label="Serviços e preços" />
          <QuickLink href="/kanban" icon={<LayoutGrid size={16} />} label="Kanban de atendimentos" />
          <QuickLink href="/financeiro" icon={<Wallet size={16} />} label="Financeiro (em breve)" disabled />
        </div>

        {today && today.length > 0 && (
          <>
            <h2 className="text-sm font-semibold text-black mb-3">Hoje</h2>
            <ul className="flex flex-col gap-2">
              {today.map((occ) => (
                <li
                  key={occ.id}
                  className="flex items-center justify-between rounded-lg border border-gray-200 bg-white px-4 py-3"
                >
                  <span className="text-sm text-black">
                    {new Date(occ.scheduled_at).toLocaleTimeString("pt-BR", {
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </span>
                  <span className="text-xs text-gray-500 capitalize">{occ.status}</span>
                </li>
              ))}
            </ul>
          </>
        )}

        {!isAlsoTutor && (
          <Link
            href="/escolher-perfil"
            className="flex items-center gap-2 text-xs text-gray-500 hover:text-teal font-medium justify-center mt-6"
          >
            <PawPrint size={14} /> Também quero contratar serviços como Tutor
          </Link>
        )}
      </div>
    </main>
  );
}

function QuickLink({
  href,
  icon,
  label,
  disabled,
}: {
  href: string;
  icon: React.ReactNode;
  label: string;
  disabled?: boolean;
}) {
  if (disabled) {
    return (
      <div className="flex items-center gap-2 rounded-lg border border-gray-200 bg-gray px-4 py-3 text-sm text-gray-400 cursor-not-allowed">
        {icon} {label}
      </div>
    );
  }
  return (
    <Link
      href={href}
      className="flex items-center gap-2 rounded-lg border border-gray-200 bg-white px-4 py-3 text-sm text-black hover:border-teal transition-colors"
    >
      {icon} {label}
    </Link>
  );
}
