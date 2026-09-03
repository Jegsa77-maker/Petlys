-- Onda 3 (fundação sem gateway) — Etapa 4: gap real na máquina de estados encontrado
-- na exploração. Sem isso, cancelar ou reportar no-show com o atendimento já em
-- andamento/finalização quebra na trigger enforce_and_log_status_transition().

insert into public.request_status_transitions_allowed (from_status, to_status) values
  ('em_andamento', 'cancelado'),
  ('finalizacao', 'cancelado')
on conflict do nothing;
