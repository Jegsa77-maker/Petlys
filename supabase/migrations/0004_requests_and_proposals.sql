-- ============================================================================
-- 0004_requests_and_proposals.sql
-- Ciclo de vida do atendimento: solicitações, ocorrências, chat, propostas.
-- (seção 3, 4, 5, 6 da especificação)
-- ============================================================================

create table public.requests (
  id uuid primary key default gen_random_uuid(),
  tutor_id uuid not null references public.profiles (id),
  professional_id uuid not null references public.profiles (id),
  category service_category not null,
  status request_status not null default 'rascunho',
  is_recurring boolean not null default false,
  occurrences_total integer not null default 1 check (occurrences_total >= 1),
  commission_percent_snapshot numeric(5, 2),
  contact_unlocked_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on column public.requests.commission_percent_snapshot is 'Copiado de platform_parameters no momento em que a proposta é aceita. Nunca recalculado depois (seção 9.4, ADR-003).';
comment on column public.requests.contact_unlocked_at is 'E-mail/telefone entre as partes só ficam visíveis a partir deste momento (seção 2.4).';

create index requests_tutor_idx on public.requests (tutor_id);
create index requests_professional_idx on public.requests (professional_id);
create index requests_status_idx on public.requests (status);

create trigger requests_set_updated_at
  before update on public.requests
  for each row execute function public.set_updated_at();

-- ----------------------------------------------------------------------------
-- request_pets — múltiplos pets por solicitação (seção 6.1)
-- ----------------------------------------------------------------------------
create table public.request_pets (
  request_id uuid not null references public.requests (id) on delete cascade,
  pet_id uuid not null references public.pets (id),
  primary key (request_id, pet_id)
);

-- ----------------------------------------------------------------------------
-- request_occurrences — uma linha por execução (única ou recorrente, seção 6.2)
-- ----------------------------------------------------------------------------
create table public.request_occurrences (
  id uuid primary key default gen_random_uuid(),
  request_id uuid not null references public.requests (id) on delete cascade,
  sequence_number integer not null default 1,
  scheduled_at timestamptz not null,
  status occurrence_status not null default 'agendado',
  checkin_at timestamptz,
  checkin_lat double precision,
  checkin_lng double precision,
  completed_at timestamptz,
  report jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  unique (request_id, sequence_number)
);

create index request_occurrences_request_idx on public.request_occurrences (request_id);
create index request_occurrences_status_idx on public.request_occurrences (status);

-- ----------------------------------------------------------------------------
-- messages — chat da solicitação (seção 3.7 / 7.1)
-- ----------------------------------------------------------------------------
create table public.messages (
  id uuid primary key default gen_random_uuid(),
  request_id uuid not null references public.requests (id) on delete cascade,
  sender_id uuid not null references public.profiles (id),
  content text not null,
  flagged_reason text,   -- reservado para o futuro orquestrador de IA (backlog, seção 2.4)
  created_at timestamptz not null default now()
);

create index messages_request_idx on public.messages (request_id, created_at);

-- ----------------------------------------------------------------------------
-- proposals — versão + validade (seção 3, estado "Proposta enviada")
-- ----------------------------------------------------------------------------
create table public.proposals (
  id uuid primary key default gen_random_uuid(),
  request_id uuid not null references public.requests (id) on delete cascade,
  version integer not null default 1,
  scope text not null,
  price numeric(10, 2) not null,
  additional_fees numeric(10, 2) not null default 0,
  validity_at timestamptz not null,
  cancellation_policy jsonb not null default '{}'::jsonb,
  requires_full_payment boolean not null default true,
  deposit_percent numeric(5, 2),
  created_by uuid not null references public.profiles (id),
  created_at timestamptz not null default now(),
  accepted_at timestamptz,
  unique (request_id, version)
);

create index proposals_request_idx on public.proposals (request_id);
