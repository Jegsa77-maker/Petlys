-- ============================================================================
-- 0013_profiles_public_professional_select.sql
-- Corrige RLS: tutores não conseguiam ler o nome de profissionais com
-- serviço ativo (professional_services já era público, profiles não).
-- Sem isso, /buscar mostrava "Profissional" genérico e /profissional/[id]
-- retornava 404 pra qualquer tutor.
-- ============================================================================

create policy profiles_select_public_professional on public.profiles
  for select using (
    exists (
      select 1
      from public.professional_services ps
      where ps.professional_id = profiles.id
        and ps.active
    )
  );
