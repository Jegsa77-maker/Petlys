-- ============================================================================
-- 0039_fix_security_hardening_grants.sql
-- Corrige 0038: "revoke ... from public" não tirou o acesso de anon/
-- authenticated porque o Supabase concede EXECUTE a esses dois papéis de
-- forma EXPLÍCITA e independente de PUBLIC em toda função nova criada no
-- schema public (ALTER DEFAULT PRIVILEGES do próprio projeto) — não é um
-- grant herdado de PUBLIC que um "revoke from public" resolvesse.
-- Confirmado consultando information_schema.routine_privileges antes de
-- escrever este arquivo: todas as 21 funções de 0038 tinham `anon` e
-- `authenticated` como grantees diretos, não via PUBLIC.
-- ============================================================================

-- Funções-gatilho + notify(): ninguém precisa chamar direto (grupo A/B de 0038)
revoke execute on function public.apply_account_suspension() from anon, authenticated;
revoke execute on function public.apply_incident_payout_block() from anon, authenticated;
revoke execute on function public.enforce_and_log_status_transition() from anon, authenticated;
revoke execute on function public.handle_new_user() from anon, authenticated;
revoke execute on function public.log_platform_parameter_change() from anon, authenticated;
revoke execute on function public.notify_new_incident() from anon, authenticated;
revoke execute on function public.notify_new_message() from anon, authenticated;
revoke execute on function public.notify_new_proposal() from anon, authenticated;
revoke execute on function public.notify_new_review() from anon, authenticated;
revoke execute on function public.notify_status_change() from anon, authenticated;
revoke execute on function public.prevent_self_verification() from anon, authenticated;
revoke execute on function public.set_updated_at() from anon, authenticated;
revoke execute on function public.notify(uuid, text, jsonb) from anon, authenticated;

-- RPCs de auto-serviço: só authenticated deveria conseguir chamar (grupo C de 0038)
revoke execute on function public.accept_pending_pet_co_tutor_invites() from anon;
revoke execute on function public.appeal_incident(uuid, text) from anon;
revoke execute on function public.get_pet_co_tutor_names(uuid) from anon;
revoke execute on function public.dismiss_message_flag(uuid) from anon;
revoke execute on function public.dismiss_review_flag(uuid) from anon;
revoke execute on function public.flag_message(uuid, text) from anon;
revoke execute on function public.flag_review(uuid, text) from anon;
revoke execute on function public.set_message_hidden(uuid, boolean) from anon;
revoke execute on function public.set_review_hidden(uuid, boolean) from anon;
