-- ============================================================================
-- 0025_visita_inicial_config.sql
-- Onda 2, item 6 — visita inicial como jornada própria (seção 7.4 da
-- Especificação v2.0). O schema já previa parte disto desde
-- 0012_lifecycle_geo_notifications_storage.sql (requests.is_visita_inicial,
-- requests.origin_request_id) — o que faltava era o Profissional conseguir
-- configurar os termos (grátis/paga, duração, modalidade, se abate do
-- serviço final).
-- ============================================================================

alter table public.professional_profiles
  add column visita_inicial_enabled boolean not null default false,
  add column visita_inicial_price numeric(10, 2),
  add column visita_inicial_duration_minutes integer check (visita_inicial_duration_minutes is null or visita_inicial_duration_minutes > 0),
  add column visita_inicial_modality text check (visita_inicial_modality is null or visita_inicial_modality in ('presencial', 'online')),
  add column visita_inicial_deductible boolean not null default false;

comment on column public.professional_profiles.visita_inicial_price is 'Preço da visita inicial. Nulo = gratuita (padrão da seção 1.2 — a conversa básica sempre é gratuita; isto é além dela, um miniatendimento).';
comment on column public.professional_profiles.visita_inicial_deductible is 'Se o valor pago na visita inicial é abatido do atendimento principal quando ele nasce dela (requests.origin_request_id). Abatimento em si depende da integração de pagamento real (Onda 3) — aqui só registra a intenção do Profissional.';
