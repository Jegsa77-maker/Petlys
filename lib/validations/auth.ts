import { z } from "zod";

/**
 * Telefone no formato brasileiro E.164, ex: +5511987654321.
 * Validação de formato apenas — a verificação real é por OTP via Supabase.
 */
export const phoneSchema = z
  .string()
  .trim()
  .regex(/^\+55\d{10,11}$/, "Use o formato +55 seguido de DDD e número, ex: +5511987654321");

export const phoneFormSchema = z.object({
  phone: phoneSchema,
});
export type PhoneFormValues = z.infer<typeof phoneFormSchema>;

export const otpFormSchema = z.object({
  phone: phoneSchema,
  token: z.string().trim().length(6, "O código tem 6 dígitos"),
});
export type OtpFormValues = z.infer<typeof otpFormSchema>;

/**
 * CPF (11 dígitos) ou CNPJ (14 dígitos), só números.
 * Regra de negócio: coletado já no cadastro do profissional (seção 2.3),
 * exigido pelo gateway de pagamento para cadastro futuro como recebedor.
 */
export const cpfCnpjSchema = z
  .string()
  .trim()
  .transform((v) => v.replace(/\D/g, ""))
  .refine((v) => v.length === 11 || v.length === 14, "Informe um CPF (11 dígitos) ou CNPJ (14 dígitos)");

export const chooseProfileSchema = z.object({
  roles: z
    .array(z.enum(["tutor", "profissional"]))
    .min(1, "Escolha ao menos um perfil"),
  cpfCnpj: cpfCnpjSchema.optional(),
  birthDate: z
    .string()
    .refine((v) => {
      const date = new Date(v);
      const eighteenYearsAgo = new Date();
      eighteenYearsAgo.setFullYear(eighteenYearsAgo.getFullYear() - 18);
      return date <= eighteenYearsAgo;
    }, "É preciso ter 18 anos ou mais para usar a plataforma"),
}).refine(
  (data) => !data.roles.includes("profissional") || !!data.cpfCnpj,
  { message: "CPF ou CNPJ é obrigatório para o perfil de Profissional", path: ["cpfCnpj"] }
);
export type ChooseProfileValues = z.infer<typeof chooseProfileSchema>;
