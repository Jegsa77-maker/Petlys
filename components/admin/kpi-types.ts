/**
 * Formato dos payloads jsonb devolvidos pelas RPCs de KPI (o Postgres não
 * expõe a estrutura interna do jsonb pro gerador de tipos — `Json` puro
 * seria inútil aqui, então mantemos essas formas à mão, espelhando
 * exatamente o `jsonb_build_object` de cada função em
 * supabase/migrations/0065-0068).
 */
export type Delta = { valor: number | null; delta_pct?: number | null };

export type AdminKpiSummary = {
  executivo: Record<string, Delta>;
  crescimento: Record<string, Delta>;
  demanda: Record<string, Delta>;
  qualidade: Record<string, Delta>;
};

export type AdminKpiFunnel = {
  coorte: Record<string, number>;
  taxas: Record<string, number | null>;
  aquisicao: Record<string, number | null>;
};

export type AdminKpiFinanceiro = {
  gmv: number;
  comissao_arrecadada: number;
  comissao_media_pct: number | null;
  pagamentos_por_status: Record<string, { qtd: number; valor: number }>;
  valores_a_repassar: number;
  repasses_por_status: Record<string, { qtd: number; valor: number }>;
  cancelamentos: { qtd: number; reembolsado: number };
  chargebacks_por_status: Record<string, { qtd: number; valor: number }>;
  divergencias_conciliacao_por_categoria: Record<string, number>;
};
