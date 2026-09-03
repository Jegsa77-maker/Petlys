-- Onda 3 (fundação sem gateway) — Etapa 1: onboarding de recebedor.
-- Guarda o vínculo profile_id <-> recipient do gateway de pagamento, criado por uma
-- Server Action via service_role só depois que a chamada real ao gateway teve sucesso
-- (mesmo padrão de confiança de payments/payouts: nunca escrito direto pelo cliente).

create type public.recipient_status as enum ('pendente', 'ativo', 'rejeitado', 'desabilitado');

create table public.professional_recipients (
  profile_id uuid primary key references public.profiles (id) on delete cascade,
  gateway_recipient_id text,
  status public.recipient_status not null default 'pendente',
  bank_code text,
  agencia text,
  agencia_dv text,
  conta text,
  conta_dv text,
  conta_tipo text check (conta_tipo in ('corrente', 'poupanca')),
  transfer_enabled boolean not null default false,
  rejection_reason text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.professional_recipients is
  'Onboarding financeiro do profissional (Onda 3). transfer_enabled fica sempre false por decisão de produto (spec 9.2: saque só sob solicitação, nunca automático em background).';

create trigger professional_recipients_set_updated_at
  before update on public.professional_recipients
  for each row execute function public.set_updated_at();

alter table public.professional_recipients enable row level security;

create policy professional_recipients_select on public.professional_recipients
  for select using (
    profile_id = auth.uid() or public.is_admin_or_supervisor()
  );

-- Sem policy de insert/update/delete para authenticated: só service_role grava,
-- e só depois de confirmar a chamada real ao gateway (mesmo padrão de payments/payouts).
