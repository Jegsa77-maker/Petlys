-- ============================================================================
-- 0026_recorrencia_avancada.sql
-- Onda 2, item 7 — recorrência avançada (seção 6.2/12.1). Persiste a
-- frequência escolhida (hoje só existia como valor transiente em
-- createRequest, usado pra calcular as datas iniciais e depois descartado)
-- — necessário pra permitir editar a recorrência dali pra frente sem
-- precisar perguntar de novo qual era a frequência original.
--
-- Reagendar uma ocorrência específica e editar a recorrência a partir de um
-- ponto não exigem tabela nova — são só updates em request_occurrences.
-- scheduled_at já existentes, com uma regra de aplicação (não mexe em
-- ocorrências já concluídas) reforçada no server action, não no banco.
-- ============================================================================

alter table public.requests
  add column recurrence_interval text check (recurrence_interval is null or recurrence_interval in ('diario', 'semanal', 'quinzenal', 'mensal'));

comment on column public.requests.recurrence_interval is 'Frequência do contrato recorrente (nulo se is_recurring = false). Persistido pra permitir editar a recorrência dali pra frente sem perder a informação original.';
