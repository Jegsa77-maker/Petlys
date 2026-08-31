-- ============================================================================
-- 0007_safety_and_reputation.sql
-- Incidentes/disputas, avaliações bilaterais e notificações.
-- (seção 7.2, 8.2, 10 da especificação)
-- ============================================================================

create table public.incidents (
  id uuid primary key default gen_random_uuid(),
  request_id uuid not null references public.requests (id),
  occurrence_id uuid references public.request_occurrences (id),
  opened_by uuid not null references public.profiles (id),
  type text not null,
  urgency incident_urgency not null default 'media',
  status incident_status not null default 'aberto',
  assigned_to uuid references public.profiles (id),
  resolution text,
  blocks_payout boolean not null default true,
  created_at timestamptz not null default now(),
  resolved_at timestamptz
);

comment on table public.incidents is 'SLA único de resposta (parâmetro em platform_parameters), não diferenciado por urgência (seção 10.3).';

create index incidents_request_idx on public.incidents (request_id);
create index incidents_status_idx on public.incidents (status) where status in ('aberto', 'em_analise', 'escalado');
create index incidents_assigned_idx on public.incidents (assigned_to);

create table public.incident_evidence (
  id uuid primary key default gen_random_uuid(),
  incident_id uuid not null references public.incidents (id) on delete cascade,
  url text not null,
  type text not null,   -- 'foto' | 'video' | 'documento'
  uploaded_by uuid not null references public.profiles (id),
  created_at timestamptz not null default now()
);

create index incident_evidence_incident_idx on public.incident_evidence (incident_id);

-- ----------------------------------------------------------------------------
-- Trigger: incidente aberto bloqueia o(s) payout(s) do atendimento (seção 9.2)
-- ----------------------------------------------------------------------------
create or replace function public.apply_incident_payout_block()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.blocks_payout and new.status in ('aberto', 'em_analise', 'escalado') then
    update public.payouts
      set status = 'bloqueado'
      where request_id = new.request_id
        and status not in ('pago', 'bloqueado');
  elsif new.status = 'resolvido' then
    update public.payouts
      set status = 'disponivel'
      where request_id = new.request_id
        and status = 'bloqueado';
  end if;
  return new;
end;
$$;

create trigger incidents_apply_payout_block
  after insert or update on public.incidents
  for each row execute function public.apply_incident_payout_block();

-- ----------------------------------------------------------------------------
-- reviews — bilaterais, só após atendimento concluído (seção 7.2)
-- ----------------------------------------------------------------------------
create table public.reviews (
  id uuid primary key default gen_random_uuid(),
  request_id uuid not null references public.requests (id),
  reviewer_id uuid not null references public.profiles (id),
  reviewee_id uuid not null references public.profiles (id),
  rating jsonb not null,     -- critérios múltiplos: {"qualidade":5,"comunicacao":5,...}
  comment text,
  response text,
  created_at timestamptz not null default now(),
  unique (request_id, reviewer_id)
);

create index reviews_reviewee_idx on public.reviews (reviewee_id);
create index reviews_request_idx on public.reviews (request_id);

-- ----------------------------------------------------------------------------
-- notifications
-- ----------------------------------------------------------------------------
create table public.notifications (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references public.profiles (id) on delete cascade,
  type text not null,
  payload jsonb not null default '{}'::jsonb,
  read_at timestamptz,
  created_at timestamptz not null default now()
);

create index notifications_profile_idx on public.notifications (profile_id, created_at desc);
create index notifications_unread_idx on public.notifications (profile_id) where read_at is null;
