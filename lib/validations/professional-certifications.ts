import { z } from "zod";

const SERVICE_CATEGORIES = [
  "pet_sitter",
  "passeador",
  "hospedagem_creche",
  "adestrador",
  "banho_tosa",
  "veterinario_domiciliar",
] as const;

export const submitCertificationSchema = z.object({
  category: z.enum(SERVICE_CATEGORIES, { message: "Selecione a categoria" }),
  documentPath: z.string().trim().min(1, "Envie o documento antes de continuar"),
});
export type SubmitCertificationValues = z.infer<typeof submitCertificationSchema>;

export const reviewCertificationSchema = z.object({
  certificationId: z.uuid(),
  status: z.enum(["aprovado", "rejeitado"]),
  reviewNotes: z.string().trim().max(500).optional(),
});
export type ReviewCertificationValues = z.infer<typeof reviewCertificationSchema>;
