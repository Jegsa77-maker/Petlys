-- Onda 3 (fundação sem gateway) — Etapa 6: conciliação do Admin.
-- Detecção persistida (não view calculada) — mesmo padrão de fila do Admin já usado
-- (incidents/moderação): dá pra testar com dados sintéticos, sem nunca ter passado
-- por um pagamento real.

create type public.reconciliation_category as enum (
  'duplicidade_pagamento',
  'split_incorreto',
  'webhook_divergente',
  'saque_indevido'
);

create table public.reconciliation_flags (
  id uuid primary key default gen_random_uuid(),
  category public.reconciliation_category not null,
  payment_id uuid references public.payments (id),
  payout_id uuid references public.payouts (id),
  request_id uuid references public.requests (id),
  details jsonb not null default '{}'::jsonb,
  status text not null default 'aberto' check (status in ('aberto', 'resolvido')),
  detected_at timestamptz not null default now(),
  resolved_at timestamptz,
  resolved_by uuid references public.profiles (id)
);

comment on table public.reconciliation_flags is
  'Achados da conciliação financeira (Onda 3, Etapa 6). Índice único parcial evita duplicar o mesmo achado a cada rodada de detecção.';

create unique index reconciliation_flags_open_unique_idx
  on public.reconciliation_flags (
    category,
    coalesce(payment_id, '00000000-0000-0000-0000-000000000000'::uuid),
    coalesce(payout_id, '00000000-0000-0000-0000-000000000000'::uuid)
  )
  where status = 'aberto';

alter table public.reconciliation_flags enable row level security;

create policy reconciliation_flags_select on public.reconciliation_flags
  for select using (public.is_admin_or_supervisor());

create policy reconciliation_flags_update on public.reconciliation_flags
  for update using (public.is_admin_or_supervisor());

-- Sem insert pra authenticated: só a função de detecção (security definer, via pg_cron)
-- e o service_role gravam.

create or replace function public.detect_reconciliation_issues()
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  -- 1. Duplicidade: mais de um payments 'pago' pro mesmo request_id.
  insert into public.reconciliation_flags (category, payment_id, request_id, details)
  select 'duplicidade_pagamento', p.id, p.request_id,
         jsonb_build_object('motivo', 'mais de um payment pago para a mesma request')
  from public.payments p
  where p.status = 'pago'
    and (
      select count(*) from public.payments p2
      where p2.request_id = p.request_id and p2.status = 'pago'
    ) > 1
  on conflict do nothing;

  -- 2. Split incorreto: commission_amount gravado diverge do esperado pelo snapshot da request.
  insert into public.reconciliation_flags (category, payment_id, request_id, details)
  select 'split_incorreto', p.id, p.request_id,
         jsonb_build_object(
           'commission_amount_gravado', p.commission_amount,
           'commission_amount_esperado', round(p.amount * coalesce(r.commission_percent_snapshot, 0) / 100, 2)
         )
  from public.payments p
  join public.requests r on r.id = p.request_id
  where p.status = 'pago'
    and r.commission_percent_snapshot is not null
    and abs(p.commission_amount - round(p.amount * r.commission_percent_snapshot / 100, 2)) > 0.01
  on conflict do nothing;

  -- 3. Webhook divergente: evento não verificado, ou recebido e nunca processado.
  insert into public.reconciliation_flags (category, details)
  select 'webhook_divergente',
         jsonb_build_object('webhook_event_id', w.id, 'type', w.type, 'verified', w.verified,
           'motivo', case when not w.verified then 'assinatura invalida' else 'recebido ha mais de 1h sem ser processado' end)
  from public.webhook_events w
  where (not w.verified or (w.processed_at is null and w.received_at < now() - interval '1 hour'))
  on conflict do nothing;

  -- 4. Saque indevido: payout pago/solicitado com incidente bloqueante ainda aberto na mesma request.
  insert into public.reconciliation_flags (category, payout_id, request_id, details)
  select 'saque_indevido', po.id, po.request_id,
         jsonb_build_object('motivo', 'payout pago/solicitado com incidente bloqueante aberto')
  from public.payouts po
  join public.incidents i on i.request_id = po.request_id
  where po.status in ('solicitado', 'pago')
    and i.blocks_payout
    and i.status in ('aberto', 'em_analise', 'escalado')
  on conflict do nothing;

  insert into public.reconciliation_flags (category, payout_id, request_id, details)
  select 'saque_indevido', po.id, po.request_id,
         jsonb_build_object('motivo', 'payout pago sem gateway_transfer_id')
  from public.payouts po
  where po.status = 'pago' and po.gateway_transfer_id is null
  on conflict do nothing;
end;
$$;

comment on function public.detect_reconciliation_issues() is
  'Roda de hora em hora via pg_cron. Uma consulta por categoria das 4 da spec (9.4/12.2). Testável com dados sintéticos, sem gateway real.';

revoke execute on function public.detect_reconciliation_issues() from anon, authenticated;

select cron.schedule(
  'detect-reconciliation-issues',
  '0 * * * *',
  $$select public.detect_reconciliation_issues()$$
);
