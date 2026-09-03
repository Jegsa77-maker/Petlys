import { z } from "zod";

/**
 * Onboarding financeiro do Profissional (Onda 3, Etapa 1) — dados bancários
 * pra criar o recebedor no gateway. CPF/CNPJ não entra aqui: já foi coletado
 * no cadastro (profiles.cpf_cnpj, seção 2.3) e é lido direto na Server Action.
 */
export const recipientOnboardingSchema = z.object({
  bankCode: z
    .string()
    .trim()
    .regex(/^\d{3}$/, "Código do banco deve ter 3 dígitos"),
  agencia: z.string().trim().min(1, "Informe a agência").max(10),
  agenciaDv: z.string().trim().max(2).optional(),
  conta: z.string().trim().min(1, "Informe a conta").max(15),
  contaDv: z.string().trim().min(1, "Informe o dígito da conta").max(2),
  contaTipo: z.enum(["corrente", "poupanca"]),
});
export type RecipientOnboardingValues = z.infer<typeof recipientOnboardingSchema>;
