-- ============================================================================
-- 0038_security_hardening_function_grants.sql
-- Onda 0 (backlog): achados de segurança do Supabase — auditados um por um
-- via get_advisors + leitura de cada função, não corrigidos em bloco.
--
-- Causa raiz de quase todos os achados "SECURITY DEFINER exposta pro anon/
-- authenticated via RPC": `CREATE FUNCTION` no Postgres concede EXECUTE pra
-- PUBLIC por padrão, mesmo quando a migration original já tinha um
-- `grant ... to authenticated` explícito (esse grant é aditivo, não
-- substitui o padrão de PUBLIC). Como `anon` e `authenticated` herdam de
-- PUBLIC, a função ficava exposta pros dois mesmo quando só um era intenção.
--
-- Este arquivo corrige 3 grupos, e **deliberadamente não mexe** num quarto:
--
-- A) Funções-gatilho (returns trigger) — nunca precisaram de EXECUTE
--    concedido a ninguém: o Postgres só permite chamá-las via mecanismo de
--    trigger (chamada direta erra "trigger functions can only be called as
--    triggers"), e o disparo do trigger em si roda com o privilégio do
--    dono da função, não do papel que originou o UPDATE/INSERT. Revoke de
--    PUBLIC é 100% seguro e não muda nenhum comportamento.
--
-- B) `notify(uuid, text, jsonb)` — achado real, não só teórico: essa função
--    insere uma notificação pra QUALQUER profile_id, sem checar se quem
--    chama tem relação com esse perfil. Só é chamada internamente pelas
--    funções de trigger (notify_new_message, etc.), nunca pelo código da
--    aplicação (`grep rpc(.notify.)` não achou nenhuma chamada direta).
--    Continuava exposta por PUBLIC — qualquer usuário autenticado (e o
--    anon, por herdar de PUBLIC) podia chamar /rest/v1/rpc/notify direto e
--    inserir notificação falsa pra qualquer perfil. Revoke de PUBLIC fecha
--    isso sem quebrar nada (a chamada interna via trigger continua rodando
--    como o dono da função).
--
-- C) RPCs de auto-serviço (accept_pending_pet_co_tutor_invites,
--    appeal_incident, get_pet_co_tutor_names, flag_message/flag_review,
--    dismiss_message_flag/dismiss_review_flag, set_message_hidden/
--    set_review_hidden) — já tinham `grant ... to authenticated` explícito
--    nas migrations originais (a intenção sempre foi "só logado"), mas o
--    grant implícito de PUBLIC deixava o anon passar também. Revoke de
--    PUBLIC + re-grant pra authenticated fecha a brecha sem mudar o
--    comportamento pretendido (a lógica interna de cada uma já valida
--    auth.uid() contra a linha certa, então o anon nunca conseguia fazer
--    nada de fato — mas não deveria nem conseguir tentar).
--
-- D) NÃO MEXIDO: has_role, is_admin_or_supervisor, is_party_of_request,
--    is_tutor_of_pet, contact_is_unlocked (0008/0010). São predicados
--    booleanos usados dentro de dezenas de policies RLS em todo o schema,
--    incluindo policies de leitura pública (ex.:
--    professional_services_select_public, 0009, usa
--    "active or ... or is_admin_or_supervisor()"). Revogar EXECUTE do
--    anon nessas funções quebraria consultas públicas via REST API direta
--    sempre que a avaliação da policy precisasse chegar no operando
--    is_admin_or_supervisor() (erro "permission denied for function",
--    fatal pra query inteira, não só pulando a linha). Risco real de
--    regressão >> benefício de segurança (são predicados sobre o próprio
--    chamador via auth.uid(), não vazam dado de terceiro). Registrado como
--    risco aceito, não como pendência esquecida.
-- ============================================================================

-- A) search_path fixo (2 achados de baixo risco)
alter function public.distance_km(double precision, double precision, double precision, double precision)
  set search_path = public;
alter function public.set_updated_at() set search_path = public;

-- A (continuação) — funções-gatilho: nunca precisam de EXECUTE concedido
revoke execute on function public.apply_account_suspension() from public;
revoke execute on function public.apply_incident_payout_block() from public;
revoke execute on function public.enforce_and_log_status_transition() from public;
revoke execute on function public.handle_new_user() from public;
revoke execute on function public.log_platform_parameter_change() from public;
revoke execute on function public.notify_new_incident() from public;
revoke execute on function public.notify_new_message() from public;
revoke execute on function public.notify_new_proposal() from public;
revoke execute on function public.notify_new_review() from public;
revoke execute on function public.notify_status_change() from public;
revoke execute on function public.prevent_self_verification() from public;
revoke execute on function public.set_updated_at() from public;

-- B) notify() — achado real: inserção de notificação arbitrária sem dono
revoke execute on function public.notify(uuid, text, jsonb) from public;

-- C) RPCs de auto-serviço: fecha a brecha do PUBLIC implícito, mantém authenticated
revoke execute on function public.accept_pending_pet_co_tutor_invites() from public;
grant execute on function public.accept_pending_pet_co_tutor_invites() to authenticated;

revoke execute on function public.appeal_incident(uuid, text) from public;
grant execute on function public.appeal_incident(uuid, text) to authenticated;

revoke execute on function public.get_pet_co_tutor_names(uuid) from public;
grant execute on function public.get_pet_co_tutor_names(uuid) to authenticated;

revoke execute on function public.dismiss_message_flag(uuid) from public;
grant execute on function public.dismiss_message_flag(uuid) to authenticated;

revoke execute on function public.dismiss_review_flag(uuid) from public;
grant execute on function public.dismiss_review_flag(uuid) to authenticated;

revoke execute on function public.flag_message(uuid, text) from public;
grant execute on function public.flag_message(uuid, text) to authenticated;

revoke execute on function public.flag_review(uuid, text) from public;
grant execute on function public.flag_review(uuid, text) to authenticated;

revoke execute on function public.set_message_hidden(uuid, boolean) from public;
grant execute on function public.set_message_hidden(uuid, boolean) to authenticated;

revoke execute on function public.set_review_hidden(uuid, boolean) from public;
grant execute on function public.set_review_hidden(uuid, boolean) to authenticated;
