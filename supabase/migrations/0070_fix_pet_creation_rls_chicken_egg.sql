-- ============================================================================
-- 0070_fix_pet_creation_rls_chicken_egg.sql
-- Corrige bug que impedia QUALQUER tutor de cadastrar um pet (bloqueava toda
-- a jornada: sem pet não dá pra criar solicitação).
--
-- Causa raiz (RLS "ovo e galinha"): createPet() faz
--   1) insert into pets (...) select id  -- RETURNING exige pets_select
--   2) insert into pet_tutors (pet_id, tutor_profile_id)
-- Mas pets_select só permite ver o pet via is_tutor_of_pet(id), que consulta
-- pet_tutors — e esse vínculo só é criado no passo 2, DEPOIS do RETURNING do
-- passo 1. Um pet novo nunca tem pet_tutors ainda, então o RETURNING do
-- insert falha com "new row violates row-level security policy for table
-- pets" mesmo com o WITH CHECK de pets_insert satisfeito. O mesmo problema
-- existe em pet_tutors_insert (exige is_tutor_of_pet(pet_id), que é
-- exatamente a linha sendo inserida pela primeira vez).
--
-- Fix: usar pets.created_by (coluna que já existe e já é validada em
-- pets_insert) como caminho alternativo de autorização nos dois pontos —
-- mesmo padrão de "o criador sempre pode ver/vincular o que criou" já usado
-- noutras tabelas do projeto.
-- ============================================================================

drop policy if exists pets_select on public.pets;
create policy pets_select on public.pets
  for select using (
    public.is_tutor_of_pet(id)
    or created_by = auth.uid()
    or public.is_admin_or_supervisor()
    or exists (
      select 1 from public.request_pets rp
      join public.requests r on r.id = rp.request_id
      where rp.pet_id = pets.id and r.professional_id = auth.uid()
    )
  );

drop policy if exists pet_tutors_insert on public.pet_tutors;
create policy pet_tutors_insert on public.pet_tutors
  for insert with check (
    public.is_tutor_of_pet(pet_id)
    or exists (select 1 from public.pets p where p.id = pet_id and p.created_by = auth.uid())
  );
