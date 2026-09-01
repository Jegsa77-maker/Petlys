-- ============================================================================
-- 0020_favoritos.sql
-- Onda 2 do plano 100% (seção 12.1) — favoritos do Tutor, parte da busca
-- avançada (o restante — filtros de preço/nota/subcategoria/espécie — não
-- precisa de schema novo, usa colunas já criadas em 0019).
-- ============================================================================

create table public.tutor_favorites (
  tutor_profile_id uuid not null references public.profiles (id) on delete cascade,
  professional_id uuid not null references public.profiles (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (tutor_profile_id, professional_id)
);

comment on table public.tutor_favorites is 'Profissionais favoritados por um Tutor (seção 7.3/12.1) — cada Tutor só enxerga e gerencia os próprios.';

create index tutor_favorites_professional_idx on public.tutor_favorites (professional_id);

alter table public.tutor_favorites enable row level security;

create policy tutor_favorites_select on public.tutor_favorites
  for select using (tutor_profile_id = auth.uid());

create policy tutor_favorites_insert on public.tutor_favorites
  for insert with check (tutor_profile_id = auth.uid() and public.has_role('tutor'));

create policy tutor_favorites_delete on public.tutor_favorites
  for delete using (tutor_profile_id = auth.uid());
