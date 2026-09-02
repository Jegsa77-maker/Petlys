-- ============================================================================
-- 0035_seed_prontuario_requirements.sql
-- Pendência da Onda 1 ("catálogo administrável de requisitos por
-- categoria", seção 6.3/6.5) — semeia em platform_parameters os mesmos
-- requisitos que hoje viviam só como constante fixa no código
-- (lib/domain/category-requirements.ts, CATEGORY_REQUIRED_SECTIONS), pra
-- que o Admin veja o estado atual real ao abrir a matriz em
-- /admin/parametros, em vez de uma tela vazia. Reaproveita 100% a tabela e
-- o log de auditoria já existentes (0006_platform_parameters.sql) — nenhum
-- schema novo.
--
-- Se este banco não tiver nenhum administrador ainda, o insert abaixo não
-- grava nada (não há dono válido para atualizado_por) — nesse caso a
-- aplicação continua funcionando pelo fallback de código
-- (CATEGORY_REQUIRED_SECTIONS), até um Admin configurar a matriz na tela.
-- ============================================================================

insert into public.platform_parameters (chave1, chave2, chave3, valor1, explicacao, atualizado_por)
select 'requisitos_prontuario', req.category, req.section, 'obrigatorio',
  'Exige a seção "' || req.section_label || '" do prontuário do pet antes de solicitar ' || req.category_label || ' (semeado da configuração de fábrica em 2026-09-01).',
  admin.id
from (select p.id from public.profiles p join public.account_roles ar on ar.profile_id = p.id
      where ar.role = 'administrador' and ar.active limit 1) admin,
  (values
    ('pet_sitter', 'health', 'Saúde', 'Pet sitter / cuidador'),
    ('pet_sitter', 'routine', 'Rotina e cuidados', 'Pet sitter / cuidador'),
    ('pet_sitter', 'emergency', 'Emergência e autorizações', 'Pet sitter / cuidador'),
    ('passeador', 'behavior', 'Comportamento', 'Passeador de cães'),
    ('passeador', 'emergency', 'Emergência e autorizações', 'Passeador de cães'),
    ('hospedagem_creche', 'health', 'Saúde', 'Hospedagem / creche'),
    ('hospedagem_creche', 'routine', 'Rotina e cuidados', 'Hospedagem / creche'),
    ('hospedagem_creche', 'emergency', 'Emergência e autorizações', 'Hospedagem / creche'),
    ('adestrador', 'behavior', 'Comportamento', 'Adestrador / comportamentalista'),
    ('banho_tosa', 'health', 'Saúde', 'Banho e tosa'),
    ('veterinario_domiciliar', 'health', 'Saúde', 'Veterinário domiciliar')
  ) as req(category, section, section_label, category_label)
on conflict do nothing;
