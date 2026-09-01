-- ============================================================================
-- 0032_moderacao_visibilidade_admin.sql
-- Gap encontrado montando a fila de moderação: messages_select
-- (0009_rls_policies.sql) só libera Admin/Supervisor pra ler mensagens
-- de uma solicitação que já tem INCIDENTE — uma mensagem sinalizada
-- (item 4 da Onda 4) numa solicitação sem nenhum incidente ficaria
-- invisível pra quem precisa moderar.
-- ============================================================================

alter policy messages_select on public.messages
  using (
    public.is_party_of_request(request_id)
    or (
      public.is_admin_or_supervisor()
      and (
        exists (select 1 from public.incidents i where i.request_id = messages.request_id)
        or flagged_reason is not null
      )
    )
  );
