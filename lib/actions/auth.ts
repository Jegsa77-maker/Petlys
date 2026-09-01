"use server";

import { createClient, createServiceRoleClient } from "@/lib/supabase/server";
import {
  otpFormSchema,
  phoneFormSchema,
  chooseProfileSchema,
  signUpSchema,
  signInSchema,
  requestPasswordResetSchema,
  type ChooseProfileValues,
} from "@/lib/validations/auth";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { cookies, headers } from "next/headers";

type ActionResult = { error: string | null };
type SignUpResult = { error: string | null; needsEmailConfirmation?: boolean };

const INTERNAL_EMAIL_DOMAIN = "@internal.plataformapet";

async function siteOrigin() {
  const h = await headers();
  return h.get("origin") ?? `https://${h.get("host")}`;
}

/**
 * Cadastro por e-mail/senha — alternativa ao OAuth pra Tutor/Profissional
 * (seção 2.1: fluxo segue igual depois — telefone, depois escolher
 * perfil). Contas internas (Admin/Supervisor) nunca passam por aqui,
 * são criadas só pelo Admin em /admin/supervisores.
 */
export async function signUpWithPassword(input: unknown): Promise<SignUpResult> {
  const parsed = signUpSchema.safeParse(input);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Dados inválidos" };
  }

  const supabase = await createClient();
  const { data, error } = await supabase.auth.signUp({
    email: parsed.data.email,
    password: parsed.data.password,
    options: {
      data: { full_name: parsed.data.fullName },
      emailRedirectTo: `${await siteOrigin()}/confirmar-email`,
    },
  });

  if (error) {
    if (error.message.toLowerCase().includes("already registered")) {
      return { error: "Esse e-mail já está cadastrado. Tente entrar." };
    }
    return { error: "Não foi possível criar sua conta. Tente novamente." };
  }

  if (!data.session) {
    // Confirmação de e-mail habilitada no projeto Supabase — sessão só
    // é criada depois que a pessoa clicar no link recebido por e-mail.
    return { error: null, needsEmailConfirmation: true };
  }

  redirect("/verificar-telefone");
}

/**
 * Login por e-mail/senha. Serve tanto Tutor/Profissional (e-mail real)
 * quanto Admin/Supervisor (digitam só o "usuário" interno, sem o
 * domínio sintético — resolvido aqui, mesma convenção de
 * lib/actions/admin.ts:createSupervisor).
 */
export async function signInWithPassword(input: unknown): Promise<ActionResult> {
  const parsed = signInSchema.safeParse(input);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Dados inválidos" };
  }

  const email = parsed.data.identifier.includes("@")
    ? parsed.data.identifier
    : `${parsed.data.identifier}${INTERNAL_EMAIL_DOMAIN}`;

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword({ email, password: parsed.data.password });

  if (error) {
    return { error: "E-mail/usuário ou senha incorretos." };
  }

  redirect("/");
}

/**
 * Pede o e-mail de redefinição de senha. Só faz sentido pra contas com
 * e-mail real (Tutor/Profissional) — contas internas não têm caixa de
 * entrada própria, o reset delas é o resetInternalPassword do Admin
 * (lib/actions/supervisor.ts).
 */
export async function requestPasswordReset(input: unknown): Promise<ActionResult> {
  const parsed = requestPasswordResetSchema.safeParse(input);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "E-mail inválido" };
  }

  const supabase = await createClient();
  await supabase.auth.resetPasswordForEmail(parsed.data.email, {
    redirectTo: `${await siteOrigin()}/redefinir-senha`,
  });

  // Nunca revela se o e-mail existe ou não na base (evita enumeração de contas).
  return { error: null };
}

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

  // Só insere os papéis que ainda não existem. account_roles não tem
  // policy de UPDATE pra usuário comum (só admin, ver 0009_rls_policies) —
  // se o upsert tentasse tocar uma linha já existente (ex.: reenviando o
  // papel que a pessoa já tinha ao adicionar um segundo, ver
  // ChooseProfileForm), a RLS rejeitava o comando inteiro.
  const { data: existingRoles } = await supabase
    .from("account_roles")
    .select("role")
    .eq("profile_id", user.id);
  const existingRoleNames = new Set((existingRoles ?? []).map((r) => r.role));
  const newRoles = parsed.data.roles.filter((role) => !existingRoleNames.has(role));

  if (newRoles.length > 0) {
    const rows = newRoles.map((role) => ({ profile_id: user.id, role }));
    const { error: rolesError } = await supabase.from("account_roles").insert(rows);

    if (rolesError) {
      return { error: "Não foi possível salvar seu(s) perfil(is). Tente novamente." };
    }
  }

  revalidatePath("/", "layout");
  // Um só papel -> direto pra tela dele, sem ambiguidade. Os dois -> "/"
  // pra pessoa escolher explicitamente com qual está entrando (nunca
  // troca automaticamente — ver setActiveRole/lib/supabase/middleware.ts).
  redirect(parsed.data.roles.length === 1 ? ROLE_HOME_PATH[parsed.data.roles[0]] : "/");
}

export async function signOut() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/login");
}

const ROLE_HOME_PATH: Record<string, string> = {
  tutor: "/inicio",
  profissional: "/dashboard",
};

/**
 * Contas com os dois papéis (Tutor + Profissional) precisam escolher em
 * qual estão atuando — as telas de cada papel nunca se misturam (ver
 * lib/supabase/middleware.ts). Essa escolha fica num cookie e pode ser
 * trocada a qualquer momento voltando pra "/".
 */
export async function setActiveRole(role: "tutor" | "profissional") {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  const { data: hasRole } = await supabase
    .from("account_roles")
    .select("role")
    .eq("profile_id", user.id)
    .eq("role", role)
    .eq("active", true)
    .maybeSingle();

  if (!hasRole) redirect("/");

  const cookieStore = await cookies();
  cookieStore.set("active_role", role, {
    path: "/",
    httpOnly: true,
    sameSite: "lax",
    maxAge: 60 * 60 * 24 * 365,
  });

  redirect(ROLE_HOME_PATH[role]);
}
