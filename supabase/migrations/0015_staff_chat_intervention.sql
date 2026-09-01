-- ============================================================================
-- 0015_staff_chat_intervention.sql
-- Admin/Supervisor já conseguiam LER o chat de uma solicitação com
-- incidente (messages_select, 0009_rls_policies.sql), mas não tinham
-- nenhuma forma de ENVIAR mensagem ali — sem isso, suporte não consegue
-- de fato intervir numa disputa dentro da conversa entre Tutor e
-- Profissional. Libera envio só enquanto o incidente estiver em aberto
-- (não resolvido) — depois de resolvido, a conversa volta a ser só das
-- duas partes.
-- ============================================================================

alter policy messages_insert on public.messages
  with check (
    (sender_id = auth.uid() and public.is_party_of_request(request_id))
    or (
      sender_id = auth.uid()
      and public.is_admin_or_supervisor()
      and exists (
        select 1 from public.incidents i
        where i.request_id = messages.request_id and i.status <> 'resolvido'
      )
    )
  );
