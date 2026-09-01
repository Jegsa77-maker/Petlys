import { z } from "zod";

/**
 * Perfil profissional completo (seção 6.3 do plano 100%) — apresentação,
 * experiência, especializações, idiomas e políticas. Tudo opcional: o
 * profissional consegue publicar um serviço sem preencher nada disso
 * (ver professional_profiles em 0017), isso só melhora a completude e a
 * conversão na busca.
 */
export const professionalProfileSchema = z.object({
  bio: z.string().trim().max(1000, "Máximo de 1000 caracteres").optional(),
  experienceYears: z.coerce.number().int().min(0).max(80).optional(),
  // Vem do formulário como texto separado por vírgula — convertido pro
  // array text[] do banco aqui, não no client.
  specializations: z
    .string()
    .transform((v) => v.split(",").map((s) => s.trim()).filter(Boolean))
    .pipe(z.array(z.string()).max(20)),
  languages: z
    .string()
    .transform((v) => v.split(",").map((s) => s.trim()).filter(Boolean))
    .pipe(z.array(z.string()).max(10)),
  policies: z.string().trim().max(2000, "Máximo de 2000 caracteres").optional(),
  avatarUrl: z.string().trim().url("Informe uma URL válida").optional().or(z.literal("")),
});
export type ProfessionalProfileValues = z.infer<typeof professionalProfileSchema>;

export type ProfessionalProfileFormInput = {
  bio: string;
  experienceYears: string;
  specializations: string;
  languages: string;
  policies: string;
  avatarUrl: string;
};
