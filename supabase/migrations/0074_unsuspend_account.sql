-- ============================================================================
-- 0074_unsuspend_account.sql
-- Pedido do usuário: Admin e Supervisor precisam poder "desbloquear" uma
-- conta suspensa, não só suspender. O middleware bloqueia qualquer conta
-- com uma linha em account_suspensions com status = 'aprovada'
-- (lib/supabase/middleware.ts) — sem um status novo, não tem como tirar o
-- bloqueio, já que suspension_status só tinha pendente/aprovada/rejeitada
-- (0011_admin_supervisor_accounts.sql).
--
-- 'revogada' = a suspensão foi desfeita depois de já aprovada (diferente de
-- 'rejeitada', que é quando a recomendação nunca chegou a ser aprovada).
-- ============================================================================

alter type suspension_status add value 'revogada';
