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

// Ajuste de 2026-09-05: "horário de trabalho" deixou de ser uma lista de
// janelas por dia da semana — virou um único range que vale pra semana
// inteira (o profissional trabalha das 9 às 18, ponto — quem tira um dia
// de folga registra isso como bloqueio/folga na data específica, não
// editando o horário recorrente). `setWorkingHours` (lib/actions/services.ts)
// grava esse range nas 7 linhas de weekday de uma vez.
export const workingHoursSchema = z
  .object({
    startTime: z.string().regex(/^\d{2}:\d{2}$/, "Formato de hora inválido"),
    endTime: z.string().regex(/^\d{2}:\d{2}$/, "Formato de hora inválido"),
  })
  .refine((data) => data.startTime < data.endTime, {
    message: "O horário de início precisa ser antes do fim",
    path: ["endTime"],
  });
export type WorkingHoursValues = z.infer<typeof workingHoursSchema>;

export const BLOCK_TYPES = ["bloqueio", "folga", "compromisso"] as const;
export type BlockType = (typeof BLOCK_TYPES)[number];

// "Configurar horários" só oferece bloqueio/folga (pedido de 2026-09-05:
// compromisso passa a existir só pelo atalho "+" da Agenda, não faz
// sentido cadastrar um compromisso avulso na tela de configuração).
export const CONFIG_BLOCK_TYPES = ["bloqueio", "folga"] as const satisfies readonly BlockType[];

// Horário é opcional (ajuste pedido depois do calendário mensal — antes só
// dava pra bloquear o dia inteiro): os dois campos vêm juntos (dia inteiro)
// ou nenhum dos dois (horário específico). `untilDate` também é opcional —
// bloquear um período inteiro (semana de folga, mês de férias) de uma vez
// em vez de criar linha por linha (pedido de 2026-09-05).
export const blockDateSchema = z
  .object({
    dateOverride: z.string().min(1, "Informe a data"),
    untilDate: z.string().optional(),
    blockType: z.enum(BLOCK_TYPES).default("bloqueio"),
    startTime: z.string().regex(/^\d{2}:\d{2}$/, "Formato de hora inválido").optional(),
    endTime: z.string().regex(/^\d{2}:\d{2}$/, "Formato de hora inválido").optional(),
    reason: z.string().trim().max(200).optional(),
  })
  .refine((data) => (data.startTime == null) === (data.endTime == null), {
    message: "Informe início e fim, ou deixe os dois em branco pro dia inteiro",
    path: ["endTime"],
  })
  .refine((data) => !data.startTime || !data.endTime || data.startTime < data.endTime, {
    message: "O horário de início precisa ser antes do fim",
    path: ["endTime"],
  })
  .refine((data) => !data.untilDate || data.untilDate >= data.dateOverride, {
    message: "A data final precisa ser igual ou depois da inicial",
    path: ["untilDate"],
  })
  .refine(
    (data) => {
      if (!data.untilDate) return true;
      const days = (new Date(data.untilDate).getTime() - new Date(data.dateOverride).getTime()) / 86_400_000;
      return days <= 366;
    },
    { message: "O período não pode passar de 1 ano", path: ["untilDate"] }
  );
export type BlockDateValues = z.infer<typeof blockDateSchema>;

// Editar um bloqueio/folga/compromisso já existente (clicar num item da
// lista da Agenda, ou arrastar pra outro horário) — não muda a data, só
// tipo/horário/motivo.
export const updateBlockSchema = z
  .object({
    id: z.uuid(),
    blockType: z.enum(BLOCK_TYPES),
    startTime: z.string().regex(/^\d{2}:\d{2}$/, "Formato de hora inválido").optional(),
    endTime: z.string().regex(/^\d{2}:\d{2}$/, "Formato de hora inválido").optional(),
    reason: z.string().trim().max(200).optional(),
  })
  .refine((data) => (data.startTime == null) === (data.endTime == null), {
    message: "Informe início e fim, ou deixe os dois em branco pro dia inteiro",
    path: ["endTime"],
  })
  .refine((data) => !data.startTime || !data.endTime || data.startTime < data.endTime, {
    message: "O horário de início precisa ser antes do fim",
    path: ["endTime"],
  });
export type UpdateBlockValues = z.infer<typeof updateBlockSchema>;
