import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { Search, Bell, PawPrint, Briefcase } from "lucide-react";

export default async function TutorInicioPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return null;

  const startOfMonth = new Date();
  startOfMonth.setDate(1);
  startOfMonth.setHours(0, 0, 0, 0);

  const [{ data: myRequests }, { count: unreadCount }, { data: roles }] = await Promise.all([
    supabase
      .from("requests")
      .select("id, status, created_at")
      .eq("tutor_id", user.id),
    supabase
      .from("notifications")
      .select("id", { count: "exact", head: true })
      .eq("profile_id", user.id)
      .is("read_at", null),
    supabase.from("account_roles").select("role").eq("profile_id", user.id).eq("active", true),
  ]);

  const isAlsoProfissional = (roles ?? []).some((r) => r.role === "profissional");

  const requestIds = (myRequests ?? []).map((r) => r.id);

  const { data: payments } = requestIds.length
    ? await supabase
        .from("payments")
        .select("amount, paid_at, request_id")
        .in("request_id", requestIds)
        .gte("paid_at", startOfMonth.toISOString())
    : { data: [] };

  const gastoNoMes = (payments ?? []).reduce((sum, p) => sum + Number(p.amount), 0);

  const { data: occurrences } = requestIds.length
    ? await supabase
        .from("request_occurrences")
        .select("status, request_id")
        .in("request_id", requestIds)
    : { data: [] };

  const executados = (occurrences ?? []).filter((o) => o.status === "concluido").length;
  const pendentes = (occurrences ?? []).filter((o) =>
    ["agendado", "checkin", "em_andamento", "finalizacao"].includes(o.status)
  ).length;

  return (
    <main className="min-h-screen bg-offwhite px-4 py-8">
      <div className="max-w-md mx-auto flex flex-col gap-6">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold text-teal">Início</h1>
          <Link href="/notificacoes" className="relative text-black">
            <Bell size={22} />
            {(unreadCount as unknown as number) > 0 && (
              <span className="absolute -top-1 -right-1 h-4 w-4 rounded-full bg-red-600 text-white text-[10px] flex items-center justify-center">
                {unreadCount}
              </span>
            )}
          </Link>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div className="rounded-lg bg-white border border-gray-200 p-4">
            <p className="text-xs text-gray-500">Gasto no mês</p>
            <p className="text-xl font-bold text-teal">R$ {gastoNoMes.toFixed(2)}</p>
          </div>
          <div className="rounded-lg bg-white border border-gray-200 p-4">
            <p className="text-xs text-gray-500">Serviços</p>
            <p className="text-xl font-bold text-teal">
              {executados} <span className="text-xs text-gray-400 font-normal">feitos</span>
            </p>
            <p className="text-xs text-gray-400">{pendentes} pendentes</p>
          </div>
        </div>

        <Link
          href="/buscar"
          className="flex items-center justify-center gap-2 rounded-lg bg-teal px-4 py-3 text-sm font-semibold text-white hover:opacity-90"
        >
          <Search size={16} /> Buscar profissional
        </Link>

        <div className="flex flex-col gap-2">
          <QuickLink href="/pets" label="Meus pets" />
          <QuickLink href="/solicitacoes" label="Minhas solicitações" />
        </div>

        {!isAlsoProfissional && (
          <Link
            href="/escolher-perfil"
            className="flex items-center gap-2 text-xs text-gray-500 hover:text-teal font-medium justify-center mt-2"
          >
            <Briefcase size={14} /> Também quero oferecer serviços como Profissional
          </Link>
        )}
      </div>
    </main>
  );
}

function QuickLink({ href, label }: { href: string; label: string }) {
  return (
    <Link
      href={href}
      className="flex items-center gap-2 rounded-lg border border-gray-200 bg-white px-4 py-3 text-sm text-black hover:border-teal transition-colors"
    >
      <PawPrint size={16} className="text-teal" /> {label}
    </Link>
  );
}
