import { z } from "zod";

export const upsertParameterSchema = z.object({
  id: z.uuid().optional(),
  chave1: z.string().trim().min(1, "Informe a chave 1"),
  chave2: z.string().trim().optional(),
  chave3: z.string().trim().optional(),
  valor1: z.string().trim().min(1, "Informe o valor"),
  valor2: z.string().trim().optional(),
  valor3: z.string().trim().optional(),
  explicacao: z.string().trim().min(1, "Explique para que serve este parâmetro"),
  vigenciaInicio: z.string().min(1, "Informe a data de vigência"),
});
export type UpsertParameterValues = z.infer<typeof upsertParameterSchema>;

export const createSupervisorSchema = z.object({
  fullName: z.string().trim().min(1, "Informe o nome"),
  username: z.string().trim().min(6, "O usuário precisa ter mais de 5 caracteres"),
  password: z.string().min(8, "A senha precisa ter ao menos 8 caracteres"),
});
export type CreateSupervisorValues = z.infer<typeof createSupervisorSchema>;

export const recommendSuspensionSchema = z.object({
  targetProfileId: z.uuid(),
  reason: z.string().trim().min(1, "Descreva o motivo da suspensão"),
  relatedIncidentId: z.uuid().optional(),
});
export type RecommendSuspensionValues = z.infer<typeof recommendSuspensionSchema>;
