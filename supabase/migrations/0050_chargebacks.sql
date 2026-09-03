-- Onda 3 (fundação sem gateway) — Etapa 4: chargeback. Espelha professional_cancellations.
-- Evento chargeback.received (nome correto — charge.chargedback está descontinuado
-- até 30/09/2026) vai abrir um incidents com blocks_payout:true, reaproveitando a trigger
-- apply_incident_payout_block() já existente, em vez de reimplementar bloqueio de saque.

create table public.chargebacks (
  id uuid primary key default gen_random_uuid(),
  payment_id uuid not null references public.payments (id) on delete cascade,
  request_id uuid not null references public.requests (id),
  amount numeric(10, 2) not null,
  status text not null default 'em_analise' check (status in ('em_analise', 'ganho', 'perdido')),
  incident_id uuid references public.incidents (id),
  debited_amount numeric(10, 2),
  reported_at timestamptz not null default now(),
  resolved_at timestamptz
);

comment on table public.chargebacks is
  'Onda 3, Etapa 4. incident_id liga ao incidente aberto automaticamente pra reaproveitar o bloqueio de saque já existente (apply_incident_payout_block).';

alter table public.chargebacks enable row level security;

create policy chargebacks_select on public.chargebacks
  for select using (
    public.is_party_of_request(request_id) or public.is_admin_or_supervisor()
  );

create policy chargebacks_update_admin on public.chargebacks
  for update using (public.has_role('administrador'));

-- Sem insert pra authenticated: só service_role, criado pelo webhook (Etapa 4).
