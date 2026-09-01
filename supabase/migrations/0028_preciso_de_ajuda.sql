-- ============================================================================
-- 0028_preciso_de_ajuda.sql
-- Onda 4, item 2 — botão "Preciso de ajuda" (seção 8.2 da Especificação
-- v2.0). A tabela `incidents` e o tratamento (fila do Admin/Supervisor,
-- bloqueio automático de payout, intervenção no chat) já existiam desde
-- 0007/0015 — faltava só a porta de entrada pro próprio Tutor/Profissional
-- abrir um incidente, e a notificação pro suporte ficar sabendo.
-- ============================================================================

-- Relato obrigatório em texto livre — a classificação (`type`) serve pra
-- estatística/priorização, mas não substitui o relato do que aconteceu.
alter table public.incidents
  add column description text not null default '';

comment on column public.incidents.description is 'Relato em texto livre de quem abriu o incidente — obrigatório na aplicação (schema zod), sem valor default de verdade fora de linhas antigas.';

-- ----------------------------------------------------------------------------
-- Notificação automática: incidente aberto avisa todo Admin/Supervisor
-- ativo (ninguém foi designado responsável ainda nesse momento — isso só
-- acontece depois, via `assigned_to`). Mesmo padrão de public.notify() já
-- usado em 0012_lifecycle_geo_notifications_storage.sql.
-- ----------------------------------------------------------------------------
create or replace function public.notify_new_incident()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.notifications (profile_id, type, payload)
  select profile_id, 'incidente_aberto', jsonb_build_object(
    'incident_id', new.id,
    'request_id', new.request_id,
    'incident_type', new.type,
    'urgency', new.urgency
  )
  from public.account_roles
  where role in ('administrador', 'supervisor') and active;
  return new;
end;
$$;

create trigger incidents_notify after insert on public.incidents
  for each row execute function public.notify_new_incident();
