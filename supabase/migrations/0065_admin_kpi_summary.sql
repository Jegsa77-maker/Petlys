-- Dashboard de KPIs do Admin — RPC de resumo (visão executiva + crescimento
-- + oferta/demanda + qualidade). Um payload jsonb só, em vez de uma query
-- por KPI (recomendação da própria especificação externa, seção 6).
--
-- Convenção de delta: todo KPI numérico vem como {"valor":N,"delta_pct":X}
-- comparado com o período anterior de mesmo tamanho (é o que "crescimento
-- da base ativa" usa também — não precisa de uma janela fixa separada).
create or replace function public.admin_kpi_delta(p_current numeric, p_previous numeric)
returns jsonb
language sql
immutable
set search_path = public
as $$
  select jsonb_build_object(
    'valor', p_current,
    'delta_pct', case when p_previous is null or p_previous = 0 then null
                      else round(((p_current - p_previous) / p_previous) * 100, 1) end
  );
$$;

create or replace function public.admin_kpi_summary(
  p_from date, p_to date, p_category public.service_category default null, p_uf text default null
)
returns jsonb
language plpgsql
security definer
stable
set search_path = public
as $$
declare
  v_prev_to date := p_from - 1;
  v_prev_from date := p_from - (p_to - p_from + 1);
  v_result jsonb;
begin
  if not public.is_admin_or_supervisor() then
    raise exception 'Apenas Admin ou Supervisor podem ver o dashboard de KPIs';
  end if;

  with
  -- Tutor ativo (regra fechada com o usuário): criou solicitação OU
  -- enviou mensagem no período. category/uf filtram pelo lado do tutor.
  tutores_ativos_cur as (
    select count(distinct t) as n from (
      select r.tutor_id as t from public.requests r
      where r.created_at::date between p_from and p_to
        and (p_category is null or r.category = p_category)
        and (p_uf is null or public.cep_to_uf((select address_zip from public.profiles where id = r.tutor_id)) = p_uf)
      union
      select r.tutor_id as t from public.messages m join public.requests r on r.id = m.request_id
      where m.created_at::date between p_from and p_to and m.sender_id = r.tutor_id
        and (p_category is null or r.category = p_category)
        and (p_uf is null or public.cep_to_uf((select address_zip from public.profiles where id = r.tutor_id)) = p_uf)
    ) x
  ),
  tutores_ativos_prev as (
    select count(distinct t) as n from (
      select r.tutor_id as t from public.requests r
      where r.created_at::date between v_prev_from and v_prev_to
        and (p_category is null or r.category = p_category)
        and (p_uf is null or public.cep_to_uf((select address_zip from public.profiles where id = r.tutor_id)) = p_uf)
      union
      select r.tutor_id as t from public.messages m join public.requests r on r.id = m.request_id
      where m.created_at::date between v_prev_from and v_prev_to and m.sender_id = r.tutor_id
        and (p_category is null or r.category = p_category)
        and (p_uf is null or public.cep_to_uf((select address_zip from public.profiles where id = r.tutor_id)) = p_uf)
    ) x
  ),
  profissionais_ativos_cur as (
    select count(distinct ps.professional_id) as n
    from public.professional_services ps
    join public.account_roles ar on ar.profile_id = ps.professional_id and ar.role = 'profissional' and ar.active
    join public.profiles pr on pr.id = ps.professional_id
    where ps.active
      and (p_category is null or ps.category = p_category)
      and (p_uf is null or public.cep_to_uf(pr.address_zip) = p_uf)
      and exists (
        select 1 from public.requests r where r.professional_id = ps.professional_id
          and r.created_at::date between p_from and p_to
      )
  ),
  profissionais_ativos_prev as (
    select count(distinct ps.professional_id) as n
    from public.professional_services ps
    join public.account_roles ar on ar.profile_id = ps.professional_id and ar.role = 'profissional' and ar.active
    join public.profiles pr on pr.id = ps.professional_id
    where ps.active
      and (p_category is null or ps.category = p_category)
      and (p_uf is null or public.cep_to_uf(pr.address_zip) = p_uf)
      and exists (
        select 1 from public.requests r where r.professional_id = ps.professional_id
          and r.created_at::date between v_prev_from and v_prev_to
      )
  ),
  base_requests_cur as (
    select r.* from public.requests r
    join public.profiles t on t.id = r.tutor_id
    where r.created_at::date between p_from and p_to
      and (p_category is null or r.category = p_category)
      and (p_uf is null or public.cep_to_uf(t.address_zip) = p_uf)
  ),
  base_requests_prev as (
    select r.* from public.requests r
    join public.profiles t on t.id = r.tutor_id
    where r.created_at::date between v_prev_from and v_prev_to
      and (p_category is null or r.category = p_category)
      and (p_uf is null or public.cep_to_uf(t.address_zip) = p_uf)
  ),
  confirmados_cur as (
    select count(*) as n from public.request_status_history h
    join public.requests r on r.id = h.request_id
    join public.profiles t on t.id = r.tutor_id
    where h.to_status = 'confirmado' and h.created_at::date between p_from and p_to
      and (p_category is null or r.category = p_category)
      and (p_uf is null or public.cep_to_uf(t.address_zip) = p_uf)
  ),
  confirmados_prev as (
    select count(*) as n from public.request_status_history h
    join public.requests r on r.id = h.request_id
    join public.profiles t on t.id = r.tutor_id
    where h.to_status = 'confirmado' and h.created_at::date between v_prev_from and v_prev_to
      and (p_category is null or r.category = p_category)
      and (p_uf is null or public.cep_to_uf(t.address_zip) = p_uf)
  ),
  concluidos_cur as (
    select count(*) as n from public.request_occurrences o
    join public.requests r on r.id = o.request_id
    join public.profiles t on t.id = r.tutor_id
    where o.completed_at is not null and o.completed_at::date between p_from and p_to
      and (p_category is null or r.category = p_category)
      and (p_uf is null or public.cep_to_uf(t.address_zip) = p_uf)
  ),
  concluidos_prev as (
    select count(*) as n from public.request_occurrences o
    join public.requests r on r.id = o.request_id
    join public.profiles t on t.id = r.tutor_id
    where o.completed_at is not null and o.completed_at::date between v_prev_from and v_prev_to
      and (p_category is null or r.category = p_category)
      and (p_uf is null or public.cep_to_uf(t.address_zip) = p_uf)
  ),
  pagamentos_cur as (
    select coalesce(sum(p.amount), 0) as gmv, coalesce(sum(p.commission_amount), 0) as receita, count(*) as qtd
    from public.payments p
    join public.requests r on r.id = p.request_id
    join public.profiles t on t.id = r.tutor_id
    where p.status = 'pago' and p.paid_at::date between p_from and p_to
      and (p_category is null or r.category = p_category)
      and (p_uf is null or public.cep_to_uf(t.address_zip) = p_uf)
  ),
  pagamentos_prev as (
    select coalesce(sum(p.amount), 0) as gmv, coalesce(sum(p.commission_amount), 0) as receita, count(*) as qtd
    from public.payments p
    join public.requests r on r.id = p.request_id
    join public.profiles t on t.id = r.tutor_id
    where p.status = 'pago' and p.paid_at::date between v_prev_from and v_prev_to
      and (p_category is null or r.category = p_category)
      and (p_uf is null or public.cep_to_uf(t.address_zip) = p_uf)
  ),
  -- Crescimento
  novos_tutores_cur as (
    select count(*) as n from public.account_roles ar
    join public.profiles p on p.id = ar.profile_id
    where ar.role = 'tutor' and ar.created_at::date between p_from and p_to
      and (p_uf is null or public.cep_to_uf(p.address_zip) = p_uf)
  ),
  novos_tutores_prev as (
    select count(*) as n from public.account_roles ar
    join public.profiles p on p.id = ar.profile_id
    where ar.role = 'tutor' and ar.created_at::date between v_prev_from and v_prev_to
      and (p_uf is null or public.cep_to_uf(p.address_zip) = p_uf)
  ),
  novos_prof_cadastrados_cur as (
    select count(*) as n from public.account_roles ar
    join public.profiles p on p.id = ar.profile_id
    where ar.role = 'profissional' and ar.created_at::date between p_from and p_to
      and (p_uf is null or public.cep_to_uf(p.address_zip) = p_uf)
  ),
  novos_prof_cadastrados_prev as (
    select count(*) as n from public.account_roles ar
    join public.profiles p on p.id = ar.profile_id
    where ar.role = 'profissional' and ar.created_at::date between v_prev_from and v_prev_to
      and (p_uf is null or public.cep_to_uf(p.address_zip) = p_uf)
  ),
  novos_prof_aprovados_cur as (
    select count(*) as n from public.professional_certifications c
    join public.profiles p on p.id = c.professional_id
    where c.status = 'aprovado' and c.reviewed_at::date between p_from and p_to
      and (p_category is null or c.category = p_category)
      and (p_uf is null or public.cep_to_uf(p.address_zip) = p_uf)
  ),
  novos_prof_reprovados_cur as (
    select count(*) as n from public.professional_certifications c
    join public.profiles p on p.id = c.professional_id
    where c.status = 'reprovado' and c.reviewed_at::date between p_from and p_to
      and (p_category is null or c.category = p_category)
      and (p_uf is null or public.cep_to_uf(p.address_zip) = p_uf)
  ),
  cobertura_cur as (
    select count(distinct uf) as n from (
      select public.cep_to_uf(t.address_zip) as uf
      from public.requests r join public.profiles t on t.id = r.tutor_id
      where r.created_at::date between p_from and p_to
        and (p_category is null or r.category = p_category)
      intersect
      select public.cep_to_uf(pr.address_zip) as uf
      from public.professional_services ps join public.profiles pr on pr.id = ps.professional_id
      where ps.active and (p_category is null or ps.category = p_category)
    ) x where uf is not null
  ),
  -- Oferta e demanda
  oferta_cur as (
    select count(distinct ps.professional_id) as n
    from public.professional_services ps
    join public.profiles pr on pr.id = ps.professional_id
    where ps.active
      and (p_category is null or ps.category = p_category)
      and (p_uf is null or public.cep_to_uf(pr.address_zip) = p_uf)
  ),
  sem_proposta_cur as (
    select count(*) as n from base_requests_cur r
    where not exists (select 1 from public.proposals pp where pp.request_id = r.id)
  ),
  tempo_resposta_cur as (
    select percentile_cont(0.5) within group (order by extract(epoch from (m.first_msg - r.created_at)) / 3600) as horas
    from base_requests_cur r
    join lateral (
      select min(created_at) as first_msg from public.messages
      where request_id = r.id and sender_id = r.professional_id
    ) m on true
    where m.first_msg is not null
  ),
  tempo_proposta_cur as (
    select percentile_cont(0.5) within group (order by extract(epoch from (pp.created_at - r.created_at)) / 3600) as horas
    from base_requests_cur r
    join lateral (
      select min(created_at) as created_at from public.proposals where request_id = r.id
    ) pp on true
    where pp.created_at is not null
  ),
  demanda_atendida_cur as (
    select
      count(*) filter (where exists (select 1 from public.proposals pp where pp.request_id = r.id)) as com_proposta,
      count(*) as total
    from base_requests_cur r
  ),
  -- Qualidade e segurança
  nota_media_cur as (
    select avg(v.rating) as media from (
      select (jsonb_each_text(rv.rating)).value::numeric as rating
      from public.reviews rv
      join public.requests r on r.id = rv.request_id
      join public.profiles t on t.id = r.tutor_id
      where rv.hidden_at is null and rv.created_at::date between p_from and p_to
        and (p_category is null or r.category = p_category)
        and (p_uf is null or public.cep_to_uf(t.address_zip) = p_uf)
    ) v
  ),
  cancelamento_tutor_cur as (
    select count(*) as n from public.request_status_history h
    join public.requests r on r.id = h.request_id
    join public.profiles t on t.id = r.tutor_id
    where h.to_status = 'cancelado' and h.changed_by = r.tutor_id
      and h.created_at::date between p_from and p_to
      and (p_category is null or r.category = p_category)
      and (p_uf is null or public.cep_to_uf(t.address_zip) = p_uf)
  ),
  cancelamento_prof_cur as (
    select count(*) as n from public.professional_cancellations c
    join public.requests r on r.id = c.request_id
    join public.profiles t on t.id = r.tutor_id
    where c.created_at::date between p_from and p_to
      and (p_category is null or r.category = p_category)
      and (p_uf is null or public.cep_to_uf(t.address_zip) = p_uf)
  ),
  incidentes_abertos_cur as (
    select count(*) as n from public.incidents i
    join public.requests r on r.id = i.request_id
    join public.profiles t on t.id = r.tutor_id
    where i.status in ('aberto', 'em_analise', 'escalado') and i.created_at::date between p_from and p_to
      and (p_category is null or r.category = p_category)
      and (p_uf is null or public.cep_to_uf(t.address_zip) = p_uf)
  ),
  incidentes_resolvidos_cur as (
    select count(*) as n, percentile_cont(0.5) within group (
      order by extract(epoch from (i.resolved_at - i.created_at)) / 3600
    ) as horas
    from public.incidents i
    join public.requests r on r.id = i.request_id
    join public.profiles t on t.id = r.tutor_id
    where i.status = 'resolvido' and i.resolved_at::date between p_from and p_to
      and (p_category is null or r.category = p_category)
      and (p_uf is null or public.cep_to_uf(t.address_zip) = p_uf)
  ),
  no_show_cur as (
    select
      count(*) filter (where ns.reported_party = 'tutor') as tutor,
      count(*) filter (where ns.reported_party = 'profissional') as profissional
    from public.no_show_records ns
    join public.requests r on r.id = ns.request_id
    join public.profiles t on t.id = r.tutor_id
    where ns.created_at::date between p_from and p_to
      and (p_category is null or r.category = p_category)
      and (p_uf is null or public.cep_to_uf(t.address_zip) = p_uf)
  ),
  -- Recorrência (30 dias, decisão do usuário): tutor com >=2 requests
  -- concluídas cuja diferença entre conclusões consecutivas é <=30 dias,
  -- olhando só quem concluiu algo no período selecionado.
  tutor_conclusoes as (
    select r.tutor_id, o.completed_at,
      lag(o.completed_at) over (partition by r.tutor_id order by o.completed_at) as anterior
    from public.request_occurrences o
    join public.requests r on r.id = o.request_id
    join public.profiles t on t.id = r.tutor_id
    where o.completed_at is not null
      and (p_category is null or r.category = p_category)
      and (p_uf is null or public.cep_to_uf(t.address_zip) = p_uf)
  ),
  recorrencia_cur as (
    select
      count(distinct tutor_id) filter (
        where completed_at::date between p_from and p_to
          and anterior is not null and completed_at - anterior <= interval '30 days'
      ) as recorrentes,
      count(distinct tutor_id) filter (where completed_at::date between p_from and p_to) as base
    from tutor_conclusoes
  ),
  prof_conclusoes as (
    select r.professional_id, o.completed_at,
      lag(o.completed_at) over (partition by r.professional_id order by o.completed_at) as anterior
    from public.request_occurrences o
    join public.requests r on r.id = o.request_id
    join public.profiles pr on pr.id = r.professional_id
    where o.completed_at is not null
      and (p_category is null or r.category = p_category)
      and (p_uf is null or public.cep_to_uf(pr.address_zip) = p_uf)
  ),
  retencao_cur as (
    select
      count(distinct professional_id) filter (
        where completed_at::date between p_from and p_to
          and anterior is not null and completed_at - anterior <= interval '30 days'
      ) as retidos,
      count(distinct professional_id) filter (where completed_at::date between p_from and p_to) as base
    from prof_conclusoes
  )
  select jsonb_build_object(
    'executivo', jsonb_build_object(
      'tutores_ativos', public.admin_kpi_delta((select n from tutores_ativos_cur), (select n from tutores_ativos_prev)),
      'profissionais_ativos', public.admin_kpi_delta((select n from profissionais_ativos_cur), (select n from profissionais_ativos_prev)),
      'solicitacoes_criadas', public.admin_kpi_delta((select count(*) from base_requests_cur), (select count(*) from base_requests_prev)),
      'servicos_confirmados', public.admin_kpi_delta((select n from confirmados_cur), (select n from confirmados_prev)),
      'servicos_concluidos', public.admin_kpi_delta((select n from concluidos_cur), (select n from concluidos_prev)),
      'gmv', public.admin_kpi_delta((select gmv from pagamentos_cur), (select gmv from pagamentos_prev)),
      'receita_petlys', public.admin_kpi_delta((select receita from pagamentos_cur), (select receita from pagamentos_prev)),
      'ticket_medio', public.admin_kpi_delta(
        case when (select qtd from pagamentos_cur) = 0 then 0 else (select gmv from pagamentos_cur) / (select qtd from pagamentos_cur) end,
        case when (select qtd from pagamentos_prev) = 0 then null else (select gmv from pagamentos_prev) / (select qtd from pagamentos_prev) end
      )
    ),
    'crescimento', jsonb_build_object(
      'novos_tutores', public.admin_kpi_delta((select n from novos_tutores_cur), (select n from novos_tutores_prev)),
      'novos_profissionais_cadastrados', public.admin_kpi_delta((select n from novos_prof_cadastrados_cur), (select n from novos_prof_cadastrados_prev)),
      'novos_profissionais_aprovados', jsonb_build_object('valor', (select n from novos_prof_aprovados_cur)),
      'novos_profissionais_reprovados', jsonb_build_object('valor', (select n from novos_prof_reprovados_cur)),
      'crescimento_base_ativa_tutores', jsonb_build_object('delta_pct',
        (public.admin_kpi_delta((select n from tutores_ativos_cur), (select n from tutores_ativos_prev))->>'delta_pct')::numeric),
      'crescimento_base_ativa_profissionais', jsonb_build_object('delta_pct',
        (public.admin_kpi_delta((select n from profissionais_ativos_cur), (select n from profissionais_ativos_prev))->>'delta_pct')::numeric),
      'cobertura_ativa_ufs', jsonb_build_object('valor', (select n from cobertura_cur))
    ),
    'demanda', jsonb_build_object(
      'oferta_disponivel', jsonb_build_object('valor', (select n from oferta_cur)),
      'solicitacoes_sem_proposta', jsonb_build_object('valor', (select n from sem_proposta_cur)),
      'tempo_primeira_resposta_horas', jsonb_build_object('valor', (select round(horas::numeric, 1) from tempo_resposta_cur)),
      'tempo_primeira_proposta_horas', jsonb_build_object('valor', (select round(horas::numeric, 1) from tempo_proposta_cur)),
      'demanda_atendida_pct', jsonb_build_object('valor',
        case when (select total from demanda_atendida_cur) = 0 then null
             else round((select com_proposta from demanda_atendida_cur)::numeric / (select total from demanda_atendida_cur) * 100, 1) end)
    ),
    'qualidade', jsonb_build_object(
      'nota_media', jsonb_build_object('valor', (select round(media::numeric, 2) from nota_media_cur)),
      'cancelamento_tutor_pct', jsonb_build_object('valor',
        case when (select n from confirmados_cur) = 0 then null
             else round((select n from cancelamento_tutor_cur)::numeric / (select n from confirmados_cur) * 100, 1) end),
      'cancelamento_profissional_pct', jsonb_build_object('valor',
        case when (select n from confirmados_cur) = 0 then null
             else round((select n from cancelamento_prof_cur)::numeric / (select n from confirmados_cur) * 100, 1) end),
      'incidentes_abertos', jsonb_build_object('valor', (select n from incidentes_abertos_cur)),
      'incidentes_resolvidos', jsonb_build_object('valor', (select n from incidentes_resolvidos_cur)),
      'tempo_resolucao_horas', jsonb_build_object('valor', (select round(horas::numeric, 1) from incidentes_resolvidos_cur)),
      'no_show_tutor', jsonb_build_object('valor', (select tutor from no_show_cur)),
      'no_show_profissional', jsonb_build_object('valor', (select profissional from no_show_cur)),
      'recorrencia_tutores_pct', jsonb_build_object('valor',
        case when (select base from recorrencia_cur) = 0 then null
             else round((select recorrentes from recorrencia_cur)::numeric / (select base from recorrencia_cur) * 100, 1) end),
      'retencao_profissionais_pct', jsonb_build_object('valor',
        case when (select base from retencao_cur) = 0 then null
             else round((select retidos from retencao_cur)::numeric / (select base from retencao_cur) * 100, 1) end)
    )
  ) into v_result;

  return v_result;
end;
$$;

revoke execute on function public.admin_kpi_summary(date, date, public.service_category, text) from public, anon, authenticated;
grant execute on function public.admin_kpi_summary(date, date, public.service_category, text) to authenticated;
