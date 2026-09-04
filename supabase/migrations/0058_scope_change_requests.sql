create type public.scope_change_field as enum ('escopo', 'valor', 'data');
create type public.scope_change_status as enum ('pendente', 'aceito', 'recusado');

create table public.scope_change_requests (
  id uuid primary key default gen_random_uuid(),
  request_id uuid not null references public.requests (id),
  -- Só preenchido quando field_changed = 'data': sem isso, num contrato
  -- recorrente com várias ocorrências fica ambíguo qual data está mudando.
  occurrence_id uuid references public.request_occurrences (id),
  proposed_by uuid not null references public.profiles (id),
  field_changed public.scope_change_field not null,
  old_value text not null,
  new_value text not null,
  status public.scope_change_status not null default 'pendente',
  responded_at timestamptz,
  responded_by uuid references public.profiles (id),
  created_at timestamptz not null default now()
);

comment on table public.scope_change_requests is
  'Mudança de escopo/valor/data DEPOIS que a proposta já foi aceita (item 23/24 do backlog) — nunca mexe em requests.status, ao contrário de requestAdjustment (pré-aceite). Sem efeito financeiro real (Onda 3 pausada): valor aceito fica só como registro histórico.';

create index scope_change_requests_request_idx on public.scope_change_requests (request_id, created_at desc);

-- Evita duas propostas conflitantes abertas ao mesmo tempo pro mesmo campo.
create unique index scope_change_requests_one_pending_per_field_idx
  on public.scope_change_requests (request_id, field_changed)
  where status = 'pendente';

alter table public.scope_change_requests enable row level security;

create policy scope_change_requests_select on public.scope_change_requests
  for select using (public.is_party_of_request(request_id) or public.is_admin_or_supervisor());

create policy scope_change_requests_insert on public.scope_change_requests
  for insert with check (proposed_by = auth.uid() and public.is_party_of_request(request_id));

-- Só a CONTRAPARTE de quem propôs pode responder — mesmo padrão de
-- 0022_fix_proposals_accept_rls.sql.
create policy scope_change_requests_update_counterpart on public.scope_change_requests
  for update using (public.is_party_of_request(request_id) and proposed_by <> auth.uid());

revoke update on public.scope_change_requests from authenticated;
grant update (status, responded_at, responded_by) on public.scope_change_requests to authenticated;

create or replace function public.notify_new_scope_change()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  v_tutor_id uuid; v_professional_id uuid; v_recipient uuid;
begin
  select tutor_id, professional_id into v_tutor_id, v_professional_id
  from public.requests where id = new.request_id;
  v_recipient := case when new.proposed_by = v_tutor_id then v_professional_id else v_tutor_id end;
  perform public.notify(v_recipient, 'mudanca_escopo_proposta', jsonb_build_object(
    'request_id', new.request_id, 'scope_change_id', new.id, 'field_changed', new.field_changed
  ));
  return new;
end $$;

create trigger scope_change_requests_notify after insert on public.scope_change_requests
  for each row execute function public.notify_new_scope_change();

create or replace function public.notify_scope_change_response()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if old.status = 'pendente' and new.status <> 'pendente' then
    perform public.notify(new.proposed_by, 'mudanca_escopo_respondida', jsonb_build_object(
      'request_id', new.request_id, 'scope_change_id', new.id, 'status', new.status
    ));
  end if;
  return new;
end $$;

create trigger scope_change_requests_notify_response after update of status on public.scope_change_requests
  for each row execute function public.notify_scope_change_response();

-- Achado recorrente da sessão: conferir com has_function_privilege depois de
-- aplicar — às vezes o Supabase concede EXECUTE pra PUBLIC também.
revoke execute on function public.notify_new_scope_change() from public, anon, authenticated;
revoke execute on function public.notify_scope_change_response() from public, anon, authenticated;
