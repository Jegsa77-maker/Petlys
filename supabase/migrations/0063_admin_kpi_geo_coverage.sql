-- Dashboard de KPIs do Admin — mapa de cobertura por cidade (pedido do
-- usuário: "cores de tutor e profissional diferentes por cidade com
-- números totais"). Casa cada tutor/profissional com a cidade de
-- referência mais próxima (public.reference_cities, 0062) usando
-- public.distance_km (mesmo haversine que professional_service_areas já
-- usa). Ponto a mais de 50km de qualquer cidade de referência cai num
-- balde "UF — outras cidades" (ou "Não identificado" se nem o CEP existir)
-- em vez de forçar uma cidade errada.
create or replace function public.admin_kpi_geo_coverage(p_category public.service_category default null)
returns table(city_label text, uf text, lat double precision, lng double precision, tutores bigint, profissionais bigint)
language plpgsql
security definer
stable
set search_path = public
as $$
begin
  if not public.is_admin_or_supervisor() then
    raise exception 'Apenas Admin ou Supervisor podem ver o mapa de cobertura';
  end if;

  return query
  with tutor_points as (
    select p.address_lat as lat, p.address_lng as lng, p.address_zip as zip
    from public.profiles p
    join public.account_roles ar on ar.profile_id = p.id and ar.role = 'tutor' and ar.active
    where p.address_lat is not null and p.address_lng is not null
      and (p_category is null or exists (
        select 1 from public.requests r where r.tutor_id = p.id and r.category = p_category
      ))
  ),
  -- distinct on: um profissional pode ter mais de uma área de atendimento
  -- configurada — conta uma vez, usando a área mais recente.
  professional_points as (
    select distinct on (psa.professional_id)
      psa.center_lat as lat, psa.center_lng as lng, pr.address_zip as zip
    from public.professional_service_areas psa
    join public.account_roles ar on ar.profile_id = psa.professional_id and ar.role = 'profissional' and ar.active
    join public.profiles pr on pr.id = psa.professional_id
    where (p_category is null or exists (
      select 1 from public.professional_services ps
      where ps.professional_id = psa.professional_id and ps.category = p_category and ps.active
    ))
    order by psa.professional_id, psa.created_at desc
  ),
  -- Qualificado com o alias da CTE de origem: "lat"/"lng" bastando sem
  -- qualificar dá "column reference is ambiguous" aqui dentro, porque
  -- RETURNS TABLE cria variáveis PL/pgSQL de mesmo nome (lat, lng, uf...)
  -- visíveis em todo o corpo da função.
  combined as (
    select 'tutor'::text as role, tp.lat, tp.lng, tp.zip from tutor_points tp
    union all
    select 'profissional'::text as role, pp.lat, pp.lng, pp.zip from professional_points pp
  ),
  matched as (
    select
      c.role,
      coalesce(near.nome, public.cep_to_uf(c.zip) || ' — outras cidades', 'Não identificado') as city_label,
      coalesce(near.uf, public.cep_to_uf(c.zip)) as uf,
      coalesce(near.lat, c.lat) as lat,
      coalesce(near.lng, c.lng) as lng
    from combined c
    left join lateral (
      select rc.nome, rc.uf, rc.lat, rc.lng
      from public.reference_cities rc
      order by public.distance_km(c.lat, c.lng, rc.lat, rc.lng) asc
      limit 1
    ) near on public.distance_km(c.lat, c.lng, near.lat, near.lng) <= 50
  )
  select
    m.city_label,
    max(m.uf) as uf,
    avg(m.lat) as lat,
    avg(m.lng) as lng,
    count(*) filter (where m.role = 'tutor') as tutores,
    count(*) filter (where m.role = 'profissional') as profissionais
  from matched m
  group by m.city_label
  order by count(*) desc;
end;
$$;

revoke execute on function public.admin_kpi_geo_coverage(public.service_category) from public, anon, authenticated;
grant execute on function public.admin_kpi_geo_coverage(public.service_category) to authenticated;
