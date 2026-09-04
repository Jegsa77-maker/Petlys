-- Dashboard de KPIs do Admin — série temporal semanal (gráfico de barras
-- por área, igual ao mockup). Um conjunto fixo e pequeno de métricas por
-- enquanto — extensível com mais "elsif" conforme o dashboard precisar.
create or replace function public.admin_kpi_timeseries(
  p_metric text, p_from date, p_to date, p_category public.service_category default null, p_uf text default null
)
returns table(bucket date, value numeric)
language plpgsql
security definer
stable
set search_path = public
as $$
begin
  if not public.is_admin_or_supervisor() then
    raise exception 'Apenas Admin ou Supervisor podem ver o dashboard de KPIs';
  end if;

  if p_metric = 'solicitacoes' then
    return query
    select date_trunc('week', r.created_at)::date as bucket, count(*)::numeric as value
    from public.requests r
    join public.profiles t on t.id = r.tutor_id
    where r.created_at::date between p_from and p_to
      and (p_category is null or r.category = p_category)
      and (p_uf is null or public.cep_to_uf(t.address_zip) = p_uf)
    group by 1 order by 1;
  elsif p_metric = 'concluidos' then
    return query
    select date_trunc('week', o.completed_at)::date as bucket, count(*)::numeric as value
    from public.request_occurrences o
    join public.requests r on r.id = o.request_id
    join public.profiles t on t.id = r.tutor_id
    where o.completed_at is not null and o.completed_at::date between p_from and p_to
      and (p_category is null or r.category = p_category)
      and (p_uf is null or public.cep_to_uf(t.address_zip) = p_uf)
    group by 1 order by 1;
  elsif p_metric = 'gmv' then
    return query
    select date_trunc('week', p.paid_at)::date as bucket, coalesce(sum(p.amount), 0) as value
    from public.payments p
    join public.requests r on r.id = p.request_id
    join public.profiles t on t.id = r.tutor_id
    where p.status = 'pago' and p.paid_at::date between p_from and p_to
      and (p_category is null or r.category = p_category)
      and (p_uf is null or public.cep_to_uf(t.address_zip) = p_uf)
    group by 1 order by 1;
  elsif p_metric = 'confirmados' then
    return query
    select date_trunc('week', h.created_at)::date as bucket, count(*)::numeric as value
    from public.request_status_history h
    join public.requests r on r.id = h.request_id
    join public.profiles t on t.id = r.tutor_id
    where h.to_status = 'confirmado' and h.created_at::date between p_from and p_to
      and (p_category is null or r.category = p_category)
      and (p_uf is null or public.cep_to_uf(t.address_zip) = p_uf)
    group by 1 order by 1;
  else
    raise exception 'Métrica de série temporal desconhecida: %', p_metric;
  end if;
end;
$$;

revoke execute on function public.admin_kpi_timeseries(text, date, date, public.service_category, text) from public, anon, authenticated;
grant execute on function public.admin_kpi_timeseries(text, date, date, public.service_category, text) to authenticated;
