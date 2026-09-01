-- ============================================================================
-- 0016_suspension_actually_blocks_access.sql
-- Corrige dois bugs achados em teste manual:
--
-- A. Suspensão de conta não bloqueava nada de verdade. O trigger de
--    aprovação (0011) só desativa as linhas de account_roles que já
--    existiam — mas account_roles_insert_self (0009) deixa qualquer
--    usuário autenticado inserir um papel tutor/profissional novo pra si
--    a qualquer momento, sem checar suspensão. Uma conta suspensa
--    continuava logando normalmente (Supabase Auth não sabe nada sobre
--    isso) e, ao ser redirecionada pro onboarding por "não ter papel
--    ativo", conseguia simplesmente escolher um papel de novo (inclusive
--    um que nunca teve) e voltar a ter acesso completo.
--
-- B. account_suspensions só podia ser lida por admin/supervisor — a
--    própria pessoa suspensa não conseguia ler seu status, então nem o
--    middleware nem uma tela "conta suspensa" conseguiam checar isso
--    pela sessão dela.
-- ============================================================================

create policy account_suspensions_select_own on public.account_suspensions
  for select using (target_profile_id = auth.uid());

alter policy account_roles_insert_self on public.account_roles
  with check (
    profile_id = auth.uid()
    and role in ('tutor', 'profissional')
    and not exists (
      select 1 from public.account_suspensions s
      where s.target_profile_id = profile_id and s.status = 'aprovada'
    )
  );
