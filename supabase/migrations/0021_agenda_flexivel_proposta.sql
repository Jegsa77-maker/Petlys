-- ============================================================================
-- 0021_agenda_flexivel_proposta.sql
-- Onda 2 — agenda flexível: o horário passa a ser negociável dentro da
-- proposta formal, igual preço já é. O Tutor sugere um horário ao criar a
-- solicitação (já existia); o Profissional pode mantê-lo, propor um
-- horário exato diferente, ou propor um período (manhã/tarde/noite) sem
-- cravar hora — nunca é bloqueado por conflito de agenda, só alertado
-- (seção 1.2/5, item 4 da Especificação v2.0: "a plataforma organiza e
-- recomenda, mas não impõe agenda").
-- ============================================================================

alter table public.proposals
  add column proposed_scheduled_at timestamptz,
  add column proposed_period text check (proposed_period is null or proposed_period in ('manha', 'tarde', 'noite'));

alter table public.proposals
  add constraint proposals_schedule_single_choice
  check (proposed_scheduled_at is null or proposed_period is null);

comment on column public.proposals.proposed_scheduled_at is 'Horário exato proposto pelo Profissional, se diferente do que o Tutor pediu. Ao aceitar a proposta, todas as ocorrências do contrato são deslocadas pela mesma diferença (preserva o espaçamento da recorrência).';
comment on column public.proposals.proposed_period is 'Período do dia proposto pelo Profissional quando ele não quer cravar hora exata ainda (manha/tarde/noite) — informativo, não altera o horário agendado; o horário exato se resolve depois pelo chat, sem travar ninguém.';
