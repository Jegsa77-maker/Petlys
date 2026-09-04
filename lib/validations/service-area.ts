import { z } from "zod";

/** Opções fixas de raio pedidas pelo usuário — "em branco" vira `null` (sem restrição de distância). */
export const RADIUS_OPTIONS_KM = [1, 5, 10, 20, 50] as const;

export const upsertServiceAreaSchema = z.object({
  cep: z
    .string()
    .trim()
    .regex(/^\d{5}-?\d{3}$/, "CEP inválido — use o formato 00000-000"),
  radiusKm: z.union([z.number().positive(), z.null()]),
});
