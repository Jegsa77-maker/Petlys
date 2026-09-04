-- Dashboard de KPIs do Admin — funil de contratação. Calculado POR COORTE
-- de entrada (regra explícita da especificação externa): a base é sempre
-- "solicitações criadas no período", e cada passo seguinte conta quantas
-- DESSAS MESMAS solicitações avançaram — nunca eventos soltos de outro
-- período sem vínculo com a solicitação original.
create or replace function public.admin_kpi_funnel(
  p_from date, p_to date, p_category public.service_category default null, p_uf text default null
)
returns jsonb
language plpgsql
security definer
stable
set search_path = public
as $$
declare
  v_result jsonb;
begin
  if not public.is_admin_or_supervisor() then
    raise exception 'Apenas Admin ou Supervisor podem ver o dashboard de KPIs';
  end if;

  with cohort as (
    select r.id from public.requests r
    join public.profiles t on t.id = r.tutor_id
    where r.created_at::date between p_from and p_to
      and (p_category is null or r.category = p_category)
      and (p_uf is null or public.cep_to_uf(t.address_zip) = p_uf)
      and not r.is_conversa_previa
  ),
  passos as (
    select
      count(*) as solicitacoes,
      count(*) filter (where exists (select 1 from public.proposals p where p.request_id = cohort.id)) as com_proposta,
      count(*) filter (where exists (
        select 1 from public.proposals p where p.request_id = cohort.id and p.accepted_at is not null
      )) as aceitas,
      count(*) filter (where exists (
        select 1 from public.payments pay where pay.request_id = cohort.id and pay.status = 'pago'
      )) as pagas,
      count(*) filter (where exists (
        select 1 from public.request_occurrences o where o.request_id = cohort.id and o.completed_at is not null
      )) as concluidas
    from cohort
  ),
  -- KPIs "C": ainda sem instrumentação escrevendo em analytics_events
  -- (próxima etapa) — a RPC já fica pronta, só retorna 0/null até lá.
  eventos_funil as (
    select
      count(*) filter (where event_name = 'search_result_view') as buscas,
      count(*) filter (where event_name = 'professional_profile_view') as perfis,
      count(*) filter (where event_name = 'request_started') as inicios
    from public.analytics_events
    where created_at::date between p_from and p_to
      and (p_category is null or category = p_category)
      and (p_uf is null or uf = p_uf)
  )
  select jsonb_build_object(
    'coorte', jsonb_build_object(
      'solicitacoes', p.solicitacoes,
      'com_proposta', p.com_proposta,
      'aceitas', p.aceitas,
      'pagas', p.pagas,
      'concluidas', p.concluidas
    ),
    'taxas', jsonb_build_object(
      'solicitacao_proposta_pct', case when p.solicitacoes = 0 then null else round(p.com_proposta::numeric / p.solicitacoes * 100, 1) end,
      'proposta_aceite_pct', case when p.com_proposta = 0 then null else round(p.aceitas::numeric / p.com_proposta * 100, 1) end,
      'aceite_pagamento_pct', case when p.aceitas = 0 then null else round(p.pagas::numeric / p.aceitas * 100, 1) end,
      'pagamento_conclusao_pct', case when p.pagas = 0 then null else round(p.concluidas::numeric / p.pagas * 100, 1) end,
      'conversao_total_pct', case when p.solicitacoes = 0 then null else round(p.concluidas::numeric / p.solicitacoes * 100, 1) end
    ),
    'aquisicao', jsonb_build_object(
      'busca_perfil_pct', case when e.buscas = 0 then null else round(e.perfis::numeric / e.buscas * 100, 1) end,
      'perfil_solicitacao_pct', case when e.perfis = 0 then null else round(e.inicios::numeric / e.perfis * 100, 1) end,
      'buscas', e.buscas, 'perfis', e.perfis, 'inicios_solicitacao', e.inicios
    )
  ) into v_result
  from passos p, eventos_funil e;

  return v_result;
end;
$$;

revoke execute on function public.admin_kpi_funnel(date, date, public.service_category, text) from public, anon, authenticated;
grant execute on function public.admin_kpi_funnel(date, date, public.service_category, text) to authenticated;
