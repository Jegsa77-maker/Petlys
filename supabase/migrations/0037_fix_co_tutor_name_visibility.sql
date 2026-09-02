-- ============================================================================
-- 0037_fix_co_tutor_name_visibility.sql
-- Bug encontrado testando o convite de co-tutor (CHANGELOG 2026-09-02):
-- a lista "Tutores vinculados" só mostrava o próprio nome de quem estava
-- olhando — profiles_select (0009_rls_policies.sql) só libera leitura do
-- próprio perfil ou por Admin/Supervisor, sem exceção pra co-tutor.
--
-- Não ampliamos profiles_select: RLS filtra LINHA, não coluna — uma policy
-- "co-tutor pode ler o perfil do outro" liberaria a linha inteira via
-- PostgREST (email, telefone, cpf_cnpj...), não só full_name. Em vez
-- disso, uma função SECURITY DEFINER estreita, que só devolve
-- tutor_profile_id + full_name dos tutores de UM pet específico, e só
-- responde se quem chama já é tutor desse mesmo pet.
-- ============================================================================

create or replace function public.get_pet_co_tutor_names(p_pet_id uuid)
returns table (tutor_profile_id uuid, full_name text)
language plpgsql
security definer
set search_path = public
as $$
begin
  if not exists (
    select 1 from public.pet_tutors pt
    where pt.pet_id = p_pet_id and pt.tutor_profile_id = auth.uid()
  ) then
    return;
  end if;

  return query
    select pt.tutor_profile_id, p.full_name
    from public.pet_tutors pt
    join public.profiles p on p.id = pt.tutor_profile_id
    where pt.pet_id = p_pet_id;
end;
$$;

grant execute on function public.get_pet_co_tutor_names(uuid) to authenticated;
