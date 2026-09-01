import type { OccurrenceStatus, ServiceCategory } from "@/types/database";

/**
 * Pipeline de execução por categoria (seção 5.2 da Especificação v2.0,
 * item 1 da Onda 4) — o enum `occurrence_status` continua genérico e
 * único (agendado/checkin/em_andamento/finalizacao/concluido), cumprindo
 * o critério de aceite de "um único modelo de status" (seção 15); só o
 * RÓTULO exibido em cada fase muda por categoria de serviço. Nenhuma
 * migration, nenhuma lógica de transição nova.
 *
 * "Buscado"/"Entregue" não é uma fase extra: é o mesmo `concluido` de
 * sempre, só que descrito do ponto de vista de quem usa o Kanban (o
 * profissional entrega o pet de volta) — banho/tosa e hospedagem
 * compartilham essa mesma leitura porque fisicamente são o mesmo caso
 * (pet fica no local até o tutor retornar).
 */
const STAGE_LABEL_BY_CATEGORY: Partial<
  Record<ServiceCategory, Partial<Record<OccurrenceStatus, string>>>
> = {
  passeador: {
    checkin: "Pet recebido",
    em_andamento: "Passeio iniciado",
    finalizacao: "Retorno",
  },
  hospedagem_creche: {
    checkin: "Entrada",
    em_andamento: "Hospedado",
    finalizacao: "Preparando saída",
    concluido: "Entregue",
  },
  banho_tosa: {
    finalizacao: "Pronto pra retirada",
    concluido: "Entregue",
  },
  pet_sitter: {
    checkin: "Check-in no local",
    finalizacao: "Relatório",
  },
  adestrador: {
    checkin: "Sessão iniciada",
    finalizacao: "Plano/orientações",
  },
  veterinario_domiciliar: {
    em_andamento: "Atendimento",
    finalizacao: "Orientações/receita",
  },
};

const GENERIC_STAGE_LABEL: Partial<Record<OccurrenceStatus, string>> = {
  checkin: "Início do atendimento",
  em_andamento: "Em andamento",
  finalizacao: "Finalização",
  concluido: "Concluído",
};

/** Nome da fase pro Kanban, respeitando a categoria — cai no genérico se a categoria não tiver um nome próprio pra essa fase. */
export function occurrenceStageLabel(category: ServiceCategory, status: OccurrenceStatus): string {
  return STAGE_LABEL_BY_CATEGORY[category]?.[status] ?? GENERIC_STAGE_LABEL[status] ?? status;
}
