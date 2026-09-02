-- ============================================================================
-- 0036_pet_co_tutor_invites.sql
-- Pendência da Onda 1 (seção 6.2/2.2) — hoje `inviteCoTutorByEmail` só
-- funciona se a outra pessoa já tem conta na Petlys. Este convite formal
-- cobre quem ainda não tem: usa o e-mail de convite nativo do Supabase
-- Auth (admin.inviteUserByEmail, sem provedor de e-mail novo) e uma
-- SECURITY DEFINER function pra vincular automaticamente assim que a
-- pessoa convidada terminar o cadastro normal (telefone, termos, papel).
-- ============================================================================

create table public.pet_co_tutor_invites (
  id uuid primary key default gen_random_uuid(),
  pet_id uuid not null references public.pets (id) on delete cascade,
  invited_email text not null,
  invited_by uuid not null references public.profiles (id),
  status text not null default 'pendente' check (status in ('pendente', 'aceito', 'cancelado')),
  created_at timestamptz not null default now(),
  accepted_at timestamptz
);

comment on table public.pet_co_tutor_invites is 'Convite de co-tutor pra quem ainda não tem conta na Petlys (seção 6.2/2.2) — aceito automaticamente via accept_pending_pet_co_tutor_invites() quando a pessoa convidada completa o cadastro com o mesmo e-mail.';

create index pet_co_tutor_invites_email_idx on public.pet_co_tutor_invites (invited_email) where status = 'pendente';
create index pet_co_tutor_invites_pet_idx on public.pet_co_tutor_invites (pet_id);

alter table public.pet_co_tutor_invites enable row level security;

-- Só quem já é tutor do pet vê/cria/cancela convites dele — igual ao
-- padrão já usado pra pet_tutors (é.g. RLS de pets/pet_tutors).
create policy pet_co_tutor_invites_select on public.pet_co_tutor_invites
  for select using (
    exists (select 1 from public.pet_tutors pt where pt.pet_id = pet_co_tutor_invites.pet_id and pt.tutor_profile_id = auth.uid())
    or public.has_role('administrador') or public.has_role('supervisor')
  );

create policy pet_co_tutor_invites_insert on public.pet_co_tutor_invites
  for insert with check (
    invited_by = auth.uid()
    and exists (select 1 from public.pet_tutors pt where pt.pet_id = pet_co_tutor_invites.pet_id and pt.tutor_profile_id = auth.uid())
  );

-- Cancelar (soft, via status) só quem convidou, e só enquanto pendente.
create policy pet_co_tutor_invites_update_cancel on public.pet_co_tutor_invites
  for update using (invited_by = auth.uid() and status = 'pendente')
  with check (status = 'cancelado');

-- ----------------------------------------------------------------------------
-- accept_pending_pet_co_tutor_invites — SECURITY DEFINER de propósito: quem
-- aceita um convite ainda NÃO é tutor do pet (não tem standing nenhum pra
-- passar numa policy normal de pet_tutors_insert), e o único dado confiável
-- pra decidir é o e-mail já verificado em auth.users do próprio chamador
-- (auth.uid()), nunca um valor vindo do cliente. Mesmo padrão de
-- appeal_incident() (0030_fix_appeal_incident_rls.sql).
-- ----------------------------------------------------------------------------
create or replace function public.accept_pending_pet_co_tutor_invites()
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  my_email text;
  accepted_count integer := 0;
  inv record;
begin
  select email into my_email from auth.users where id = auth.uid();
  if my_email is null then
    return 0;
  end if;

  for inv in
    select * from public.pet_co_tutor_invites
    where invited_email = my_email and status = 'pendente'
  loop
    insert into public.pet_tutors (pet_id, tutor_profile_id)
    values (inv.pet_id, auth.uid())
    on conflict do nothing;

    update public.pet_co_tutor_invites
    set status = 'aceito', accepted_at = now()
    where id = inv.id;

    accepted_count := accepted_count + 1;
  end loop;

  return accepted_count;
end;
$$;

grant execute on function public.accept_pending_pet_co_tutor_invites() to authenticated;
