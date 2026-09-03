-- Onda 3 (fundação sem gateway) — Etapa 1: idempotência de webhook.
-- gateway_event_id unique + on conflict do nothing é o mecanismo real de idempotência
-- (não é só uma checagem em memória) quando o webhook do gateway começar a chegar (Etapa 2).

create table public.webhook_events (
  id uuid primary key default gen_random_uuid(),
  gateway_event_id text not null,
  type text not null,
  payload jsonb not null,
  verified boolean not null default false,
  received_at timestamptz not null default now(),
  processed_at timestamptz,
  error text,
  unique (gateway_event_id)
);

comment on table public.webhook_events is
  'Log de eventos recebidos de webhook de gateway de pagamento (Onda 3). O unique em gateway_event_id + insert...on conflict do nothing no Route Handler é o mecanismo de idempotência real.';

alter table public.webhook_events enable row level security;

create policy webhook_events_select on public.webhook_events
  for select using (public.is_admin_or_supervisor());

-- Sem policy de insert/update para authenticated/anon: só service_role grava
-- (o Route Handler do webhook não tem sessão de usuário nenhuma).
