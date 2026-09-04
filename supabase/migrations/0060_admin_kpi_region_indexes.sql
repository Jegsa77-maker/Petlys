-- Dashboard de KPIs do Admin (itens 19-20) — base pra filtro de região e
-- pra consultas de intervalo de data que hoje não têm índice nenhum.

-- Região do dashboard = UF (estado), não cidade: o schema não tem coluna de
-- cidade em lugar nenhum (geografia hoje é só lat/lng + raio). Derivar de
-- CEP evita depender de geocoding externo — faixas oficiais dos Correios,
-- função pura e determinística (mesmo espírito de public.distance_km).
create or replace function public.cep_to_uf(zip text)
returns text
language plpgsql
immutable
set search_path = public
as $$
declare
  v_digits text := regexp_replace(coalesce(zip, ''), '\D', '', 'g');
  v_prefix int;
begin
  if length(v_digits) < 5 then
    return null;
  end if;
  v_prefix := substring(v_digits from 1 for 5)::int;
  return case
    when v_prefix between 1000 and 19999 then 'SP'
    when v_prefix between 20000 and 28999 then 'RJ'
    when v_prefix between 29000 and 29999 then 'ES'
    when v_prefix between 30000 and 39999 then 'MG'
    when v_prefix between 40000 and 48999 then 'BA'
    when v_prefix between 49000 and 49999 then 'SE'
    when v_prefix between 50000 and 56999 then 'PE'
    when v_prefix between 57000 and 57999 then 'AL'
    when v_prefix between 58000 and 58999 then 'PB'
    when v_prefix between 59000 and 59999 then 'RN'
    when v_prefix between 60000 and 63999 then 'CE'
    when v_prefix between 64000 and 64999 then 'PI'
    when v_prefix between 65000 and 65999 then 'MA'
    when v_prefix between 66000 and 68899 then 'PA'
    when v_prefix between 68900 and 68999 then 'AP'
    when v_prefix between 69000 and 69299 then 'AM'
    when v_prefix between 69300 and 69399 then 'RR'
    when v_prefix between 69400 and 69899 then 'AM'
    when v_prefix between 69900 and 69999 then 'AC'
    when v_prefix between 70000 and 72799 then 'DF'
    when v_prefix between 72800 and 76799 then 'GO'
    when v_prefix between 76800 and 76999 then 'RO'
    when v_prefix between 77000 and 77999 then 'TO'
    when v_prefix between 78000 and 78899 then 'MT'
    when v_prefix between 79000 and 79999 then 'MS'
    when v_prefix between 80000 and 87999 then 'PR'
    when v_prefix between 88000 and 89999 then 'SC'
    when v_prefix between 90000 and 99999 then 'RS'
    else null
  end;
end;
$$;

comment on function public.cep_to_uf(text) is
  'Deriva a UF a partir do CEP usando as faixas oficiais dos Correios.
   Aproximação por design: existem exceções pontuais de bairro nas bordas
   entre UFs (ex. entorno de Brasília), aceitável pra uma métrica de
   dashboard, não pra roteamento postal. Função pura, sem I/O — segura pra
   ficar com grant público (mesmo tratamento de public.distance_km).';

-- Índices que faltavam pra range de data (achado ao investigar as consultas
-- de KPI — nenhuma dessas colunas tinha índice até agora).
create index requests_created_at_idx on public.requests (created_at);
create index request_status_history_to_status_created_idx
  on public.request_status_history (to_status, created_at);
create index request_occurrences_scheduled_at_idx on public.request_occurrences (scheduled_at);
create index request_occurrences_completed_at_idx
  on public.request_occurrences (completed_at) where completed_at is not null;
