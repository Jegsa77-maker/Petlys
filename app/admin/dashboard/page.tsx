import { createClient } from "@/lib/supabase/server";
import { DashboardShell } from "@/components/admin/dashboard-shell";
import type { CoveragePoint } from "@/components/admin/coverage-map";
import type { AdminKpiSummary, AdminKpiFunnel, AdminKpiFinanceiro } from "@/components/admin/kpi-types";
import type { ServiceCategory } from "@/types/database";

function toDateStr(d: Date) {
  return d.toISOString().slice(0, 10);
}

export default async function AdminDashboardPage({
  searchParams,
}: {
  searchParams: Promise<{ periodo?: string; uf?: string; categoria?: string }>;
}) {
  const { periodo = "30", uf = "", categoria = "" } = await searchParams;
  const supabase = await createClient();

  const days = Number(periodo) || 30;
  const to = new Date();
  const from = new Date(to);
  from.setDate(from.getDate() - (days - 1));

  const pFrom = toDateStr(from);
  const pTo = toDateStr(to);
  const pCategory = categoria ? (categoria as ServiceCategory) : undefined;
  const pUf = uf || undefined;

  const [
    { data: summary, error: summaryError },
    { data: funnel, error: funnelError },
    { data: financeiro, error: financeiroError },
    { data: timeseriesRows },
    { data: coverageRows },
    { count: habilitacoesPendentes },
  ] = await Promise.all([
    supabase.rpc("admin_kpi_summary", { p_from: pFrom, p_to: pTo, p_category: pCategory, p_uf: pUf }),
    supabase.rpc("admin_kpi_funnel", { p_from: pFrom, p_to: pTo, p_category: pCategory, p_uf: pUf }),
    supabase.rpc("admin_kpi_financeiro", { p_from: pFrom, p_to: pTo, p_category: pCategory, p_uf: pUf }),
    supabase.rpc("admin_kpi_timeseries", {
      p_metric: "solicitacoes",
      p_from: pFrom,
      p_to: pTo,
      p_category: pCategory,
      p_uf: pUf,
    }),
    supabase.rpc("admin_kpi_geo_coverage", { p_category: pCategory }),
    supabase.from("professional_certifications").select("id", { count: "exact", head: true }).eq("status", "pendente"),
  ]);

  if (summaryError || funnelError || financeiroError) {
    console.error("[admin/dashboard]", { summaryError, funnelError, financeiroError });
    return (
      <main className="min-h-screen bg-offwhite px-4 py-8">
        <div className="max-w-4xl mx-auto">
          <h1 className="text-2xl font-bold text-teal mb-4">Painel do Administrador</h1>
          <p className="text-sm text-red-600">
            Não foi possível carregar os KPIs agora. Tente recarregar a página.
          </p>
        </div>
      </main>
    );
  }

  const coveragePoints: CoveragePoint[] = (coverageRows ?? []).map((row) => ({
    cityLabel: row.city_label,
    uf: row.uf,
    lat: row.lat,
    lng: row.lng,
    tutores: row.tutores,
    profissionais: row.profissionais,
  }));

  const timeseries = (timeseriesRows ?? []).map((row) => ({
    bucket: new Date(row.bucket).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" }),
    value: Number(row.value),
  }));

  return (
    <main className="min-h-screen bg-offwhite px-4 py-8">
      <div className="max-w-4xl mx-auto flex flex-col gap-6">
        <h1 className="text-2xl font-bold text-teal">Painel do Administrador</h1>
        <DashboardShell
          filters={{ periodo, uf, categoria }}
          summary={summary as unknown as AdminKpiSummary}
          funnel={funnel as unknown as AdminKpiFunnel}
          financeiro={financeiro as unknown as AdminKpiFinanceiro}
          timeseries={timeseries}
          coveragePoints={coveragePoints}
          habilitacoesPendentes={habilitacoesPendentes ?? 0}
        />
      </div>
    </main>
  );
}
