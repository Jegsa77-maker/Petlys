-- ============================================================================
-- 0008_rls_helper_functions.sql
-- Funções auxiliares usadas pelas políticas RLS. security definer + search_path
-- fixo evitam recursão infinita ao consultar account_roles dentro de policies.
-- ============================================================================

create or replace function public.has_role(target_role app_role)
returns boolean
language sql
security definer
stable
set search_path = public
as $$
  select exists (
    select 1 from public.account_roles
    where profile_id = auth.uid()
      and role = target_role
      and active
  );
$$;

create or replace function public.is_admin_or_supervisor()
returns boolean
language sql
security definer
stable
set search_path = public
as $$
  select public.has_role('administrador') or public.has_role('supervisor');
$$;

-- Verifica se o usuário logado é parte (tutor ou profissional) de uma solicitação.
create or replace function public.is_party_of_request(req_id uuid)
returns boolean
language sql
security definer
stable
set search_path = public
as $$
  select exists (
    select 1 from public.requests
    where id = req_id
      and (tutor_id = auth.uid() or professional_id = auth.uid())
  );
$$;

-- Verifica se o usuário logado é tutor vinculado a um pet.
create or replace function public.is_tutor_of_pet(pet_id_arg uuid)
returns boolean
language sql
security definer
stable
set search_path = public
as $$
  select exists (
    select 1 from public.pet_tutors
    where pet_id = pet_id_arg
      and tutor_profile_id = auth.uid()
  );
$$;
