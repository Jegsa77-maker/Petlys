-- ============================================================================
-- 0017_professional_profile_details.sql
-- Onda 1 do plano 100% (seção 6.3) — perfil profissional completo:
-- apresentação, experiência, especializações, idiomas, políticas e foto.
-- Tabela separada de `profiles` (que é compartilhada por todos os papéis)
-- pra não misturar campos exclusivos de Profissional com Tutor/Admin/
-- Supervisor — mesmo raciocínio de professional_services (0003).
-- ============================================================================

create table public.professional_profiles (
  profile_id uuid primary key references public.profiles (id) on delete cascade,
  bio text,
  experience_years integer check (experience_years is null or experience_years >= 0),
  specializations text[] not null default '{}',
  languages text[] not null default '{}',
  policies text,
  avatar_url text,
  updated_at timestamptz not null default now()
);

comment on table public.professional_profiles is 'Apresentação pública do Profissional (seção 6.3) — só existe pra quem já escolheu o papel profissional; nunca obrigatória pra publicar um serviço.';

create trigger professional_profiles_set_updated_at
  before update on public.professional_profiles
  for each row execute function public.set_updated_at();

alter table public.professional_profiles enable row level security;

-- Mesma regra de professional_services (0013/0003): visível publicamente
-- só quando o profissional tem ao menos um serviço ativo — senão o próprio
-- dono e admin/supervisor.
create policy professional_profiles_select_public on public.professional_profiles
  for select using (
    exists (
      select 1 from public.professional_services ps
      where ps.professional_id = professional_profiles.profile_id and ps.active
    )
    or profile_id = auth.uid()
    or public.is_admin_or_supervisor()
  );

create policy professional_profiles_insert_self on public.professional_profiles
  for insert with check (profile_id = auth.uid() and public.has_role('profissional'));

create policy professional_profiles_update_self on public.professional_profiles
  for update using (profile_id = auth.uid());

-- ----------------------------------------------------------------------------
-- Storage — bucket público de foto de perfil (avatar)
-- ----------------------------------------------------------------------------
insert into storage.buckets (id, name, public)
values ('avatars', 'avatars', true)
on conflict (id) do nothing;

-- Caminho esperado: {profile_id}/{arquivo} — qualquer um pode ler (bucket
-- público, foto de perfil não é dado sensível), só o dono escreve.
create policy avatars_storage_select on storage.objects
  for select using (bucket_id = 'avatars');

create policy avatars_storage_insert on storage.objects
  for insert with check (
    bucket_id = 'avatars'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

create policy avatars_storage_update on storage.objects
  for update using (
    bucket_id = 'avatars'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

create policy avatars_storage_delete on storage.objects
  for delete using (
    bucket_id = 'avatars'
    and (storage.foldername(name))[1] = auth.uid()::text
  );
