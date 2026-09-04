"use client";

import { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
} from "recharts";
import { KpiCard, KpiGrid } from "@/components/admin/kpi-card";
import { CoverageMapLoader } from "@/components/admin/coverage-map-loader";
import type { CoveragePoint } from "@/components/admin/coverage-map";
import { UF_LABEL, PERIOD_OPTIONS, AREA_LABEL, type KpiArea } from "@/components/admin/kpi-definitions";
import type { AdminKpiSummary, AdminKpiFunnel, AdminKpiFinanceiro } from "@/components/admin/kpi-types";

const CATEGORY_LABEL: Record<string, string> = {
  pet_sitter: "Pet sitter / cuidador",
  passeador: "Passeador de cães",
  hospedagem_creche: "Hospedagem / creche",
  adestrador: "Adestrador / comportamentalista",
  banho_tosa: "Banho e tosa",
  veterinario_domiciliar: "Veterinário domiciliar",
};

function brl(value: number | null | undefined) {
  if (value === null || value === undefined) return "—";
  return `R$ ${value.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

export function DashboardShell({
  filters,
  summary,
  funnel,
  financeiro,
  timeseries,
  coveragePoints,
  habilitacoesPendentes,
}: {
  filters: { periodo: string; uf: string; categoria: string };
  summary: AdminKpiSummary;
  funnel: AdminKpiFunnel;
  financeiro: AdminKpiFinanceiro;
  timeseries: { bucket: string; value: number }[];
  coveragePoints: CoveragePoint[];
  habilitacoesPendentes: number;
}) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [area, setArea] = useState<KpiArea>("executivo");

  function updateFilter(key: string, value: string) {
    const params = new URLSearchParams(searchParams.toString());
    if (value) params.set(key, value);
    else params.delete(key);
    router.push(`/admin/dashboard?${params.toString()}`);
  }

  return (
    <div className="flex flex-col gap-6">
      {habilitacoesPendentes > 0 && (
        <a
          href="/admin/habilitacoes"
          className="rounded-lg border border-teal/30 bg-teal/5 px-4 py-3 text-sm font-semibold text-teal hover:underline"
        >
          {habilitacoesPendentes} habilitação(ões) de profissional pendente(s) de revisão →
        </a>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <label className="text-xs text-gray-500">
          Período
          <select
            value={filters.periodo}
            onChange={(e) => updateFilter("periodo", e.target.value)}
            className="input mt-1"
          >
            {PERIOD_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
        </label>
        <label className="text-xs text-gray-500">
          Região
          <select value={filters.uf} onChange={(e) => updateFilter("uf", e.target.value)} className="input mt-1">
            <option value="">Todas as regiões</option>
            {Object.entries(UF_LABEL).map(([uf, label]) => (
              <option key={uf} value={uf}>
                {label}
              </option>
            ))}
          </select>
        </label>
        <label className="text-xs text-gray-500">
          Serviço
          <select
            value={filters.categoria}
            onChange={(e) => updateFilter("categoria", e.target.value)}
            className="input mt-1"
          >
            <option value="">Todos os serviços</option>
            {Object.entries(CATEGORY_LABEL).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
        </label>
      </div>

      <div className="flex gap-1 overflow-x-auto border-b border-gray-200 pb-px">
        {(Object.keys(AREA_LABEL) as KpiArea[]).map((a) => (
          <button
            key={a}
            type="button"
            onClick={() => setArea(a)}
            className={`whitespace-nowrap px-3 py-2 text-sm font-semibold border-b-2 transition-colors ${
              area === a ? "border-teal text-teal" : "border-transparent text-gray-500"
            }`}
          >
            {AREA_LABEL[a]}
          </button>
        ))}
      </div>

      {area === "executivo" && (
        <>
          <KpiGrid>
            <KpiCard label="Tutores ativos" value={summary.executivo.tutores_ativos?.valor} deltaPct={summary.executivo.tutores_ativos?.delta_pct} />
            <KpiCard label="Profissionais ativos" value={summary.executivo.profissionais_ativos?.valor} deltaPct={summary.executivo.profissionais_ativos?.delta_pct} />
            <KpiCard label="Solicitações criadas" value={summary.executivo.solicitacoes_criadas?.valor} deltaPct={summary.executivo.solicitacoes_criadas?.delta_pct} />
            <KpiCard label="Serviços confirmados" value={summary.executivo.servicos_confirmados?.valor} deltaPct={summary.executivo.servicos_confirmados?.delta_pct} />
            <KpiCard label="Serviços concluídos" value={summary.executivo.servicos_concluidos?.valor} deltaPct={summary.executivo.servicos_concluidos?.delta_pct} />
            <KpiCard label="GMV" value={brl(summary.executivo.gmv?.valor)} deltaPct={summary.executivo.gmv?.delta_pct} pendingOnda3 />
            <KpiCard label="Receita Petlys" value={brl(summary.executivo.receita_petlys?.valor)} deltaPct={summary.executivo.receita_petlys?.delta_pct} pendingOnda3 />
            <KpiCard label="Ticket médio" value={brl(summary.executivo.ticket_medio?.valor)} deltaPct={summary.executivo.ticket_medio?.delta_pct} pendingOnda3 />
          </KpiGrid>
          <WeeklyChart title="Solicitações por semana" data={timeseries} />
        </>
      )}

      {area === "crescimento" && (
        <KpiGrid>
          <KpiCard label="Novos tutores" value={summary.crescimento.novos_tutores?.valor} deltaPct={summary.crescimento.novos_tutores?.delta_pct} />
          <KpiCard label="Novos profissionais (cadastrados)" value={summary.crescimento.novos_profissionais_cadastrados?.valor} deltaPct={summary.crescimento.novos_profissionais_cadastrados?.delta_pct} />
          <KpiCard label="Novos profissionais (aprovados)" value={summary.crescimento.novos_profissionais_aprovados?.valor} />
          <KpiCard label="Novos profissionais (reprovados)" value={summary.crescimento.novos_profissionais_reprovados?.valor} />
          <KpiCard label="Crescimento base ativa (tutores)" value={summary.crescimento.crescimento_base_ativa_tutores?.delta_pct != null ? `${summary.crescimento.crescimento_base_ativa_tutores.delta_pct}%` : "—"} />
          <KpiCard label="Crescimento base ativa (profissionais)" value={summary.crescimento.crescimento_base_ativa_profissionais?.delta_pct != null ? `${summary.crescimento.crescimento_base_ativa_profissionais.delta_pct}%` : "—"} />
          <KpiCard label="Cobertura ativa (UFs com oferta e demanda)" value={summary.crescimento.cobertura_ativa_ufs?.valor} />
        </KpiGrid>
      )}

      {area === "demanda" && (
        <KpiGrid>
          <KpiCard label="Oferta disponível (profissionais aptos)" value={summary.demanda.oferta_disponivel?.valor} />
          <KpiCard label="Solicitações sem proposta" value={summary.demanda.solicitacoes_sem_proposta?.valor} />
          <KpiCard label="Tempo até 1ª resposta" value={summary.demanda.tempo_primeira_resposta_horas?.valor} suffix="h" />
          <KpiCard label="Tempo até 1ª proposta" value={summary.demanda.tempo_primeira_proposta_horas?.valor} suffix="h" />
          <KpiCard label="Demanda atendida" value={summary.demanda.demanda_atendida_pct?.valor} suffix="%" />
        </KpiGrid>
      )}

      {area === "funil" && (
        <div className="flex flex-col gap-4">
          <FunnelBars
            steps={[
              { label: "Solicitações", value: funnel.coorte.solicitacoes },
              { label: "Com proposta", value: funnel.coorte.com_proposta },
              { label: "Aceitas", value: funnel.coorte.aceitas },
              { label: "Pagas", value: funnel.coorte.pagas },
              { label: "Concluídas", value: funnel.coorte.concluidas },
            ]}
          />
          <KpiGrid>
            <KpiCard label="Solicitação → proposta" value={funnel.taxas.solicitacao_proposta_pct} suffix="%" />
            <KpiCard label="Proposta → aceite" value={funnel.taxas.proposta_aceite_pct} suffix="%" />
            <KpiCard label="Aceite → pagamento" value={funnel.taxas.aceite_pagamento_pct} suffix="%" pendingOnda3 />
            <KpiCard label="Pagamento → conclusão" value={funnel.taxas.pagamento_conclusao_pct} suffix="%" pendingOnda3 />
            <KpiCard label="Conversão total" value={funnel.taxas.conversao_total_pct} suffix="%" />
            <KpiCard label="Busca → perfil" value={funnel.aquisicao.busca_perfil_pct} suffix="%" />
            <KpiCard label="Perfil → solicitação" value={funnel.aquisicao.perfil_solicitacao_pct} suffix="%" />
          </KpiGrid>
        </div>
      )}

      {area === "financeiro" && (
        <div className="flex flex-col gap-4">
          <p className="text-xs text-gray-400">
            Zerado até a integração com o Pagar.me entrar em produção (beta usa confirmação manual de pagamento).
          </p>
          <KpiGrid>
            <KpiCard label="GMV" value={brl(financeiro.gmv)} pendingOnda3 />
            <KpiCard label="Comissão arrecadada" value={brl(financeiro.comissao_arrecadada)} pendingOnda3 />
            <KpiCard label="Comissão média" value={financeiro.comissao_media_pct} suffix="%" pendingOnda3 />
            <KpiCard label="Valores a repassar" value={brl(financeiro.valores_a_repassar)} pendingOnda3 />
            <KpiCard label="Cancelamentos" value={financeiro.cancelamentos.qtd} />
            <KpiCard label="Reembolsado" value={brl(financeiro.cancelamentos.reembolsado)} pendingOnda3 />
          </KpiGrid>
          <StatusBreakdown title="Pagamentos por status" data={financeiro.pagamentos_por_status} />
          <StatusBreakdown title="Repasses por status" data={financeiro.repasses_por_status} />
          <StatusBreakdown title="Chargebacks por status" data={financeiro.chargebacks_por_status} />
          {Object.keys(financeiro.divergencias_conciliacao_por_categoria).length > 0 && (
            <div className="rounded-lg border border-gray-200 bg-white p-4">
              <h3 className="text-sm font-semibold text-black mb-2">Divergências de conciliação abertas</h3>
              {Object.entries(financeiro.divergencias_conciliacao_por_categoria).map(([cat, qtd]) => (
                <div key={cat} className="flex justify-between text-sm text-gray-600">
                  <span>{cat}</span>
                  <span className="font-semibold text-black">{qtd}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {area === "qualidade" && (
        <KpiGrid>
          <KpiCard label="Nota média" value={summary.qualidade.nota_media?.valor} />
          <KpiCard label="Cancelamento do tutor" value={summary.qualidade.cancelamento_tutor_pct?.valor} suffix="%" />
          <KpiCard label="Cancelamento do profissional" value={summary.qualidade.cancelamento_profissional_pct?.valor} suffix="%" />
          <KpiCard label="Incidentes abertos" value={summary.qualidade.incidentes_abertos?.valor} />
          <KpiCard label="Incidentes resolvidos" value={summary.qualidade.incidentes_resolvidos?.valor} />
          <KpiCard label="Tempo de resolução" value={summary.qualidade.tempo_resolucao_horas?.valor} suffix="h" />
          <KpiCard label="No-show do tutor" value={summary.qualidade.no_show_tutor?.valor} />
          <KpiCard label="No-show do profissional" value={summary.qualidade.no_show_profissional?.valor} />
          <KpiCard label="Recorrência dos tutores (30d)" value={summary.qualidade.recorrencia_tutores_pct?.valor} suffix="%" />
          <KpiCard label="Retenção dos profissionais (30d)" value={summary.qualidade.retencao_profissionais_pct?.valor} suffix="%" />
        </KpiGrid>
      )}

      <section className="rounded-lg border border-gray-200 bg-white p-4">
        <h2 className="text-sm font-semibold text-black mb-3">Cobertura geográfica</h2>
        {coveragePoints.length === 0 ? (
          <p className="text-sm text-gray-400">Nenhum dado ainda.</p>
        ) : (
          <CoverageMapLoader points={coveragePoints} />
        )}
        <p className="text-xs text-gray-400 mt-2">
          Um círculo por cidade — tutores e profissionais contados separadamente, sem mostrar
          endereço exato de ninguém. Ajuda a identificar regiões com demanda ou oferta sem
          cobertura, pra priorizar investimento em marketing.
        </p>
      </section>
    </div>
  );
}

function WeeklyChart({ title, data }: { title: string; data: { bucket: string; value: number }[] }) {
  if (data.length === 0) {
    return (
      <div className="rounded-lg border border-gray-200 bg-white p-4">
        <h3 className="text-sm font-semibold text-black mb-2">{title}</h3>
        <p className="text-sm text-gray-400">Nenhum dado no período.</p>
      </div>
    );
  }
  return (
    <div className="rounded-lg border border-gray-200 bg-white p-4">
      <h3 className="text-sm font-semibold text-black mb-3">{title}</h3>
      <div className="h-[220px]">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data}>
            <CartesianGrid strokeDasharray="3 3" vertical={false} />
            <XAxis dataKey="bucket" tick={{ fontSize: 11 }} />
            <YAxis tick={{ fontSize: 11 }} allowDecimals={false} />
            <Tooltip />
            <Bar dataKey="value" fill="#0b4d52" radius={[4, 4, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

function FunnelBars({ steps }: { steps: { label: string; value: number }[] }) {
  const max = Math.max(1, ...steps.map((s) => s.value));
  return (
    <div className="rounded-lg border border-gray-200 bg-white p-4">
      <h3 className="text-sm font-semibold text-black mb-3">Conversão do funil (por coorte de entrada)</h3>
      <div className="flex flex-col gap-2">
        {steps.map((s) => (
          <div key={s.label}>
            <div className="flex justify-between text-xs text-gray-600 mb-1">
              <span>{s.label}</span>
              <span className="font-semibold text-black">{s.value}</span>
            </div>
            <div className="h-2 w-full rounded-full bg-gray-100">
              <div
                className="h-2 rounded-full bg-teal"
                style={{ width: `${Math.max(2, (s.value / max) * 100)}%` }}
              />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function StatusBreakdown({ title, data }: { title: string; data: Record<string, { qtd: number; valor: number }> }) {
  const entries = Object.entries(data);
  if (entries.length === 0) return null;
  return (
    <div className="rounded-lg border border-gray-200 bg-white p-4">
      <h3 className="text-sm font-semibold text-black mb-2">{title}</h3>
      <div className="flex flex-col gap-1">
        {entries.map(([status, { qtd, valor }]) => (
          <div key={status} className="flex justify-between text-sm text-gray-600">
            <span>{status}</span>
            <span className="font-semibold text-black">
              {qtd} · {brl(valor)}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
