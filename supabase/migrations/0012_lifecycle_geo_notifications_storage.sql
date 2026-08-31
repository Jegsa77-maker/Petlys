-- ============================================================================
-- 0012_lifecycle_geo_notifications_storage.sql
-- Fecha os gaps restantes da Fase 3 (exceto financeiro):
--   A. Máquina de estados formal — transições permitidas + histórico
--   B. Visita inicial como miniatendimento independente
--   C. Notificações automáticas (triggers nos eventos-chave)
--   D. Busca geográfica (CEP/coordenadas + raio)
--   E. Buckets de Storage para anexos (evidências de incidente, relatórios)
-- ============================================================================

-- ============================================================================
-- A. MÁQUINA DE ESTADOS FORMAL
-- ============================================================================

create table public.request_status_transitions_allowed (
  from_status request_status not null,
  to_status request_status not null,
  primary key (from_status, to_status)
);

comment on table public.request_status_transitions_allowed is 'Define as transições de status permitidas para requests — reforçadas por trigger, não só documentadas (gap 4.5 da revisão externa).';

insert into public.request_status_transitions_allowed (from_status, to_status) values
  ('rascunho', 'solicitacao_enviada'),
  ('rascunho', 'cancelado'),
  ('solicitacao_enviada', 'em_conversa'),
  ('solicitacao_enviada', 'proposta_enviada'),
  ('solicitacao_enviada', 'recusado'),
  ('solicitacao_enviada', 'expirado'),
  ('em_conversa', 'proposta_enviada'),
  ('em_conversa', 'recusado'),
  ('em_conversa', 'expirado'),
  ('proposta_enviada', 'aguardando_pagamento'),
  ('proposta_enviada', 'proposta_enviada'),   -- nova versão de proposta
  ('proposta_enviada', 'recusado'),
  ('proposta_enviada', 'expirado'),
  ('proposta_enviada', 'cancelado'),
  ('aguardando_pagamento', 'confirmado'),
  ('aguardando_pagamento', 'expirado'),
  ('aguardando_pagamento', 'cancelado'),
  ('confirmado', 'checkin'),
  ('confirmado', 'cancelado'),
  ('confirmado', 'incidente'),
  ('checkin', 'em_andamento'),
  ('checkin', 'incidente'),
  ('checkin', 'cancelado'),
  ('em_andamento', 'finalizacao'),
  ('em_andamento', 'incidente'),
  ('finalizacao', 'concluido'),
  ('finalizacao', 'incidente'),
  ('concluido', 'avaliacao'),
  ('incidente', 'em_disputa'),
  ('incidente', 'confirmado'),      -- incidente resolvido, atendimento segue
  ('incidente', 'checkin'),
  ('incidente', 'em_andamento'),
  ('incidente', 'cancelado'),
  ('em_disputa', 'cancelado'),
  ('em_disputa', 'concluido');

create table public.request_status_history (
  id uuid primary key default gen_random_uuid(),
  request_id uuid not null references public.requests (id) on delete cascade,
  from_status request_status,
  to_status request_status not null,
  changed_by uuid references public.profiles (id),
  note text,
  created_at timestamptz not null default now()
);

create index request_status_history_request_idx on public.request_status_history (request_id, created_at);

create or replace function public.enforce_and_log_status_transition()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if old.status is distinct from new.status then
    if old.status is not null and not exists (
      select 1 from public.request_status_transitions_allowed
      where from_status = old.status and to_status = new.status
    ) then
      raise exception 'Transição de status não permitida: % -> %', old.status, new.status;
    end if;

    insert into public.request_status_history (request_id, from_status, to_status, changed_by)
    values (new.id, old.status, new.status, auth.uid());
  end if;
  return new;
end;
$$;

create trigger requests_enforce_and_log_status
  before update on public.requests
  for each row execute function public.enforce_and_log_status_transition();

alter table public.request_status_history enable row level security;

create policy request_status_history_select on public.request_status_history
  for select using (public.is_party_of_request(request_id) or public.is_admin_or_supervisor());

alter table public.request_status_transitions_allowed enable row level security;

create policy request_status_transitions_select_all on public.request_status_transitions_allowed
  for select using (true);

-- ============================================================================
-- B. VISITA INICIAL — miniatendimento independente (seção 5.5)
-- ============================================================================

alter table public.requests
  add column is_visita_inicial boolean not null default false,
  add column origin_request_id uuid references public.requests (id);

comment on column public.requests.is_visita_inicial is 'true quando este "request" é uma visita inicial (presencial ou online), e não o atendimento principal.';
comment on column public.requests.origin_request_id is 'Preenchido no atendimento principal quando ele nasce de uma visita inicial paga — permite abater o valor da visita, conforme configurado pelo profissional (seção 5.5).';

-- ============================================================================
-- C. NOTIFICAÇÕES AUTOMÁTICAS
-- ============================================================================

create or replace function public.notify(
  p_profile_id uuid, p_type text, p_payload jsonb
) returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.notifications (profile_id, type, payload)
  values (p_profile_id, p_type, p_payload);
end;
$$;

-- Nova mensagem: notifica quem NÃO enviou.
create or replace function public.notify_new_message()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_tutor_id uuid;
  v_professional_id uuid;
  v_recipient uuid;
begin
  select tutor_id, professional_id into v_tutor_id, v_professional_id
  from public.requests where id = new.request_id;

  v_recipient := case when new.sender_id = v_tutor_id then v_professional_id else v_tutor_id end;

  perform public.notify(v_recipient, 'nova_mensagem', jsonb_build_object(
    'request_id', new.request_id, 'preview', left(new.content, 80)
  ));
  return new;
end;
$$;

create trigger messages_notify after insert on public.messages
  for each row execute function public.notify_new_message();

-- Proposta enviada: notifica o tutor.
create or replace function public.notify_new_proposal()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_tutor_id uuid;
begin
  select tutor_id into v_tutor_id from public.requests where id = new.request_id;
  perform public.notify(v_tutor_id, 'proposta_recebida', jsonb_build_object(
    'request_id', new.request_id, 'price', new.price
  ));
  return new;
end;
$$;

create trigger proposals_notify after insert on public.proposals
  for each row execute function public.notify_new_proposal();

-- Mudança de status relevante: notifica ambas as partes.
create or replace function public.notify_status_change()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.status in ('confirmado', 'concluido', 'cancelado', 'recusado', 'incidente') then
    perform public.notify(new.tutor_id, 'status_atendimento', jsonb_build_object(
      'request_id', new.id, 'status', new.status
    ));
    perform public.notify(new.professional_id, 'status_atendimento', jsonb_build_object(
      'request_id', new.id, 'status', new.status
    ));
  end if;
  return new;
end;
$$;

create trigger requests_notify_status after update of status on public.requests
  for each row execute function public.notify_status_change();

-- Avaliação recebida: notifica o avaliado.
create or replace function public.notify_new_review()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  perform public.notify(new.reviewee_id, 'avaliacao_recebida', jsonb_build_object(
    'request_id', new.request_id
  ));
  return new;
end;
$$;

create trigger reviews_notify after insert on public.reviews
  for each row execute function public.notify_new_review();

-- ============================================================================
-- D. BUSCA GEOGRÁFICA (CEP/coordenadas + raio)
-- ============================================================================

alter table public.profiles
  add column address_zip text,
  add column address_lat double precision,
  add column address_lng double precision;

create table public.professional_service_areas (
  id uuid primary key default gen_random_uuid(),
  professional_id uuid not null references public.profiles (id) on delete cascade,
  center_lat double precision not null,
  center_lng double precision not null,
  radius_km numeric(6, 2) not null default 10,
  excluded_zips text[] not null default '{}',
  created_at timestamptz not null default now()
);

comment on table public.professional_service_areas is 'Área de atendimento do profissional: ponto central + raio, com exclusões pontuais por CEP (seção 5.3/7.3).';

create index professional_service_areas_professional_idx on public.professional_service_areas (professional_id);

-- Distância em km entre dois pontos (fórmula de haversine, sem depender de
-- PostGIS — funciona no volume do MVP; migrar para PostGIS + índice GiST
-- quando o volume de profissionais justificar, conforme gap 4.4 da revisão).
create or replace function public.distance_km(
  lat1 double precision, lng1 double precision,
  lat2 double precision, lng2 double precision
) returns double precision
language sql
immutable
as $$
  select 6371 * acos(
    least(1.0, greatest(-1.0,
      cos(radians(lat1)) * cos(radians(lat2)) * cos(radians(lng2) - radians(lng1))
      + sin(radians(lat1)) * sin(radians(lat2))
    ))
  );
$$;

alter table public.professional_service_areas enable row level security;

create policy professional_service_areas_select_public on public.professional_service_areas
  for select using (true);

create policy professional_service_areas_insert on public.professional_service_areas
  for insert with check (professional_id = auth.uid() and public.has_role('profissional'));

create policy professional_service_areas_update on public.professional_service_areas
  for update using (professional_id = auth.uid());

create policy professional_service_areas_delete on public.professional_service_areas
  for delete using (professional_id = auth.uid());

-- ============================================================================
-- E. STORAGE — buckets para anexos (evidências de incidente, relatórios)
-- ============================================================================

insert into storage.buckets (id, name, public)
values
  ('incident-evidence', 'incident-evidence', false),
  ('occurrence-reports', 'occurrence-reports', false)
on conflict (id) do nothing;

-- Só as partes do atendimento (ou incidente) relacionado podem ler/escrever.
-- Caminho esperado no bucket: {request_id}/{arquivo}.
create policy incident_evidence_storage_select on storage.objects
  for select using (
    bucket_id = 'incident-evidence'
    and public.is_party_of_request(((storage.foldername(name))[1])::uuid)
  );

create policy incident_evidence_storage_insert on storage.objects
  for insert with check (
    bucket_id = 'incident-evidence'
    and public.is_party_of_request(((storage.foldername(name))[1])::uuid)
  );

create policy occurrence_reports_storage_select on storage.objects
  for select using (
    bucket_id = 'occurrence-reports'
    and public.is_party_of_request(((storage.foldername(name))[1])::uuid)
  );

create policy occurrence_reports_storage_insert on storage.objects
  for insert with check (
    bucket_id = 'occurrence-reports'
    and public.is_party_of_request(((storage.foldername(name))[1])::uuid)
  );
