-- Onda 3 (fundação sem gateway) — Etapa 3: liga o checkout hospedado (cartão à vista)
-- de volta pro request_id, já que o checkout redireciona o Tutor pra fora e volta.

create table public.checkout_sessions (
  id uuid primary key default gen_random_uuid(),
  request_id uuid not null references public.requests (id) on delete cascade,
  gateway_checkout_id text,
  status text not null default 'criado',
  payment_url text,
  created_at timestamptz not null default now(),
  expires_at timestamptz
);

comment on table public.checkout_sessions is
  'Sessão de checkout hospedado do gateway (Onda 3, Etapa 3 — cartão à vista). Sem parcelamento: uma cobrança, uma liquidação.';

alter table public.checkout_sessions enable row level security;

create policy checkout_sessions_select on public.checkout_sessions
  for select using (
    public.is_party_of_request(request_id) or public.is_admin_or_supervisor()
  );

-- Sem insert/update/delete pra authenticated: só service_role, criado pela Server Action
-- que chama o gateway (initiateCardCheckout, Etapa 3).
