-- Perfis (2026-09-06, revisão contra o doc "Petlys | Perfis - Pilar 1"):
-- pet ganha "castrado" (identificação, já cobre saúde/comportamento/rotina/
-- emergência — só faltava esse campo); Tutor ganha foto de perfil (o doc
-- pede explicitamente, e hoje só o Profissional tem avatar).
alter table public.pets add column neutered boolean;

alter table public.profiles add column avatar_url text;
