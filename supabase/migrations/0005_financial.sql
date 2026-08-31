-- ============================================================================
-- 0005_financial.sql
-- Pagamentos, repasses (payouts), cancelamento pelo profissional e não
-- comparecimento. (seção 6.3, 6.4, 9 da especificação)
-- ============================================================================

create table public.payments (
  id uuid primary key default gen_random_uuid(),
  request_id uuid not null references public.requests (id),
  gateway_transaction_id text,
  amount numeric(10, 2) not null,
  commission_amount numeric(10, 2) not null default 0,
  status payment_status not null default 'pendente',
  paid_at timestamptz,
  created_at timestamptz not null default now()
);

comment on table public.payments is 'Um pagamento cobre o contrato inteiro, mesmo em recorrência — pagamento integral antecipado (seção 6.2).';

create index payments_request_idx on public.payments (request_id);
create index payments_status_idx on public.payments (status);

-- ----------------------------------------------------------------------------
-- payouts — extrato do profissional em 3 status + bloqueio por incidente
-- ----------------------------------------------------------------------------
create table public.payouts (
  id uuid primary key default gen_random_uuid(),
  professional_id uuid not null references public.profiles (id),
  request_id uuid not null references public.requests (id),
  amount numeric(10, 2) not null,
  status payout_status not null default 'agendado',
  requested_at timestamptz,
  paid_at timestamptz,
  gateway_transfer_id text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on column public.payouts.status is 'agendado -> retido -> disponivel -> solicitado -> pago. bloqueado quando há incidente aberto vinculado (seção 9.2).';

create index payouts_professional_idx on public.payouts (professional_id);
create index payouts_status_idx on public.payouts (status);
create index payouts_request_idx on public.payouts (request_id);

create trigger payouts_set_updated_at
  before update on public.payouts
  for each row execute function public.set_updated_at();

-- ----------------------------------------------------------------------------
-- professional_cancellations — débito de taxa quando o profissional cancela
-- (seção 6.3: tutor recebe 100%, profissional fica devendo a taxa)
-- ----------------------------------------------------------------------------
create table public.professional_cancellations (
  id uuid primary key default gen_random_uuid(),
  request_id uuid not null references public.requests (id),
  occurrence_id uuid references public.request_occurrences (id),
  professional_id uuid not null references public.profiles (id),
  refunded_amount numeric(10, 2) not null,
  debited_commission numeric(10, 2) not null,
  settled boolean not null default false,
  settled_at timestamptz,
  created_at timestamptz not null default now()
);

create index professional_cancellations_professional_idx on public.professional_cancellations (professional_id) where not settled;

-- ----------------------------------------------------------------------------
-- no_show_records — comprovação e retenção no não comparecimento (seção 6.4)
-- ----------------------------------------------------------------------------
create table public.no_show_records (
  id uuid primary key default gen_random_uuid(),
  request_id uuid not null references public.requests (id),
  occurrence_id uuid not null references public.request_occurrences (id),
  reported_party no_show_party not null,   -- quem não compareceu
  reported_by uuid not null references public.profiles (id),
  min_wait_confirmed boolean not null default false,
  checkin_confirmed boolean not null default false,
  contact_attempt_confirmed boolean not null default false,
  retained_percent numeric(5, 2),
  retained_amount numeric(10, 2),
  professional_compensation numeric(10, 2),
  created_at timestamptz not null default now()
);

comment on table public.no_show_records is 'Comprovação = tempo mínimo de espera + check-in (geolocalização quando disponível) + tentativa de contato pelo chat (seção 6.4).';

create index no_show_records_request_idx on public.no_show_records (request_id);
