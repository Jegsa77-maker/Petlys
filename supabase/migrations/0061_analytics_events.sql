-- Dashboard de KPIs do Admin (itens 19-20) — log write-only pros KPIs de
-- funil/aquisição classificados "C" na especificação externa (origem dos
-- cadastros, busca->perfil, perfil->solicitação). Não é um sistema de
-- indicação/CRM (itens 21-22 do backlog seguem fora de escopo) — só
-- atribuição mínima de canal via UTM, capturada no clique em "Criar conta".
create table public.analytics_events (
  id uuid primary key default gen_random_uuid(),
  event_name text not null,
  session_id uuid not null,
  profile_id uuid references public.profiles (id),
  professional_id uuid references public.profiles (id),
  request_id uuid references public.requests (id),
  category public.service_category,
  uf text,
  source text,
  medium text,
  campaign text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

comment on table public.analytics_events is
  'Telemetria de produto write-only. profile_id fica nulo em eventos
   anteriores ao cadastro (não existe navegação anônima hoje fora de
   /login, então isso só acontece no clique em "Criar conta"). session_id
   vem do cookie plys_sid (ver lib/supabase/middleware.ts), gerado pra todo
   visitante, logado ou não.';

create index analytics_events_name_created_idx on public.analytics_events (event_name, created_at);
create index analytics_events_session_idx on public.analytics_events (session_id);
create index analytics_events_profile_idx on public.analytics_events (profile_id) where profile_id is not null;

alter table public.analytics_events enable row level security;

-- Qualquer visitante (anônimo ou logado) pode registrar um evento — é só
-- telemetria de produto, sem dado sensível, mesmo espírito de write-only
-- de webhook_events. Só Admin/Supervisor lê. Sem policy de update/delete:
-- log imutável.
create policy analytics_events_insert_anyone on public.analytics_events
  for insert to anon, authenticated
  with check (true);

create policy analytics_events_select_admin on public.analytics_events
  for select using (public.is_admin_or_supervisor());
