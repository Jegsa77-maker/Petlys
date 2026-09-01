-- ============================================================================
-- 0014_recurring_occurrence_cycle.sql
-- A máquina de estados de `requests` só previa um ciclo confirmado -> ... ->
-- concluido -> avaliacao. Em contratos recorrentes (occurrences_total > 1),
-- depois de concluir a 1ª ocorrência era impossível fazer check-in da 2ª:
-- não existia transição de volta pra 'confirmado'. Isso libera o ciclo se
-- ainda houver ocorrências pendentes (ver syncRequestStatus em
-- lib/actions/occurrences.ts, que decide 'confirmado' vs 'avaliacao'
-- conforme for a última ocorrência do contrato ou não).
-- ============================================================================

insert into public.request_status_transitions_allowed (from_status, to_status) values
  ('concluido', 'confirmado');
