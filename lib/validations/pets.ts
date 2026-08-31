import { z } from "zod";

/**
 * Etapa 1 (Identificação) — sempre obrigatória antes de o pet poder ser
 * incluído em uma solicitação (seção 4.1 da especificação, decisão
 * confirmada: "todos os campos da Etapa 1 continuam obrigatórios").
 */
export const petStep1Schema = z.object({
  name: z.string().trim().min(1, "Informe o nome do pet"),
  species: z.string().trim().min(1, "Informe a espécie"),
  breed: z.string().trim().min(1, "Informe a raça (ou 'SRD' se não souber)"),
  sex: z.enum(["macho", "femea"], { message: "Selecione o sexo" }),
  birthApprox: z.string().trim().min(1, "Informe a data de nascimento aproximada"),
  size: z.enum(["pequeno", "medio", "grande", "gigante"], {
    message: "Selecione o porte",
  }),
  weight: z.coerce.number().positive("Informe um peso válido"),
});
export type PetStep1Values = z.infer<typeof petStep1Schema>;

/**
 * Etapas 2–5 são progressivas (preenchimento opcional, guardadas em jsonb).
 * Cada bloco tem seu próprio schema parcial — usado quando o tutor volta
 * pra completar o prontuário depois.
 */
export const petHealthSchema = z.object({
  veterinario: z.string().trim().optional(),
  clinica: z.string().trim().optional(),
  vacinas: z.string().trim().optional(),
  alergias: z.string().trim().optional(),
  condicoes: z.string().trim().optional(),
  medicamentos: z.string().trim().optional(),
});
export type PetHealthValues = z.infer<typeof petHealthSchema>;

export const petBehaviorSchema = z.object({
  temperamento: z.string().trim().optional(),
  interacaoPessoas: z.string().trim().optional(),
  interacaoAnimais: z.string().trim().optional(),
  medos: z.string().trim().optional(),
  gatilhos: z.string().trim().optional(),
});
export type PetBehaviorValues = z.infer<typeof petBehaviorSchema>;
