-- Conversa prévia (chat antes de solicitar) precisa mostrar quem é a outra
-- parte no cabeçalho do chat (a tela nunca precisou disso até agora, porque
-- pets/categoria já deixavam claro quem era quem). profiles_select normal
-- não libera isso pro Profissional ler o nome do Tutor (só existe policy
-- pública pra profissional com serviço ativo, e admin/supervisor) — mesmo
-- padrão de get_pet_co_tutor_names (0037): função estreita que só devolve
-- nome/avatar, nunca a linha inteira de profiles.

create or replace function public.get_request_other_party_name(p_request_id uuid)
returns table(full_name text, avatar_url text)
language sql
security definer
stable
set search_path = public
as $$
  select p.full_name, pp.avatar_url
  from public.requests r
  join public.profiles p on p.id = case
    when r.tutor_id = auth.uid() then r.professional_id
    when r.professional_id = auth.uid() then r.tutor_id
    else null
  end
  left join public.professional_profiles pp on pp.profile_id = p.id
  where r.id = p_request_id
    and (r.tutor_id = auth.uid() or r.professional_id = auth.uid());
$$;

comment on function public.get_request_other_party_name(uuid) is
  'Nome/avatar da outra parte de uma request específica, pro cabeçalho do
   chat — nunca a linha inteira de profiles (sem e-mail/telefone/CPF), e só
   responde se o chamador é mesmo parte dessa request.';

revoke execute on function public.get_request_other_party_name(uuid) from anon;
