-- ============================================================================
-- 0002_identity_and_pets.sql
-- Perfis, papéis de acesso, pets e tutores vinculados.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- profiles — uma linha por conta, estende auth.users
-- ----------------------------------------------------------------------------
create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  full_name text not null,
  email text not null,
  phone text,
  phone_verified_at timestamptz,
  email_verified_at timestamptz,
  birth_date date,
  cpf_cnpj text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint profiles_birth_date_18plus check (
    birth_date is null or birth_date <= (current_date - interval '18 years')
  )
);

comment on table public.profiles is 'Uma linha por conta. Conta ativa exige phone_verified_at e email_verified_at preenchidos (seção 2.1).';
comment on column public.profiles.cpf_cnpj is 'Coletado já no cadastro inicial do profissional (seção 2.3); nulo para contas só-tutor.';

-- ----------------------------------------------------------------------------
-- account_roles — papéis por conta (seção 2.2)
-- ----------------------------------------------------------------------------
create table public.account_roles (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references public.profiles (id) on delete cascade,
  role app_role not null,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  unique (profile_id, role)
);

comment on table public.account_roles is 'Uma conta pode ter tutor e profissional simultaneamente. administrador/supervisor só via fluxo interno.';

create index account_roles_profile_id_idx on public.account_roles (profile_id) where active;

-- ----------------------------------------------------------------------------
-- supervisor_grants — auditoria de criação/revogação de Supervisor (seção 10.2)
-- ----------------------------------------------------------------------------
create table public.supervisor_grants (
  id uuid primary key default gen_random_uuid(),
  supervisor_profile_id uuid not null references public.profiles (id) on delete cascade,
  created_by_admin_id uuid not null references public.profiles (id),
  created_at timestamptz not null default now(),
  revoked_at timestamptz,
  revoked_by_admin_id uuid references public.profiles (id)
);

-- ----------------------------------------------------------------------------
-- pets
-- ----------------------------------------------------------------------------
create table public.pets (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  species text not null,
  breed text,
  sex text,
  birth_approx date,
  size pet_size,
  weight numeric(6, 2),
  photo_url text,
  health_info jsonb not null default '{}'::jsonb,
  behavior_info jsonb not null default '{}'::jsonb,
  routine_info jsonb not null default '{}'::jsonb,
  emergency_info jsonb not null default '{}'::jsonb,
  created_by uuid not null references public.profiles (id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.pets is 'Etapa 1 (name/species/breed/sex/birth_approx/size/weight/photo_url) é obrigatória antes de o pet poder ser incluído em uma solicitação — validado na aplicação (seção 4.1).';

-- ----------------------------------------------------------------------------
-- pet_tutors — múltiplos tutores por pet, todos com acesso completo (seção 2.2)
-- ----------------------------------------------------------------------------
create table public.pet_tutors (
  pet_id uuid not null references public.pets (id) on delete cascade,
  tutor_profile_id uuid not null references public.profiles (id) on delete cascade,
  added_at timestamptz not null default now(),
  primary key (pet_id, tutor_profile_id)
);

create index pet_tutors_tutor_idx on public.pet_tutors (tutor_profile_id);

-- ----------------------------------------------------------------------------
-- updated_at automático
-- ----------------------------------------------------------------------------
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger profiles_set_updated_at
  before update on public.profiles
  for each row execute function public.set_updated_at();

create trigger pets_set_updated_at
  before update on public.pets
  for each row execute function public.set_updated_at();

-- ----------------------------------------------------------------------------
-- Trigger: cria profiles automaticamente ao nascer um novo auth.users
-- (login social preenche nome/e-mail vindos do provedor; telefone vem depois)
-- ----------------------------------------------------------------------------
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, full_name, email)
  values (
    new.id,
    coalesce(new.raw_user_meta_data ->> 'full_name', new.raw_user_meta_data ->> 'name', ''),
    coalesce(new.email, '')
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();
