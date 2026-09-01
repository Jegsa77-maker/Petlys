import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { REQUEST_STATUS_LABEL } from "@/lib/domain/request-status-labels";

export default async function AdminDashboardPage() {
  const supabase = await createClient();

  const [
    { data: statusRows },
    { data: payments },
    { data: payouts },
    { count: tutorCount },
    { count: professionalCount },
    { count: incidentsOpen },
    { count: incidentsResolved },
    { count: certificationsPending },
  ] = await Promise.all([
    supabase.from("requests").select("status"),
    supabase.from("payments").select("amount, commission_amount, status"),
    supabase.from("payouts").select("amount, status"),
    supabase
      .from("account_roles")
      .select("id", { count: "exact", head: true })
      .eq("role", "tutor")
      .eq("active", true),
    supabase
      .from("account_roles")
      .select("id", { count: "exact", head: true })
      .eq("role", "profissional")
      .eq("active", true),
    supabase
      .from("incidents")
      .select("id", { count: "exact", head: true })
      .in("status", ["aberto", "em_analise", "escalado"]),
    supabase
      .from("incidents")
      .select("id", { count: "exact", head: true })
      .eq("status", "resolvido"),
    supabase
      .from("professional_certifications")
      .select("id", { count: "exact", head: true })
      .eq("status", "pendente"),
  ]);

  const statusCounts: Record<string, number> = {};
  (statusRows ?? []).forEach((r) => {
    statusCounts[r.status] = (statusCounts[r.status] ?? 0) + 1;
  });

  const gmv = (payments ?? []).reduce((sum, p) => sum + Number(p.amount), 0);
  const comissao = (payments ?? []).reduce((sum, p) => sum + Number(p.commission_amount), 0);
  const retido = (payouts ?? [])
    .filter((p) => p.status === "retido")
    .reduce((sum, p) => sum + Number(p.amount), 0);
  const repassado = (payouts ?? [])
    .filter((p) => p.status === "pago")
    .reduce((sum, p) => sum + Number(p.amount), 0);

  return (
    <main className="min-h-screen bg-offwhite px-4 py-8">
      <div className="max-w-2xl mx-auto flex flex-col gap-6">
        <h1 className="text-2xl font-bold text-teal">Painel do Administrador</h1>

        <Block title="Pedidos por status">
          {Object.keys(statusCounts).length === 0 ? (
            <EmptyRow />
          ) : (
            <div className="grid grid-cols-2 gap-2">
              {Object.entries(statusCounts).map(([status, count]) => (
                <div key={status} className="flex items-center justify-between text-sm">
                  <span className="text-gray-600">{REQUEST_STATUS_LABEL[status] ?? status}</span>
                  <span className="font-semibold text-black">{count}</span>
                </div>
              ))}
            </div>
          )}
        </Block>

        <Block title="Financeiro">
          <div className="grid grid-cols-2 gap-3">
            <Metric label="GMV" value={`R$ ${gmv.toFixed(2)}`} />
            <Metric label="Comissão arrecadada" value={`R$ ${comissao.toFixed(2)}`} />
            <Metric label="Retido no gateway" value={`R$ ${retido.toFixed(2)}`} />
            <Metric label="Já repassado" value={`R$ ${repassado.toFixed(2)}`} />
          </div>
          <p className="text-xs text-gray-400 mt-2">
            Zerado até a integração com o Pagar.me entrar em produção.
          </p>
        </Block>

        <Block title="Usuários">
          <div className="grid grid-cols-2 gap-3">
            <Metric label="Tutores ativos" value={String(tutorCount ?? 0)} />
            <Metric label="Profissionais ativos" value={String(professionalCount ?? 0)} />
          </div>
        </Block>

        <Block title="Incidentes e disputas">
          <div className="grid grid-cols-2 gap-3">
            <Metric label="Abertos" value={String(incidentsOpen ?? 0)} />
            <Metric label="Resolvidos" value={String(incidentsResolved ?? 0)} />
          </div>
        </Block>

        <Block title="Habilitações">
          <div className="flex items-center justify-between">
            <Metric label="Pendentes de revisão" value={String(certificationsPending ?? 0)} />
            <Link href="/admin/habilitacoes" className="text-sm font-semibold text-teal hover:underline">
              Revisar
            </Link>
          </div>
        </Block>
      </div>
    </main>
  );
}

function Block({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="rounded-lg border border-gray-200 bg-white p-4">
      <h2 className="text-sm font-semibold text-black mb-3">{title}</h2>
      {children}
    </section>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-xs text-gray-500">{label}</p>
      <p className="text-lg font-bold text-teal">{value}</p>
    </div>
  );
}

function EmptyRow() {
  return <p className="text-sm text-gray-400">Nenhum dado ainda.</p>;
}
