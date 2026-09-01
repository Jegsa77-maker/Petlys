-- ============================================================================
-- 0029_disputas_apelacao.sql
-- Onda 4, item 3 — disputas e apelação (seção 3, "Em disputa": pagamento,
-- qualidade ou responsabilidade sob análise administrativa). `em_disputa`
-- e `incidente` já existiam como request_status, e as transições
-- confirmado/checkin/em_andamento/finalizacao -> incidente -> em_disputa
-- já estavam na tabela de transições — só nunca eram usadas na prática,
-- e faltava um jeito da própria parte apelar de uma resolução.
--
-- Qualidade só dá pra contestar DEPOIS do atendimento — 'concluido' e
-- 'avaliacao' não tinham saída pra 'em_disputa' na tabela original
-- (gap, não restrição intencional).
-- ============================================================================

insert into public.request_status_transitions_allowed (from_status, to_status) values
  ('concluido', 'em_disputa'),
  ('avaliacao', 'em_disputa');

alter table public.incidents
  add column appealed_at timestamptz,
  add column appeal_reason text;

comment on column public.incidents.appealed_at is 'Preenchido quando uma das partes pede revisão de um incidente já resolvido (apelação) — reabre pro Administrador (status volta a escalado).';
