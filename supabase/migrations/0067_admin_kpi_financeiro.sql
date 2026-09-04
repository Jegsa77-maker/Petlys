-- Dashboard de KPIs do Admin — área Financeiro (KPIs "B" da especificação
-- externa: dependem da Onda 3 rodando de verdade). As tabelas já existem
-- desde a fundação da Onda 3 (payments/payouts/chargebacks/
-- reconciliation_flags) — os números ficam perto de zero até o gateway
-- entrar em produção (beta usa confirmPaymentManually), mas a consulta em
-- si já é real, nunca dado simulado.
create or replace function public.admin_kpi_financeiro(
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

  with pagamentos_periodo as (
    select p.status, p.amount, p.commission_amount
    from public.payments p
    join public.requests r on r.id = p.request_id
    join public.profiles t on t.id = r.tutor_id
    where p.created_at::date between p_from and p_to
      and (p_category is null or r.category = p_category)
      and (p_uf is null or public.cep_to_uf(t.address_zip) = p_uf)
  ),
  pagamentos_por_status as (
    select status, count(*) as qtd, coalesce(sum(amount), 0) as valor
    from pagamentos_periodo group by status
  ),
  pagos as (
    select coalesce(sum(amount), 0) as gmv, coalesce(sum(commission_amount), 0) as comissao
    from pagamentos_periodo where status = 'pago'
  ),
  payouts_periodo as (
    select po.status, po.amount, po.professional_id
    from public.payouts po
    join public.profiles pr on pr.id = po.professional_id
    where po.created_at::date between p_from and p_to
      and (p_uf is null or public.cep_to_uf(pr.address_zip) = p_uf)
  ),
  payouts_por_status as (
    select status, count(*) as qtd, coalesce(sum(amount), 0) as valor
    from payouts_periodo group by status
  ),
  cancelamentos as (
    select count(*) as qtd from public.request_status_history h
    join public.requests r on r.id = h.request_id
    join public.profiles t on t.id = r.tutor_id
    where h.to_status = 'cancelado' and h.created_at::date between p_from and p_to
      and (p_category is null or r.category = p_category)
      and (p_uf is null or public.cep_to_uf(t.address_zip) = p_uf)
  ),
  reembolsos as (
    select coalesce(sum(c.refunded_amount), 0) as valor from public.professional_cancellations c
    join public.requests r on r.id = c.request_id
    join public.profiles t on t.id = r.tutor_id
    where c.created_at::date between p_from and p_to
      and (p_category is null or r.category = p_category)
      and (p_uf is null or public.cep_to_uf(t.address_zip) = p_uf)
  ),
  chargebacks_periodo as (
    select cb.status, count(*) as qtd, coalesce(sum(cb.amount), 0) as valor
    from public.chargebacks cb
    join public.requests r on r.id = cb.request_id
    join public.profiles t on t.id = r.tutor_id
    where cb.reported_at::date between p_from and p_to
      and (p_category is null or r.category = p_category)
      and (p_uf is null or public.cep_to_uf(t.address_zip) = p_uf)
    group by cb.status
  ),
  divergencias as (
    select category, count(*) as qtd from public.reconciliation_flags
    where status = 'aberto' and detected_at::date between p_from and p_to
    group by category
  )
  select jsonb_build_object(
    'gmv', (select gmv from pagos),
    'comissao_arrecadada', (select comissao from pagos),
    'comissao_media_pct', case when (select gmv from pagos) = 0 then null
      else round((select comissao from pagos) / (select gmv from pagos) * 100, 1) end,
    'pagamentos_por_status', coalesce((select jsonb_object_agg(status, jsonb_build_object('qtd', qtd, 'valor', valor)) from pagamentos_por_status), '{}'::jsonb),
    'valores_a_repassar', coalesce((select sum(valor) from payouts_por_status where status <> 'pago'), 0),
    'repasses_por_status', coalesce((select jsonb_object_agg(status, jsonb_build_object('qtd', qtd, 'valor', valor)) from payouts_por_status), '{}'::jsonb),
    'cancelamentos', jsonb_build_object('qtd', (select qtd from cancelamentos), 'reembolsado', (select valor from reembolsos)),
    'chargebacks_por_status', coalesce((select jsonb_object_agg(status, jsonb_build_object('qtd', qtd, 'valor', valor)) from chargebacks_periodo), '{}'::jsonb),
    'divergencias_conciliacao_por_categoria', coalesce((select jsonb_object_agg(category, qtd) from divergencias), '{}'::jsonb)
  ) into v_result;

  return v_result;
end;
$$;

revoke execute on function public.admin_kpi_financeiro(date, date, public.service_category, text) from public, anon, authenticated;
grant execute on function public.admin_kpi_financeiro(date, date, public.service_category, text) to authenticated;
