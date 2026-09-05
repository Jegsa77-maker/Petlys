-- Campos de acesso ao imóvel na solicitação (2026-09-06, doc "Petlys |
-- Perfis - Pilar 1", seção 6: chave e "quem estará no imóvel" pertencem à
-- solicitação, não ao perfil — cada contratação pode ter uma combinação
-- diferente). Todos opcionais, mesmo espírito de `address`/`notes`.
alter table public.requests
  add column has_key boolean,
  add column key_delivery_method text,
  add column other_person_present text,
  add column has_cameras boolean;
