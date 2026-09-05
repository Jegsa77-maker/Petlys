-- Ajuste da Agenda (2026-09-05): profissional novo passa a nascer com os
-- 7 dias da semana marcados como disponível o dia inteiro (00:00-23:59) —
-- não é jornada de 24h, é só pra nenhuma reserva de tutor ficar bloqueada
-- até a pessoa configurar um horário de trabalho de verdade. Ver
-- lib/domain/availability-defaults.ts (usado a partir de agora em
-- chooseProfile/createUserByAdmin/addUserRole/setUserRoleActive).
--
-- Esta migration é só o backfill: todo profissional ATIVO que hoje não
-- tem nenhuma janela recorrente (weekday) ganha o mesmo padrão, uma vez,
-- pra não ficar sem nenhum horário reservável quando a restrição de
-- disponibilidade entrar na tela de solicitação do tutor.
insert into public.professional_availability (professional_id, weekday, start_time, end_time, blocked)
select ar.profile_id, weekday, '00:00', '23:59', false
from public.account_roles ar
cross join generate_series(0, 6) as weekday
where ar.role = 'profissional'
  and ar.active = true
  and not exists (
    select 1 from public.professional_availability pa
    where pa.professional_id = ar.profile_id and pa.weekday is not null
  );
