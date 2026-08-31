-- ============================================================================
-- 0003_professional_offerings.sql
-- Serviços, preços e agenda do profissional (seção 5.3 / 5.4).
-- ============================================================================

create table public.professional_services (
  id uuid primary key default gen_random_uuid(),
  professional_id uuid not null references public.profiles (id) on delete cascade,
  category service_category not null,
  pricing_model text not null,        -- 'fixo' | 'a_partir_de' | 'faixa' | 'diaria' | 'hora' | 'pacote' | 'orcamento_personalizado'
  base_price numeric(10, 2),
  multi_pet_discount_percent numeric(5, 2)
    constraint professional_services_discount_range
    check (multi_pet_discount_percent is null or multi_pet_discount_percent between 0 and 100),
  description text,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on column public.professional_services.multi_pet_discount_percent is 'Desconto opcional por múltiplos pets no mesmo atendimento, a critério do profissional (seção 6.1).';

create index professional_services_professional_idx on public.professional_services (professional_id) where active;
create index professional_services_category_idx on public.professional_services (category) where active;

create trigger professional_services_set_updated_at
  before update on public.professional_services
  for each row execute function public.set_updated_at();

-- ----------------------------------------------------------------------------
-- professional_availability — agenda semanal + bloqueios pontuais (seção 5.4)
-- ----------------------------------------------------------------------------
create table public.professional_availability (
  id uuid primary key default gen_random_uuid(),
  professional_id uuid not null references public.profiles (id) on delete cascade,
  weekday smallint check (weekday between 0 and 6),  -- 0 = domingo ... 6 = sábado; nulo se for date_override
  start_time time,
  end_time time,
  date_override date,                                -- bloqueio/folga de um dia específico
  blocked boolean not null default false,
  reason text,
  created_at timestamptz not null default now(),
  constraint professional_availability_weekday_or_date check (
    (weekday is not null and date_override is null)
    or (weekday is null and date_override is not null)
  )
);

create index professional_availability_professional_idx on public.professional_availability (professional_id);
