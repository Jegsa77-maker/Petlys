-- ============================================================================
-- 0081_professional_skills.sql
-- "Habilidades" do Profissional (2026-09-06) — categorias que ele declara
-- que atua, aparecem publicamente no perfil e liberam os campos
-- específicos daquela categoria na hora de publicar um Serviço (ver
-- 0082_service_category_details.sql). Não é o mesmo que professional_
-- services: uma habilidade é declarada uma vez por categoria; o
-- profissional pode publicar vários serviços na mesma categoria depois.
-- ============================================================================

create table public.professional_skills (
  id uuid primary key default gen_random_uuid(),
  professional_id uuid not null references public.profiles(id) on delete cascade,
  category public.service_category not null,
  created_at timestamptz not null default now(),
  unique (professional_id, category)
);

alter table public.professional_skills enable row level security;

-- Aberta pra leitura — é literalmente o que aparece no perfil público.
create policy professional_skills_select on public.professional_skills
  for select using (true);

create policy professional_skills_insert on public.professional_skills
  for insert with check (professional_id = auth.uid());

create policy professional_skills_delete on public.professional_skills
  for delete using (professional_id = auth.uid());
