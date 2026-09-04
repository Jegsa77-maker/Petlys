/**
 * Card de KPI do dashboard do Admin — valor + delta vs. período anterior
 * de mesmo tamanho (convenção de admin_kpi_delta, ver 0065_admin_kpi_summary.sql).
 * Sem os selos "Fonte existente/Exige regra" do mockup original — são
 * jargão interno de dev, não fazem sentido pro Admin de verdade usando a
 * tela. O único aviso que sobrevive é "Aguardando Onda 3" nos financeiros.
 */
export function KpiCard({
  label,
  value,
  deltaPct,
  suffix,
  pendingOnda3,
}: {
  label: string;
  value: number | string | null | undefined;
  deltaPct?: number | null;
  suffix?: string;
  pendingOnda3?: boolean;
}) {
  const displayValue = value === null || value === undefined ? "—" : value;

  return (
    <div className="rounded-lg border border-gray-200 bg-white p-4">
      <p className="text-xs text-gray-500">{label}</p>
      <p className="text-lg font-bold text-teal">
        {displayValue}
        {suffix && displayValue !== "—" ? suffix : ""}
      </p>
      {typeof deltaPct === "number" && (
        <p className={`text-xs font-semibold ${deltaPct >= 0 ? "text-teal" : "text-red-600"}`}>
          {deltaPct >= 0 ? "+" : ""}
          {deltaPct}% vs. período anterior
        </p>
      )}
      {pendingOnda3 && <p className="text-[10px] text-gray-400 mt-1">Aguardando Onda 3</p>}
    </div>
  );
}

export function KpiGrid({ children }: { children: React.ReactNode }) {
  return <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">{children}</div>;
}
