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

const PET_SIZES = ["pequeno", "medio", "grande", "gigante"] as const;
const PET_SIZE_RANK: Record<(typeof PET_SIZES)[number], number> = {
  pequeno: 0,
  medio: 1,
  grande: 2,
  gigante: 3,
};

export const serviceAddonSchema = z.object({
  name: z.string().trim().min(1, "Informe o nome do adicional").max(80),
  price: z.coerce.number().min(0, "Informe um valor válido"),
});
export type ServiceAddonValues = z.infer<typeof serviceAddonSchema>;

export const createServiceSchema = z
  .object({
    category: z.enum(SERVICE_CATEGORIES, { message: "Selecione a categoria" }),
    subcategory: z.string().trim().max(80).optional(),
    pricingModel: z.enum(PRICING_MODELS, { message: "Selecione o modelo de preço" }),
    basePrice: z.coerce.number().positive("Informe um valor válido").optional(),
    multiPetDiscountPercent: z.coerce.number().min(0).max(100).optional(),
    description: z.string().trim().max(1000).optional(),
    // Catálogo flexível (seção 12.1): duração, espécies/porte aceitos e
    // restrições — todos opcionais, sem restrição = atende qualquer pet.
    durationMinutes: z.coerce.number().int().positive("Informe uma duração válida em minutos").optional(),
    speciesAccepted: z.array(z.string()).max(10).default([]),
    minSize: z.enum(PET_SIZES).optional(),
    maxSize: z.enum(PET_SIZES).optional(),
    restrictions: z.string().trim().max(500).optional(),
    addons: z.array(serviceAddonSchema).max(10).default([]),
  })
  .refine((data) => !data.minSize || !data.maxSize || PET_SIZE_RANK[data.minSize] <= PET_SIZE_RANK[data.maxSize], {
    message: "O porte mínimo não pode ser maior que o porte máximo",
    path: ["maxSize"],
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
