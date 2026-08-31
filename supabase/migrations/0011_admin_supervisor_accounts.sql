-- ============================================================================
-- 0011_admin_supervisor_accounts.sql
-- Contas internas (Administrador/Supervisor) com usuário + senha, e o
-- fluxo de suspensão: recomendação do Supervisor, aprovação do Admin
-- (seção 10.2 da especificação; gap 4.9 apontado na revisão externa).
-- ============================================================================

-- ----------------------------------------------------------------------------
-- Usuário interno (login por usuário+senha, não Google/Facebook).
-- O Supabase Auth exige e-mail/telefone como identificador; por isso
-- guardamos aqui o "usuário" que a pessoa realmente digita, mapeado para
-- um e-mail sintético interno usado só internamente pelo Supabase Auth
-- (ex: usuario@internal.plataformapet) — nunca exposto na interface.
-- ----------------------------------------------------------------------------
alter table public.profiles
  add column internal_username text unique
    constraint profiles_internal_username_length check (
      internal_username is null or length(internal_username) > 5
    );

comment on column public.profiles.internal_username is 'Usuário de login para contas internas (Administrador/Supervisor). Nulo para Tutor/Profissional, que entram por Google/Facebook. Mínimo de 6 caracteres.';

-- Só existe usuário interno quando a conta tem papel administrador/supervisor
-- — reforçado na aplicação (Server Action), não é praticamente expressável
-- como constraint de banco sem repetir a lógica de account_roles aqui.

-- ----------------------------------------------------------------------------
-- account_suspensions — recomendação do Supervisor, decisão do Admin
-- (seção 10.2: "pode marcar uma conta para suspensão — a suspensão
-- efetiva depende da confirmação do Administrador").
-- ----------------------------------------------------------------------------
create type suspension_status as enum ('pendente', 'aprovada', 'rejeitada');

create table public.account_suspensions (
  id uuid primary key default gen_random_uuid(),
  target_profile_id uuid not null references public.profiles (id),
  recommended_by uuid not null references public.profiles (id),
  reason text not null,
  related_incident_id uuid references public.incidents (id),
  status suspension_status not null default 'pendente',
  decided_by uuid references public.profiles (id),
  decided_at timestamptz,
  created_at timestamptz not null default now()
);

comment on table public.account_suspensions is 'Fluxo de duas etapas: Supervisor recomenda (insert), Administrador decide (update status). Nunca suspende sozinho a partir da recomendação.';

create index account_suspensions_target_idx on public.account_suspensions (target_profile_id);
create index account_suspensions_pending_idx on public.account_suspensions (status) where status = 'pendente';

-- ----------------------------------------------------------------------------
-- Trigger: quando o Admin aprova, desativa todos os papéis ativos da conta.
-- ----------------------------------------------------------------------------
create or replace function public.apply_account_suspension()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.status = 'aprovada' and old.status is distinct from 'aprovada' then
    update public.account_roles
      set active = false
      where profile_id = new.target_profile_id;
  end if;
  return new;
end;
$$;

create trigger account_suspensions_apply
  after update on public.account_suspensions
  for each row execute function public.apply_account_suspension();

-- ----------------------------------------------------------------------------
-- Auditoria administrativa genérica (seção 10, gap 4.9 da revisão) —
-- toda ação sensível de Admin/Supervisor fica registrada aqui, além dos
-- logs específicos que já existem (platform_parameters_log).
-- ----------------------------------------------------------------------------
create table public.admin_audit_log (
  id uuid primary key default gen_random_uuid(),
  actor_id uuid not null references public.profiles (id),
  action text not null,
  target_profile_id uuid references public.profiles (id),
  target_incident_id uuid references public.incidents (id),
  details jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index admin_audit_log_actor_idx on public.admin_audit_log (actor_id);
create index admin_audit_log_target_profile_idx on public.admin_audit_log (target_profile_id);

-- ----------------------------------------------------------------------------
-- RLS
-- ----------------------------------------------------------------------------
alter table public.account_suspensions enable row level security;

create policy account_suspensions_select on public.account_suspensions
  for select using (public.is_admin_or_supervisor());

create policy account_suspensions_insert on public.account_suspensions
  for insert with check (recommended_by = auth.uid() and public.is_admin_or_supervisor());

create policy account_suspensions_update_admin on public.account_suspensions
  for update using (public.has_role('administrador'));

alter table public.admin_audit_log enable row level security;

create policy admin_audit_log_select on public.admin_audit_log
  for select using (public.is_admin_or_supervisor());

-- Sem policy de insert para authenticated: só service_role grava (as
-- Server Actions administrativas gravam a auditoria como parte da mesma
-- operação, usando o cliente com service_role).
