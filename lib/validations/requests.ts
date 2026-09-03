import { z } from "zod";

const SERVICE_CATEGORIES = [
  "pet_sitter",
  "passeador",
  "hospedagem_creche",
  "adestrador",
  "banho_tosa",
  "veterinario_domiciliar",
] as const;

export const RECURRENCE_INTERVAL_DAYS = {
  diario: 1,
  semanal: 7,
  quinzenal: 14,
  mensal: 30,
} as const;

export const createRequestSchema = z.object({
  professionalId: z.uuid("Profissional inválido"),
  category: z.enum(SERVICE_CATEGORIES, { message: "Selecione a categoria do serviço" }),
  petIds: z.array(z.uuid()).min(1, "Selecione ao menos um pet"),
  isRecurring: z.boolean(),
  occurrencesTotal: z.coerce.number().int().min(1).default(1),
  recurrenceInterval: z.enum(["diario", "semanal", "quinzenal", "mensal"]).default("semanal"),
  firstOccurrenceAt: z.string().min(1, "Informe a data e hora do primeiro atendimento"),
  notes: z.string().trim().max(2000).optional(),
  isVisitaInicial: z.boolean().default(false),
  // Consentimento explícito de compartilhar a ficha dos pets selecionados
  // com este profissional (seção 6.4) — obrigatório, registrado em
  // requests.prontuario_shared_at na criação (0018_terms_consent_...sql).
  prontuarioConsent: z.boolean().refine((v) => v === true, {
    message: "Autorize o compartilhamento da ficha do pet para continuar",
  }),
  // Solicitação contextual (seção 12.1, item 4 da Onda 2) — nenhum dos dois
  // é obrigatório: local nem sempre se aplica, perguntas são pra ajudar o
  // Profissional a decidir, não uma barreira de envio.
  address: z.string().trim().max(300).optional(),
  categoryAnswers: z.record(z.string(), z.string().trim().max(1000)).default({}),
  // Preenchido quando o formulário completo nasce de uma conversa prévia
  // (ver startConversationSchema abaixo) — createRequest atualiza essa
  // request já existente em vez de criar uma nova, preservando o chat.
  existingRequestId: z.uuid().optional(),
});
export type CreateRequestValues = z.infer<typeof createRequestSchema>;

/**
 * "Conversar" no perfil do profissional (chat antes de formalizar uma
 * solicitação completa) — cria uma `requests` mínima em rascunho, só com
 * categoria (obrigatória no schema de requests). Nenhuma mudança de RLS: o
 * chat já funciona em qualquer status, ver 0042_conversa_previa.sql.
 */
export const startConversationSchema = z.object({
  professionalId: z.uuid("Profissional inválido"),
  category: z.enum(SERVICE_CATEGORIES, { message: "Selecione o assunto da conversa" }),
});
export type StartConversationValues = z.infer<typeof startConversationSchema>;

// Pedido de ajuste (seção 12.1, item 5 da Onda 2) — Tutor devolve a
// proposta pro Profissional com o que quer mudar, sem precisar recusar de
// vez (0024_proposta_ajuste.sql libera a transição de status).
export const requestAdjustmentSchema = z.object({
  requestId: z.uuid(),
  proposalId: z.uuid(),
  feedback: z.string().trim().min(1, "Descreva o que você gostaria de ajustar").max(1000),
});
export type RequestAdjustmentValues = z.infer<typeof requestAdjustmentSchema>;

// Reagendar uma ocorrência específica (seção 12.1, item 7 — recorrência
// avançada) — nunca bloqueia o Profissional, só move a data.
export const rescheduleOccurrenceSchema = z.object({
  occurrenceId: z.uuid(),
  newScheduledAt: z.string().min(1, "Informe a nova data e hora"),
});
export type RescheduleOccurrenceValues = z.infer<typeof rescheduleOccurrenceSchema>;

// Editar a recorrência dali pra frente sem corromper ocorrências já
// executadas (seção 12.1, item 7).
export const updateRecurrenceSchema = z.object({
  requestId: z.uuid(),
  newInterval: z.enum(["diario", "semanal", "quinzenal", "mensal"]),
});
export type UpdateRecurrenceValues = z.infer<typeof updateRecurrenceSchema>;

export const sendMessageSchema = z.object({
  requestId: z.uuid(),
  content: z.string().trim().min(1, "Escreva uma mensagem").max(4000),
});
export type SendMessageValues = z.infer<typeof sendMessageSchema>;

/**
 * Agenda flexível (seção 1.2/5 da Especificação v2.0 — "a plataforma
 * organiza e recomenda, mas não impõe agenda"): o Profissional decide se
 * mantém o horário que o Tutor pediu, propõe um horário exato diferente,
 * ou só um período do dia (quando ainda não sabe a hora exata) — nunca é
 * bloqueado por conflito de agenda, só alertado (fora deste schema).
 */
export const scheduleChoiceSchema = z
  .object({
    scheduleChoice: z.enum(["manter", "horario_exato", "periodo"]).default("manter"),
    proposedScheduledAt: z.string().optional(),
    proposedPeriod: z.enum(["manha", "tarde", "noite"]).optional(),
  })
  .refine((data) => data.scheduleChoice !== "horario_exato" || !!data.proposedScheduledAt, {
    message: "Informe o novo horário proposto",
    path: ["proposedScheduledAt"],
  })
  .refine((data) => data.scheduleChoice !== "periodo" || !!data.proposedPeriod, {
    message: "Selecione o período proposto",
    path: ["proposedPeriod"],
  });

export const sendProposalSchema = z
  .object({
    requestId: z.uuid(),
    scope: z.string().trim().min(1, "Descreva o escopo do atendimento"),
    price: z.coerce.number().positive("Informe um valor válido"),
    additionalFees: z.coerce.number().min(0).default(0),
    validityHours: z.coerce.number().int().min(1, "Informe a validade da proposta em horas"),
    requiresFullPayment: z.boolean(),
    depositPercent: z.coerce.number().min(0).max(100).optional(),
    cancellationPolicyText: z.string().trim().min(1, "Descreva a política de cancelamento"),
  })
  .and(scheduleChoiceSchema);
export type SendProposalValues = z.infer<typeof sendProposalSchema>;
