-- Mesmo padrão já descoberto nesta sessão (0038/0039): o Supabase concede EXECUTE
-- direto a anon/authenticated em toda função nova do schema public, independente do
-- revoke já ter sido feito na própria migration de criação. Revogando de novo, à parte.
revoke execute on function public.promote_scheduled_parameters() from anon, authenticated;
revoke execute on function public.detect_reconciliation_issues() from anon, authenticated;
