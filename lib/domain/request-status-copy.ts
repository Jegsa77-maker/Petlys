import type { RequestStatus } from "@/types/database";

type ViewerRole = "tutor" | "profissional" | "staff";

/**
 * Frase em linguagem simples pra cada status, do ponto de vista de quem
 * está olhando (M-013, iniciativa de CX — "textos que indiquem
 * claramente a próxima ação"). Os nomes técnicos do status continuam
 * existindo (enum, badge pequeno) — isto aqui é só a tradução direta
 * pro que a pessoa precisa saber/fazer agora, sem trocar nada de
 * funcional.
 */
const NEXT_ACTION: Partial<Record<RequestStatus, Record<ViewerRole, string>>> = {
  // "Conversa prévia" (chat antes de formalizar, ver 0042_conversa_previa.sql)
  // é hoje o único jeito comum de uma request legítima ficar em rascunho por
  // um tempo — um rascunho comum abandonado no meio do formulário completo
  // nunca é visitado de novo (não aparece com id nenhum lugar clicável), então
  // não precisa de um texto separado pra esse caso raro.
  rascunho: {
    tutor: "Converse à vontade — quando quiser, envie um pedido completo.",
    profissional: "O tutor só está tirando uma dúvida ainda. Responda quando puder.",
    staff: "Conversa antes de uma solicitação formal.",
  },
  solicitacao_enviada: {
    tutor: "Aguardando o profissional responder.",
    profissional: "Nova solicitação — dê uma olhada e responda.",
    staff: "Aguardando o profissional responder.",
  },
  em_conversa: {
    tutor: "Continue a conversa pra alinhar os detalhes.",
    profissional: "Alinhe os detalhes e envie uma proposta quando estiver pronto.",
    staff: "As partes estão alinhando os detalhes.",
  },
  proposta_enviada: {
    tutor: "Você recebeu uma proposta — revise e decida.",
    profissional: "Aguardando o tutor decidir sobre a proposta.",
    staff: "Aguardando decisão do tutor sobre a proposta.",
  },
  aguardando_pagamento: {
    tutor: "Falta confirmar o pagamento pra garantir o atendimento.",
    profissional: "Aguardando o pagamento do tutor.",
    staff: "Aguardando pagamento.",
  },
  confirmado: {
    tutor: "Atendimento confirmado — revise os detalhes antes do dia.",
    profissional: "Atendimento confirmado — prepare-se.",
    staff: "Atendimento confirmado.",
  },
  checkin: {
    tutor: "O atendimento está começando.",
    profissional: "Check-in feito — pode iniciar o atendimento.",
    staff: "Atendimento em check-in.",
  },
  em_andamento: {
    tutor: "O atendimento está em andamento.",
    profissional: "Atendimento em andamento.",
    staff: "Atendimento em andamento.",
  },
  finalizacao: {
    tutor: "O profissional está finalizando o atendimento.",
    profissional: "Finalize o atendimento e envie o relatório.",
    staff: "Atendimento em finalização.",
  },
  concluido: {
    tutor: "Atendimento concluído — que tal avaliar?",
    profissional: "Atendimento concluído.",
    staff: "Atendimento concluído.",
  },
  avaliacao: {
    tutor: "Deixe sua avaliação sobre o atendimento.",
    profissional: "Deixe sua avaliação sobre o tutor.",
    staff: "Aguardando avaliação das partes.",
  },
  recusado: {
    tutor: "O profissional recusou esta solicitação.",
    profissional: "Você recusou esta solicitação.",
    staff: "Solicitação recusada.",
  },
  expirado: {
    tutor: "Essa proposta expirou — peça uma nova pelo chat.",
    profissional: "Sua proposta expirou.",
    staff: "Proposta expirada.",
  },
  cancelado: {
    tutor: "Esse atendimento foi cancelado.",
    profissional: "Esse atendimento foi cancelado.",
    staff: "Atendimento cancelado.",
  },
  incidente: {
    tutor: "Há um problema em análise nesse atendimento.",
    profissional: "Há um problema em análise nesse atendimento.",
    staff: "Incidente em análise.",
  },
  em_disputa: {
    tutor: "Esse caso está em análise administrativa.",
    profissional: "Esse caso está em análise administrativa.",
    staff: "Disputa em análise.",
  },
};

export function nextActionCopy(status: string, viewerRole: ViewerRole): string | null {
  return NEXT_ACTION[status as RequestStatus]?.[viewerRole] ?? null;
}
