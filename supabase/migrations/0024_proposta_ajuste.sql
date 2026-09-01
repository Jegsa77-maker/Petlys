-- ============================================================================
-- 0024_proposta_ajuste.sql
-- Onda 2, item 5 — pedido de ajuste formal: libera a transição
-- proposta_enviada -> em_conversa (hoje reforçada por trigger, ver
-- 0012_lifecycle_geo_notifications_storage.sql). Sem isso, requestAdjustment
-- (lib/actions/requests.ts) nunca conseguiria voltar a solicitação pra
-- conversa depois de uma proposta já enviada.
-- ============================================================================

insert into public.request_status_transitions_allowed (from_status, to_status) values
  ('proposta_enviada', 'em_conversa');
