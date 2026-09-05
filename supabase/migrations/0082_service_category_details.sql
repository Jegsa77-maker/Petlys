-- Campos específicos por categoria no Serviço publicado (2026-09-06) —
-- hospedagem, pet sitter, passeador, adestrador e veterinário têm campos
-- diferentes entre si (capacidade, horário de entrada/saída, tamanho de
-- grupo, especialidade etc.). jsonb livre, mesmo padrão já usado pra
-- saúde/comportamento/rotina/emergência do pet (pets.health_info e
-- irmãos) — os campos válidos por categoria ficam no código
-- (lib/domain/service-category-fields.ts), não no schema do banco.
alter table public.professional_services add column category_details jsonb not null default '{}';
