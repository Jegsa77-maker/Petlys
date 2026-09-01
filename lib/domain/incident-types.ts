import type { IncidentUrgency } from "@/types/database";

/**
 * Classificação do incidente pro botão "Preciso de ajuda" (seção 8.2 da
 * Especificação v2.0, item 2 da Onda 4). Fixa no código por enquanto —
 * o que É configurável pelo Admin sem deploy é o SLA de cada tipo
 * (platform_parameters, chave1='sla_incidente_horas', chave2=type),
 * não a lista de tipos em si nem a urgência padrão.
 */
export const INCIDENT_TYPE_OPTIONS = [
  {
    value: "agressao_comportamento_perigoso",
    label: "Agressão ou comportamento perigoso",
    defaultUrgency: "emergencia" as IncidentUrgency,
  },
  {
    value: "emergencia_medica",
    label: "Emergência médica",
    defaultUrgency: "emergencia" as IncidentUrgency,
  },
  {
    value: "dano_propriedade",
    label: "Dano à propriedade",
    defaultUrgency: "alta" as IncidentUrgency,
  },
  {
    value: "descumprimento_combinado",
    label: "Descumprimento do combinado",
    defaultUrgency: "alta" as IncidentUrgency,
  },
  {
    value: "comportamento_inadequado",
    label: "Comportamento inadequado da outra parte",
    defaultUrgency: "media" as IncidentUrgency,
  },
  {
    value: "outro",
    label: "Outro",
    defaultUrgency: "baixa" as IncidentUrgency,
  },
] as const;

export type IncidentTypeValue = (typeof INCIDENT_TYPE_OPTIONS)[number]["value"];

export function incidentTypeLabel(type: string): string {
  return INCIDENT_TYPE_OPTIONS.find((o) => o.value === type)?.label ?? type;
}

export function defaultUrgencyForType(type: string): IncidentUrgency {
  return INCIDENT_TYPE_OPTIONS.find((o) => o.value === type)?.defaultUrgency ?? "media";
}
