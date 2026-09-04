-- Área de atendimento do profissional era só schema/RLS desde a fundação
-- (0012) — nenhuma Server Action ou tela jamais escreveu nela; os 2
-- registros de teste que já existiam vieram de insert direto via SQL. Esta
-- migration prepara o schema pro primeiro fluxo real de escrita:
--
--   - `radius_km` passa a aceitar null = "sem restrição de distância" (o
--     usuário pediu explicitamente essa opção "em branco"). Antes era
--     `not null default 10`, sem essa possibilidade.
--   - `center_zip` (novo): guarda o CEP que o profissional digitou, pra
--     reexibir no formulário depois — center_lat/lng sozinhos não dão pra
--     voltar pro CEP original.
--   - Único registro por profissional (unique em `professional_id`): o
--     pedido é "a área de atendimento dela" no singular, então o fluxo novo
--     faz upsert por professional_id em vez de permitir múltiplas áreas
--     (nenhum dado existente tinha mais de uma linha por profissional).
alter table public.professional_service_areas
  alter column radius_km drop not null,
  add column center_zip text;

comment on column public.professional_service_areas.radius_km is
  'Raio de atendimento em km a partir de center_lat/lng. NULL = sem restrição de distância (atende em qualquer lugar).';

alter table public.professional_service_areas
  add constraint professional_service_areas_professional_unique unique (professional_id);
