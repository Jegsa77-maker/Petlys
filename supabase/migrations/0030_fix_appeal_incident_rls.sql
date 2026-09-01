-- ============================================================================
-- 0030_fix_appeal_incident_rls.sql
-- BUG encontrado testando o item 3 da Onda 4 (disputas e apelação): a
-- policy incidents_update (0009_rls_policies.sql) só permite
-- is_admin_or_supervisor() — a própria parte da solicitação (Tutor ou
-- Profissional) NUNCA conseguia apelar de um incidente resolvido. O
-- update() da apelação "funcionava" sem erro (RLS filtra linhas, não
-- lança exceção — mesma armadilha do bug de accept em proposals já
-- corrigido nesta sessão), só que afetava 0 linhas, silenciosamente.
--
-- Corrigido com função SECURITY DEFINER em vez de nova policy de UPDATE
-- pra evitar reabrir o mesmo tipo de brecha de tampering de coluna: se a
-- policy nova liberasse UPDATE de linha pra quem é parte, ela liberaria
-- TODAS as colunas da linha (RLS não filtra coluna), não só
-- status/appealed_at/appeal_reason.
-- ============================================================================

create or replace function public.appeal_incident(p_incident_id uuid, p_reason text)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_request_id uuid;
  v_tutor_id uuid;
  v_professional_id uuid;
  v_status incident_status;
begin
  select i.request_id, i.status, r.tutor_id, r.professional_id
    into v_request_id, v_status, v_tutor_id, v_professional_id
  from public.incidents i
  join public.requests r on r.id = i.request_id
  where i.id = p_incident_id;

  if v_request_id is null then
    raise exception 'Incidente não encontrado';
  end if;

  if auth.uid() <> v_tutor_id and auth.uid() <> v_professional_id then
    raise exception 'Você não tem permissão pra apelar desse incidente';
  end if;

  if v_status <> 'resolvido' then
    raise exception 'Só dá pra apelar de um incidente já resolvido';
  end if;

  update public.incidents
    set status = 'escalado', appealed_at = now(), appeal_reason = p_reason
    where id = p_incident_id;

  -- Melhor esforço: nem todo status de origem tem transição permitida
  -- pra em_disputa (ex.: uma apelação enquanto o atendimento ainda está
  -- em andamento) — a apelação do incidente em si nunca deve falhar por
  -- causa disso, só o reflexo visual na solicitação é opcional.
  begin
    update public.requests set status = 'em_disputa' where id = v_request_id;
  exception when others then
    null;
  end;
end;
$$;

grant execute on function public.appeal_incident(uuid, text) to authenticated;
