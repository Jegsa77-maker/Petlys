import { z } from "zod";

const SERVICE_CATEGORIES = [
  "pet_sitter",
  "passeador",
  "hospedagem_creche",
  "adestrador",
  "banho_tosa",
  "veterinario_domiciliar",
] as const;

const PRICING_MODELS = [
  "fixo",
  "a_partir_de",
  "faixa",
  "diaria",
  "hora",
  "pacote",
  "orcamento_personalizado",
] as const;

export const createServiceSchema = z.object({
  category: z.enum(SERVICE_CATEGORIES, { message: "Selecione a categoria" }),
  pricingModel: z.enum(PRICING_MODELS, { message: "Selecione o modelo de preço" }),
  basePrice: z.coerce.number().positive("Informe um valor válido").optional(),
  multiPetDiscountPercent: z.coerce.number().min(0).max(100).optional(),
  description: z.string().trim().max(1000).optional(),
});
export type CreateServiceValues = z.infer<typeof createServiceSchema>;

export const availabilitySlotSchema = z.object({
  weekday: z.coerce.number().int().min(0).max(6),
  startTime: z.string().regex(/^\d{2}:\d{2}$/, "Formato de hora inválido"),
  endTime: z.string().regex(/^\d{2}:\d{2}$/, "Formato de hora inválido"),
});
export type AvailabilitySlotValues = z.infer<typeof availabilitySlotSchema>;

export const blockDateSchema = z.object({
  dateOverride: z.string().min(1, "Informe a data"),
  reason: z.string().trim().max(200).optional(),
});
export type BlockDateValues = z.infer<typeof blockDateSchema>;
