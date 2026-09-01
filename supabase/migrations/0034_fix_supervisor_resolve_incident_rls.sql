-- ============================================================================
-- 0034_fix_supervisor_resolve_incident_rls.sql
-- Gap de RLS identificado revisando pendências antigas do CHANGELOG
-- (já registrado desde 2026-08-31, nunca corrigido): a policy
-- incidents_update liberava Admin **e** Supervisor pra qualquer
-- mudança em qualquer incidente — a regra de "só o Admin decide o
-- encerramento final" (seção 10.2) só existia na Server Action
-- (resolveIncident, requireAdmin), não no banco. Um Supervisor com
-- acesso direto à API conseguiria chamar update({status:'resolvido'})
-- sozinho, inclusive liberando o bloqueio de saque (trigger de
-- 0007_safety_and_reputation.sql reage a qualquer update pra
-- 'resolvido', não só ao vindo da Server Action).
--
-- Corrigido dividindo a policy em duas: Admin continua sem restrição;
-- Supervisor só pode levar o incidente pra 'em_analise' ou 'escalado' —
-- nunca 'resolvido'.
-- ============================================================================

drop policy incidents_update on public.incidents;

create policy incidents_update_admin on public.incidents
  for update using (public.has_role('administrador'));

create policy incidents_update_supervisor on public.incidents
  for update
  using (public.has_role('supervisor'))
  with check (status in ('em_analise', 'escalado'));
