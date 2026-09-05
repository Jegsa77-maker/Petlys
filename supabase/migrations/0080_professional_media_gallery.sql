-- ============================================================================
-- 0080_professional_media_gallery.sql
-- Galeria de fotos e vídeos do Profissional (2026-09-06) — mesmo padrão de
-- pet_media/pet-gallery (0072): avatar (professional_profiles.avatar_url)
-- já é upload real desde 0017, isso aqui é a lista extra (portfólio —
-- "antes/depois de uma tosa", vídeo de um passeio etc.).
-- ============================================================================

create table public.professional_media (
  id uuid primary key default gen_random_uuid(),
  professional_id uuid not null references public.profiles(id) on delete cascade,
  -- Texto simples com check, não reaproveita o enum pet_media_type — mesmo
  -- valor (foto/video), mas o nome do enum ficaria confuso num contexto que
  -- não é de pet.
  media_type text not null check (media_type in ('foto', 'video')),
  -- Caminho dentro do bucket `professional-gallery` — {professional_id}/{arquivo}.
  url text not null,
  created_by uuid not null references public.profiles(id),
  created_at timestamptz not null default now()
);

create index professional_media_professional_id_idx on public.professional_media (professional_id, created_at);

alter table public.professional_media enable row level security;

create policy professional_media_select on public.professional_media
  for select using (true);

create policy professional_media_insert on public.professional_media
  for insert with check (professional_id = auth.uid() and created_by = auth.uid());

-- Sem policy de update — item de mídia é imutável, mesmo critério de pet_media.
create policy professional_media_delete on public.professional_media
  for delete using (professional_id = auth.uid());

-- ----------------------------------------------------------------------------
-- Storage — professional-gallery (público, mesma lógica de pet-gallery/avatars).
-- ----------------------------------------------------------------------------
insert into storage.buckets (id, name, public, allowed_mime_types, file_size_limit)
values (
  'professional-gallery',
  'professional-gallery',
  true,
  array['image/jpeg', 'image/png', 'image/webp', 'image/heic', 'video/mp4', 'video/quicktime', 'video/webm'],
  52428800
)
on conflict (id) do nothing;

-- Caminho esperado: {professional_id}/{arquivo}.
create policy professional_gallery_storage_select on storage.objects
  for select using (bucket_id = 'professional-gallery');

create policy professional_gallery_storage_insert on storage.objects
  for insert with check (
    bucket_id = 'professional-gallery'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

create policy professional_gallery_storage_delete on storage.objects
  for delete using (
    bucket_id = 'professional-gallery'
    and (storage.foldername(name))[1] = auth.uid()::text
  );
