-- Agenda: ajustes pedidos depois de o profissional usar o calendário
-- mensal (2026-09-05) — "Bloqueios e folgas" só permitia marcar o dia
-- inteiro; precisa permitir horário específico também, e distinguir
-- bloqueio/folga/compromisso (cores diferentes na lista da Agenda).
--
-- Não precisa de coluna nova pra horário específico: start_time/end_time
-- já existem na tabela (hoje só usadas pelas janelas recorrentes de
-- weekday) e não têm nenhuma constraint que impeça de usá-las também
-- numa linha de date_override — só o código (lib/actions/services.ts)
-- sempre gravava null ali pra blockDate.
alter table public.professional_availability
  add column block_type text check (block_type in ('bloqueio', 'folga', 'compromisso'));

update public.professional_availability
  set block_type = 'bloqueio'
  where date_override is not null and block_type is null;

alter table public.professional_availability
  add constraint professional_availability_block_type_required
  check (date_override is null or block_type is not null);
