-- ============================================================================
-- 0073_narrow_public_professional_profile_read.sql
-- profiles_select_public_professional (0013) libera a LINHA INTEIRA de
-- profiles pra qualquer conta com professional_services ativo — RLS não
-- tem granularidade de coluna, então isso sempre expôs phone/cpf_cnpj/
-- birth_date/email junto, mesmo que só full_name fosse usado. Ficou
-- materialmente pior com 0012 (address_zip/lat/lng) ganhando um valor
-- real: um profissional com conta dupla (tutor + profissional no mesmo
-- profile) que preenche o endereço em /meu-perfil (ver
-- lib/actions/tutor-profile.ts) teria essa lat/lng residencial exposta
-- em /profissional/[id] pra qualquer visitante — mesmo bug de desenho já
-- corrigido pra co-tutor (0037) e pra outra parte de uma request (0056),
-- só que esse caminho de descoberta pública nunca tinha passado por
-- correção equivalente.
--
-- Mesmo padrão de get_pet_co_tutor_names (0037) e
-- get_request_other_party_name (0056): função SECURITY DEFINER estreita
-- que só devolve id + full_name, nunca a linha inteira. Essa aqui não é
-- escopada a uma request/pet específico — é o caminho de descoberta
-- pública (busca, perfil público, favoritos), então continua acessível
-- pra anon além de authenticated, igual a policy que substitui.
-- ============================================================================

drop policy profiles_select_public_professional on public.profiles;

create or replace function public.get_public_professional_names(p_professional_ids uuid[])
returns table (id uuid, full_name text)
language sql
security definer
stable
set search_path = public
as $$
  select p.id, p.full_name
  from public.profiles p
  where p.id = any(p_professional_ids)
    and exists (
      select 1 from public.professional_services ps
      where ps.professional_id = p.id and ps.active
    );
$$;

comment on function public.get_public_professional_names(uuid[]) is
  'Nome público de profissionais com serviço ativo, pra busca/perfil/favoritos — nunca a linha inteira de profiles (sem endereço/CPF/telefone/e-mail). Substitui profiles_select_public_professional (0013), removida nesta migration.';

revoke execute on function public.get_public_professional_names(uuid[]) from public;
grant execute on function public.get_public_professional_names(uuid[]) to anon, authenticated;
