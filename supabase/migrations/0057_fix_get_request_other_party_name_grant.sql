-- Mesmo achado de 20260903 (Onda 3): grant vai pra PUBLIC, não direto pra
-- anon/authenticated — revoke de anon sozinho não basta.
revoke execute on function public.get_request_other_party_name(uuid) from public;
grant execute on function public.get_request_other_party_name(uuid) to authenticated;
