import type { Json, ServiceCategory } from "@/types/database";

/**
 * Nomes de evento aceitos em `analytics_events` (dashboard de KPIs do
 * Admin, itens 19-20 — funil "C" da especificação externa). Lista fechada
 * de propósito: cada novo evento precisa passar por aqui primeiro, pra
 * `admin_kpi_funnel`/`admin_kpi_summary` saberem o que esperar.
 */
export type AnalyticsEventName =
  | "search_result_view"
  | "professional_profile_view"
  | "request_started"
  | "request_submitted"
  | "signup_started"
  | "signup_completed";

export type AnalyticsEventInput = {
  profile_id?: string;
  professional_id?: string;
  request_id?: string;
  category?: ServiceCategory;
  uf?: string;
  source?: string;
  medium?: string;
  campaign?: string;
  metadata?: Json;
};
