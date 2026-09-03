-- Onda 3 (fundação sem gateway) — Etapa 5. gateway_transfer_id já existia.
alter table public.payouts
  add column failure_reason text;
