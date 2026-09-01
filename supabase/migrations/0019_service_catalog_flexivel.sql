-- ============================================================================
-- 0019_service_catalog_flexivel.sql
-- Onda 2 do plano 100% (seção 12.1) — catálogo de serviços flexível:
-- subcategoria, duração, espécies/porte atendidos, restrições e adicionais
-- com preço próprio. "Perguntas por categoria" (a outra metade do item do
-- plano) fica para a história de solicitação contextual — é sobre o que se
-- pergunta ao Tutor, não sobre o que o Profissional cadastra aqui.
-- ============================================================================

alter table public.professional_services
  add column subcategory text,
  add column duration_minutes integer check (duration_minutes is null or duration_minutes > 0),
  add column species_accepted text[] not null default '{}',
  add column min_size pet_size,
  add column max_size pet_size,
  add column restrictions text;

comment on column public.professional_services.subcategory is 'Rótulo livre dentro da categoria (ex.: "Tosa na tesoura" dentro de banho_tosa). Lista sugerida mantida em lib/domain/service-catalog.ts, não é enum de banco — evita migration a cada novo rótulo.';
comment on column public.professional_services.species_accepted is 'Espécies atendidas por este serviço (ex.: {cão,gato}). Vazio = atende qualquer espécie.';
comment on column public.professional_services.min_size is 'Porte mínimo do pet aceito por este serviço, se houver restrição.';
comment on column public.professional_services.max_size is 'Porte máximo do pet aceito por este serviço, se houver restrição.';

alter table public.professional_services
  add constraint professional_services_size_range
  check (min_size is null or max_size is null or min_size <= max_size);

-- ----------------------------------------------------------------------------
-- professional_service_addons — adicionais com preço próprio (seção 6.1/6.3)
-- ----------------------------------------------------------------------------
create table public.professional_service_addons (
  id uuid primary key default gen_random_uuid(),
  service_id uuid not null references public.professional_services (id) on delete cascade,
  name text not null,
  price numeric(10, 2) not null check (price >= 0),
  created_at timestamptz not null default now()
);

comment on table public.professional_service_addons is 'Itens extras que o profissional pode oferecer sobre um serviço (ex.: "leva e traz", "hidratação"), cada um com preço próprio.';

create index professional_service_addons_service_idx on public.professional_service_addons (service_id);

alter table public.professional_service_addons enable row level security;

-- Mesma regra de visibilidade do serviço-pai: público se o serviço está
-- ativo, senão só o dono e admin/supervisor.
create policy professional_service_addons_select on public.professional_service_addons
  for select using (
    exists (
      select 1 from public.professional_services ps
      where ps.id = service_id
        and (ps.active or ps.professional_id = auth.uid() or public.is_admin_or_supervisor())
    )
  );

create policy professional_service_addons_insert on public.professional_service_addons
  for insert with check (
    exists (
      select 1 from public.professional_services ps
      where ps.id = service_id and ps.professional_id = auth.uid()
    )
  );

create policy professional_service_addons_delete on public.professional_service_addons
  for delete using (
    exists (
      select 1 from public.professional_services ps
      where ps.id = service_id and ps.professional_id = auth.uid()
    )
  );
