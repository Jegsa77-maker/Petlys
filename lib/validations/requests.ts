import { z } from "zod";

const SERVICE_CATEGORIES = [
  "pet_sitter",
  "passeador",
  "hospedagem_creche",
  "adestrador",
  "banho_tosa",
  "veterinario_domiciliar",
] as const;

export const createRequestSchema = z.object({
  professionalId: z.uuid("Profissional inválido"),
  category: z.enum(SERVICE_CATEGORIES, { message: "Selecione a categoria do serviço" }),
  petIds: z.array(z.uuid()).min(1, "Selecione ao menos um pet"),
  isRecurring: z.boolean(),
  occurrencesTotal: z.coerce.number().int().min(1).default(1),
  firstOccurrenceAt: z.string().min(1, "Informe a data e hora do primeiro atendimento"),
  notes: z.string().trim().max(2000).optional(),
  isVisitaInicial: z.boolean().default(false),
});
export type CreateRequestValues = z.infer<typeof createRequestSchema>;

export const sendMessageSchema = z.object({
  requestId: z.uuid(),
  content: z.string().trim().min(1, "Escreva uma mensagem").max(4000),
});
export type SendMessageValues = z.infer<typeof sendMessageSchema>;

export const sendProposalSchema = z.object({
  requestId: z.uuid(),
  scope: z.string().trim().min(1, "Descreva o escopo do atendimento"),
  price: z.coerce.number().positive("Informe um valor válido"),
  additionalFees: z.coerce.number().min(0).default(0),
  validityHours: z.coerce.number().int().min(1, "Informe a validade da proposta em horas"),
  requiresFullPayment: z.boolean(),
  depositPercent: z.coerce.number().min(0).max(100).optional(),
  cancellationPolicyText: z.string().trim().min(1, "Descreva a política de cancelamento"),
});
export type SendProposalValues = z.infer<typeof sendProposalSchema>;
