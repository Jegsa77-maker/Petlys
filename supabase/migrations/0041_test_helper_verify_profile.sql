-- ============================================================================
-- 0041_test_helper_verify_profile.sql
-- Fase 3 dos testes automatizados (Playwright/e2e) — diferente dos testes
-- de RLS (tests/rls/**), que batem direto na API do Supabase e nunca
-- passam pelo middleware do Next.js, os specs e2e navegam o app de
-- verdade — e o middleware (lib/supabase/middleware.ts) exige telefone/
-- e-mail verificado antes de liberar qualquer rota. `profiles_prevent_
-- self_verification` (0010) bloqueia isso pro próprio usuário de
-- propósito; só existe abertura via service_role.
--
-- Função só pra isso: dado um profile_id, marca telefone/e-mail
-- verificados e devolve. Só service_role pode chamar (revoke explícito
-- de anon/authenticated, mesmo padrão de 0038/0039) — nunca deveria
-- vazar pra ninguém logado conseguir se auto-verificar por essa porta.
-- ============================================================================

create or replace function public.test_verify_profile(p_profile_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  alter table public.profiles disable trigger profiles_prevent_self_verification;

  update public.profiles
  set phone_verified_at = now(), email_verified_at = now(), birth_date = coalesce(birth_date, '1990-01-01')
  where id = p_profile_id;

  alter table public.profiles enable trigger profiles_prevent_self_verification;
end;
$$;

revoke execute on function public.test_verify_profile(uuid) from anon, authenticated;
