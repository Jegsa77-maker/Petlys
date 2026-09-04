/**
 * Rótulos exibidos no dashboard de KPIs do Admin — chaves batem com o
 * jsonb devolvido por admin_kpi_summary/admin_kpi_funnel/admin_kpi_financeiro
 * (supabase/migrations/0065-0068). Mantido separado do componente pra não
 * misturar "o que o número significa" com "como ele é renderizado".
 */
export const UF_LABEL: Record<string, string> = {
  AC: "Acre", AL: "Alagoas", AP: "Amapá", AM: "Amazonas", BA: "Bahia", CE: "Ceará",
  DF: "Distrito Federal", ES: "Espírito Santo", GO: "Goiás", MA: "Maranhão",
  MT: "Mato Grosso", MS: "Mato Grosso do Sul", MG: "Minas Gerais", PA: "Pará",
  PB: "Paraíba", PR: "Paraná", PE: "Pernambuco", PI: "Piauí", RJ: "Rio de Janeiro",
  RN: "Rio Grande do Norte", RS: "Rio Grande do Sul", RO: "Rondônia", RR: "Roraima",
  SC: "Santa Catarina", SP: "São Paulo", SE: "Sergipe", TO: "Tocantins",
};

export const PERIOD_OPTIONS = [
  { value: "7", label: "Últimos 7 dias" },
  { value: "30", label: "Últimos 30 dias" },
  { value: "90", label: "Últimos 90 dias" },
] as const;

export type KpiArea = "executivo" | "crescimento" | "demanda" | "funil" | "financeiro" | "qualidade";

export const AREA_LABEL: Record<KpiArea, string> = {
  executivo: "Visão executiva",
  crescimento: "Crescimento",
  demanda: "Oferta e demanda",
  funil: "Funil",
  financeiro: "Financeiro",
  qualidade: "Qualidade e segurança",
};
