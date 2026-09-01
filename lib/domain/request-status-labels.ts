/**
 * Rótulo em português de cada `request_status` — existia duplicado
 * (idêntico) em 3 arquivos até essa consolidação (achado revisando
 * todas as telas contra o padrão de CX). Usado em qualquer lugar que
 * mostre o status de uma solicitação pra humano — nunca o valor cru do
 * enum.
 */
export const REQUEST_STATUS_LABEL: Record<string, string> = {
  rascunho: "Rascunho",
  solicitacao_enviada: "Solicitação enviada",
  em_conversa: "Em conversa",
  proposta_enviada: "Proposta enviada",
  aguardando_pagamento: "Aguardando pagamento",
  confirmado: "Confirmado",
  checkin: "Check-in",
  em_andamento: "Em andamento",
  finalizacao: "Finalização",
  concluido: "Concluído",
  avaliacao: "Avaliação",
  recusado: "Recusado",
  expirado: "Expirado",
  cancelado: "Cancelado",
  incidente: "Incidente",
  em_disputa: "Em disputa",
};
