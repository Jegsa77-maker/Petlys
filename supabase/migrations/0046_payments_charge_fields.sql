-- Onda 3 (fundação sem gateway) — Etapa 2: campos de cobrança em payments.
-- Puro schema — não depende de nenhuma chamada real ao gateway pra existir.

alter table public.payments
  add column payment_method text check (payment_method in ('pix', 'cartao')),
  add column gateway_order_id text,
  add column professional_amount numeric(10, 2),
  add column gateway_split_snapshot jsonb;

comment on column public.payments.gateway_order_id is
  'ID da order no gateway. Índice único parcial abaixo é dedup na origem, complementa webhook_events.';
comment on column public.payments.gateway_split_snapshot is
  'Resposta bruta do split efetivamente executado pelo gateway — usado na conciliação (Etapa 6) pra comparar com o que devíamos ter mandado.';

create unique index payments_gateway_order_id_unique_idx
  on public.payments (gateway_order_id)
  where gateway_order_id is not null;
