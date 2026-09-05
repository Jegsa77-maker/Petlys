-- Perfis (2026-09-06): campos que o doc pede e não existiam —
-- formação/cursos (texto livre, diferente de "certificações" que já tem
-- upload+aprovação própria pra categoria regulamentada), rede social/site,
-- e nome profissional (diferente do nome da conta, ex. "Dra. Ana" em vez
-- do nome completo).
alter table public.professional_profiles
  add column formation text,
  add column social_url text,
  add column professional_name text;
