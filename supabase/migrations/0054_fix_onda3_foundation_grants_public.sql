-- Achado real: dessa vez o grant era pra PUBLIC (não direto a anon/authenticated
-- como nas funções investigadas em 0038/0039) — confirmado via information_schema.routine_privileges.
revoke execute on function public.promote_scheduled_parameters() from public;
revoke execute on function public.detect_reconciliation_issues() from public;
