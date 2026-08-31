"use server";

import { createClient, createServiceRoleClient } from "@/lib/supabase/server";
import {
  otpFormSchema,
  phoneFormSchema,
  chooseProfileSchema,
  type ChooseProfileValues,
} from "@/lib/validations/auth";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";

type ActionResult = { error: string | null };

/**
 * Envia o código de verificação por SMS para o telefone informado.
 * Usa o Supabase Auth (phone OTP) — não grava nada em `profiles` ainda.
 */
export async function sendPhoneOtp(input: { phone: string }): Promise<ActionResult> {
  const parsed = phoneFormSchema.safeParse(input);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Telefone inválido" };
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithOtp({ phone: parsed.data.phone });

  if (error) {
    return { error: "Não foi possível enviar o código. Tente novamente em instantes." };
  }
  return { error: null };
}

/**
 * Confirma o código de 6 dígitos e marca phone_verified_at em profiles.
 * Ao confirmar e-mail e telefone, a conta passa a ser considerada ativa
 * (seção 2.1 da especificação).
 *
 * IMPORTANTE: phone_verified_at/email_verified_at só podem ser gravados
 * pelo service_role — um trigger no banco bloqueia qualquer tentativa de
 * o próprio usuário se auto-verificar (ver 0010_fixes_from_review.sql).
 * Por isso esta escrita específica usa createServiceRoleClient(), depois
 * de supabase.auth.verifyOtp() já ter confirmado o código de verdade.
 */
export async function verifyPhoneOtp(input: {
  phone: string;
  token: string;
}): Promise<ActionResult> {
  const parsed = otpFormSchema.safeParse(input);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Código inválido" };
  }

  const supabase = await createClient();
  const {
    data: { user },
    error: verifyError,
  } = await supabase.auth.verifyOtp({
    phone: parsed.data.phone,
    token: parsed.data.token,
    type: "sms",
  });

  if (verifyError || !user) {
    return { error: "Código incorreto ou expirado. Peça um novo código." };
  }

  const nowIso = new Date().toISOString();
  const serviceClient = createServiceRoleClient();
  const { error: updateError } = await serviceClient
    .from("profiles")
    .update({
      phone: parsed.data.phone,
      phone_verified_at: nowIso,
      // e-mail já chega verificado quando o login é via Google/Facebook.
      email_verified_at: nowIso,
    })
    .eq("id", user.id);

  if (updateError) {
    return { error: "Telefone confirmado, mas houve um erro ao salvar. Tente novamente." };
  }

  revalidatePath("/", "layout");
  redirect("/escolher-perfil");
}

/**
 * Grava os papéis escolhidos (tutor e/ou profissional), CPF/CNPJ quando
 * aplicável, e a data de nascimento (validação de 18 anos já é reforçada
 * por constraint no banco — ver 0002_identity_and_pets.sql).
 */
export async function chooseProfile(input: ChooseProfileValues): Promise<ActionResult> {
  const parsed = chooseProfileSchema.safeParse(input);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Dados inválidos" };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { error: "Sessão expirada. Faça login novamente." };
  }

  const { error: profileError } = await supabase
    .from("profiles")
    .update({
      birth_date: parsed.data.birthDate,
      cpf_cnpj: parsed.data.cpfCnpj ?? null,
    })
    .eq("id", user.id);

  if (profileError) {
    return { error: "Não foi possível salvar seus dados. Verifique a data de nascimento." };
  }

  const rows = parsed.data.roles.map((role) => ({ profile_id: user.id, role }));
  const { error: rolesError } = await supabase
    .from("account_roles")
    .upsert(rows, { onConflict: "profile_id,role" });

  if (rolesError) {
    return { error: "Não foi possível salvar seu(s) perfil(is). Tente novamente." };
  }

  revalidatePath("/", "layout");
  redirect("/inicio");
}

export async function signOut() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/login");
}
