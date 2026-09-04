import { z } from "zod";

export const updateTutorAddressSchema = z.object({
  cep: z
    .string()
    .trim()
    .regex(/^\d{5}-?\d{3}$/, "CEP inválido — use o formato 00000-000"),
});
