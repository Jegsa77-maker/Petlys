import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database";

/**
 * Helpers pros testes de RLS (tests/rls/**) — batem no Supabase remoto
 * de verdade (o mesmo projeto de desenvolvimento usado o resto da
 * sessão), nunca num banco local/efêmero: este projeto não tem Supabase
 * CLI configurado localmente. Cada teste cria sua própria fixture (user
 * de teste com prefixo `rls-test-*`) e apaga no `afterAll` — nunca
 * depende de dado de seed que pode mudar, nunca deixa lixo pra trás.
 *
 * Importante: RLS é avaliada pelo Postgres direto na chamada da API do
 * Supabase — não passa pelo middleware do Next.js (`lib/supabase/
 * middleware.ts`). Por isso a fixture NÃO precisa simular telefone/
 * e-mail verificado nem aceite de termos (isso é gate de rota do
 * Next.js, não de RLS) — só precisa existir em `auth.users`/`profiles`
 * e ter o(s) `account_roles` certo(s), que é o que as policies checam.
 *
 * Mesma técnica manual usada a sessão inteira pra testar com sessão
 * real (não bypass de service_role): generateLink + verifyOtp.
 */

function env(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(
      `${name} não está definida — os testes de RLS precisam de .env.local (ou das env vars equivalentes em CI).`
    );
  }
  return value;
}

export function serviceClient(): SupabaseClient<Database> {
  return createClient<Database>(env("NEXT_PUBLIC_SUPABASE_URL"), env("SUPABASE_SERVICE_ROLE_KEY"));
}

/** Client anônimo puro — sem nenhuma sessão, simula visitante não-logado. */
export function anonClient(): SupabaseClient<Database> {
  return createClient<Database>(env("NEXT_PUBLIC_SUPABASE_URL"), env("NEXT_PUBLIC_SUPABASE_ANON_KEY"));
}

/** Client autenticado como `email`, via sessão real (não bypass). */
export async function sessionClientFor(email: string): Promise<SupabaseClient<Database>> {
  const admin = serviceClient();
  const { data: linkData, error: linkError } = await admin.auth.admin.generateLink({
    type: "magiclink",
    email,
  });
  if (linkError || !linkData.properties?.email_otp) {
    throw new Error(`generateLink falhou pra ${email}: ${linkError?.message}`);
  }

  const anon = anonClient();
  const { data: verifyData, error: verifyError } = await anon.auth.verifyOtp({
    email,
    token: linkData.properties.email_otp,
    type: "magiclink",
  });
  if (verifyError || !verifyData.session) {
    throw new Error(`verifyOtp falhou pra ${email}: ${verifyError?.message}`);
  }

  return createClient<Database>(env("NEXT_PUBLIC_SUPABASE_URL"), env("NEXT_PUBLIC_SUPABASE_ANON_KEY"), {
    global: { headers: { Authorization: `Bearer ${verifyData.session.access_token}` } },
  });
}

export type TestUserRole = "tutor" | "profissional" | "administrador" | "supervisor";

export type TestUser = {
  id: string;
  email: string;
  client: SupabaseClient<Database>;
};

/**
 * Cria um usuário de teste com o(s) papel(éis) pedido(s). Não passa
 * por verificação de telefone/e-mail nem termos — RLS não olha pra
 * isso, só o middleware do Next.js olha (ver nota do arquivo).
 */
export async function provisionTestUser(roles: TestUserRole[], label: string): Promise<TestUser> {
  const admin = serviceClient();
  const email = `rls-test-${label}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}@plataformapet.dev`;

  const { data: userData, error: createError } = await admin.auth.admin.createUser({
    email,
    email_confirm: true,
  });
  if (createError || !userData.user) {
    throw new Error(`createUser falhou: ${createError?.message}`);
  }
  const id = userData.user.id;

  const { error: profileError } = await admin
    .from("profiles")
    .update({ full_name: `Teste RLS ${label}` })
    .eq("id", id);
  if (profileError) throw new Error(`update profiles falhou: ${profileError.message}`);

  if (roles.length > 0) {
    const { error: rolesError } = await admin
      .from("account_roles")
      .insert(roles.map((role) => ({ profile_id: id, role })));
    if (rolesError) throw new Error(`insert account_roles falhou: ${rolesError.message}`);
  }

  const client = await sessionClientFor(email);
  return { id, email, client };
}

/**
 * Apaga o usuário de teste. Se o teste criou linha em alguma tabela sem
 * `ON DELETE CASCADE` até `profiles` (ex.: `pets.created_by`), isso
 * falha — o chamador precisa apagar essa linha antes (ver
 * `tests/rls/pets.test.ts` pra um exemplo). Loga em vez de engolir o
 * erro, pra não mascarar resíduo de teste ficando pra trás sem ninguém
 * notar.
 */
export async function cleanupTestUser(id: string): Promise<void> {
  const admin = serviceClient();
  const { error } = await admin.auth.admin.deleteUser(id);
  if (error) {
    console.warn(`cleanupTestUser: falha ao apagar ${id} — provável FK sem cascade não limpa antes: ${error.message}`);
  }
}
