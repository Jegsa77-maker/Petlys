-- ============================================================================
-- 0072_pet_media_gallery.sql
-- Galeria de fotos e vídeos extras do pet (item 3 da lista de ajustes —
-- "permitir colocar mais fotos extras e vídeos pequenos"). Separado de
-- `pets.photo_url` (a foto de perfil única, seção 6.2) — aqui é uma lista
-- de itens, então precisa de tabela própria, não uma coluna.
-- ============================================================================

create type public.pet_media_type as enum ('foto', 'video');

create table public.pet_media (
  id uuid primary key default gen_random_uuid(),
  pet_id uuid not null references public.pets(id) on delete cascade,
  media_type public.pet_media_type not null,
  -- Caminho dentro do bucket `pet-gallery` (público, mesma lógica de
  -- pet-photos) — {pet_id}/{arquivo}, nunca URL completa.
  url text not null,
  created_by uuid not null references public.profiles(id),
  created_at timestamptz not null default now()
);

create index pet_media_pet_id_idx on public.pet_media (pet_id, created_at);

alter table public.pet_media enable row level security;

-- Aberta pra leitura (mesmo espírito de pet-photos: são fotos/vídeos do
-- bichinho, não dado sensível como a carteira de vacinação) — pedido
-- explícito do usuário ("se possível abertas").
create policy pet_media_select on public.pet_media
  for select using (true);

create policy pet_media_insert on public.pet_media
  for insert with check (
    public.is_tutor_of_pet(pet_id)
    and created_by = auth.uid()
  );

-- Sem policy de update — item de mídia é imutável, só existe ou é removido.
create policy pet_media_delete on public.pet_media
  for delete using (public.is_tutor_of_pet(pet_id));

-- ----------------------------------------------------------------------------
-- Storage — pet-gallery (público, mesma lógica de pet-photos/0018). Limite de
-- tamanho no próprio bucket como rede de segurança (50MB — cobre o maior
-- caso, vídeo; o client aplica um limite mais apertado pra foto antes de
-- sequer tentar o upload). MIME restrito a imagem e vídeo comuns de celular.
-- ----------------------------------------------------------------------------
insert into storage.buckets (id, name, public, allowed_mime_types, file_size_limit)
values (
  'pet-gallery',
  'pet-gallery',
  true,
  array['image/jpeg', 'image/png', 'image/webp', 'image/heic', 'video/mp4', 'video/quicktime', 'video/webm'],
  52428800
)
on conflict (id) do nothing;

-- Caminho esperado: {pet_id}/{arquivo}.
create policy pet_gallery_storage_select on storage.objects
  for select using (bucket_id = 'pet-gallery');

create policy pet_gallery_storage_insert on storage.objects
  for insert with check (
    bucket_id = 'pet-gallery'
    and public.is_tutor_of_pet(((storage.foldername(name))[1])::uuid)
  );

create policy pet_gallery_storage_delete on storage.objects
  for delete using (
    bucket_id = 'pet-gallery'
    and public.is_tutor_of_pet(((storage.foldername(name))[1])::uuid)
  );
