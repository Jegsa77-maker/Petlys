-- ============================================================================
-- 0018_terms_consent_documents_certifications.sql
-- Onda 1 do plano 100% — itens finais: termos versionados (6.1),
-- consentimento de compartilhamento do prontuário + upload de documentos
-- do pet (6.2), e habilitações/documentos exigidos por categoria
-- regulamentada (6.3).
-- ============================================================================

-- ----------------------------------------------------------------------------
-- terms_acceptances — aceite versionado de Termos de Uso e Privacidade
-- (seção 6.1). Uma linha por versão aceita; se o texto mudar, o middleware
-- exige novo aceite (ver lib/domain/terms.ts:CURRENT_TERMS_VERSION).
-- ----------------------------------------------------------------------------
create table public.terms_acceptances (
  profile_id uuid not null references public.profiles (id) on delete cascade,
  version text not null,
  accepted_at timestamptz not null default now(),
  primary key (profile_id, version)
);

comment on table public.terms_acceptances is 'Aceite versionado dos Termos de Uso/Privacidade (seção 6.1) — nunca editado, só inserido; nova versão do texto = nova linha exigida.';

alter table public.terms_acceptances enable row level security;

create policy terms_acceptances_select on public.terms_acceptances
  for select using (profile_id = auth.uid() or public.is_admin_or_supervisor());

create policy terms_acceptances_insert on public.terms_acceptances
  for insert with check (profile_id = auth.uid());

-- ----------------------------------------------------------------------------
-- requests.prontuario_shared_at — consentimento explícito do Tutor pra
-- compartilhar a ficha completa dos pets selecionados com este profissional
-- especificamente (seção 6.4), registrado na criação da solicitação.
-- ----------------------------------------------------------------------------
alter table public.requests add column prontuario_shared_at timestamptz;

comment on column public.requests.prontuario_shared_at is 'Quando o Tutor autorizou compartilhar a ficha dos pets desta solicitação com este profissional. Preenchido no momento da criação (checkbox obrigatório em lib/validations/requests.ts).';

-- ----------------------------------------------------------------------------
-- pets.document_url — carteira de vacinação ou documento similar, upload
-- único (seção 6.2). Complementa health_info.vacinas (texto livre).
-- ----------------------------------------------------------------------------
alter table public.pets add column document_url text;

comment on column public.pets.document_url is 'Carteira de vacinação ou documento similar (seção 6.2) — upload no bucket pet-documents (privado).';

-- ----------------------------------------------------------------------------
-- professional_certifications — habilitação/documento exigido pra publicar
-- serviço em categoria regulamentada (seção 6.3). Hoje só
-- veterinario_domiciliar exige (ver lib/domain/regulated-categories.ts).
-- Aprovação manual por Admin/Supervisor.
-- ----------------------------------------------------------------------------
create table public.professional_certifications (
  id uuid primary key default gen_random_uuid(),
  professional_id uuid not null references public.profiles (id) on delete cascade,
  category service_category not null,
  document_url text not null,
  status text not null default 'pendente' check (status in ('pendente', 'aprovado', 'rejeitado')),
  review_notes text,
  reviewed_by uuid references public.profiles (id),
  reviewed_at timestamptz,
  created_at timestamptz not null default now()
);

comment on table public.professional_certifications is 'Documento de habilitação por categoria regulamentada (seção 6.3). Status pendente até revisão manual de Admin/Supervisor.';

create index professional_certifications_professional_idx on public.professional_certifications (professional_id);

alter table public.professional_certifications enable row level security;

create policy professional_certifications_select on public.professional_certifications
  for select using (professional_id = auth.uid() or public.is_admin_or_supervisor());

create policy professional_certifications_insert on public.professional_certifications
  for insert with check (professional_id = auth.uid() and public.has_role('profissional'));

create policy professional_certifications_delete_own_pending on public.professional_certifications
  for delete using (professional_id = auth.uid() and status = 'pendente');

create policy professional_certifications_update_admin on public.professional_certifications
  for update using (public.is_admin_or_supervisor());

-- ----------------------------------------------------------------------------
-- Storage — pet-photos (público, mesma lógica de avatars/0017)
-- ----------------------------------------------------------------------------
insert into storage.buckets (id, name, public)
values ('pet-photos', 'pet-photos', true)
on conflict (id) do nothing;

-- Caminho esperado: {pet_id}/{arquivo}.
create policy pet_photos_storage_select on storage.objects
  for select using (bucket_id = 'pet-photos');

create policy pet_photos_storage_insert on storage.objects
  for insert with check (
    bucket_id = 'pet-photos'
    and public.is_tutor_of_pet(((storage.foldername(name))[1])::uuid)
  );

create policy pet_photos_storage_update on storage.objects
  for update using (
    bucket_id = 'pet-photos'
    and public.is_tutor_of_pet(((storage.foldername(name))[1])::uuid)
  );

create policy pet_photos_storage_delete on storage.objects
  for delete using (
    bucket_id = 'pet-photos'
    and public.is_tutor_of_pet(((storage.foldername(name))[1])::uuid)
  );

-- ----------------------------------------------------------------------------
-- Storage — pet-documents (privado — carteira de vacinação é dado sensível).
-- Leitura: tutor do pet, profissional com solicitação vinculada ao pet, ou
-- admin/supervisor — mesma regra de pets_select (0009_rls_policies.sql).
-- ----------------------------------------------------------------------------
insert into storage.buckets (id, name, public)
values ('pet-documents', 'pet-documents', false)
on conflict (id) do nothing;

-- Caminho esperado: {pet_id}/{arquivo}.
create policy pet_documents_storage_select on storage.objects
  for select using (
    bucket_id = 'pet-documents'
    and (
      public.is_tutor_of_pet(((storage.foldername(name))[1])::uuid)
      or public.is_admin_or_supervisor()
      or exists (
        select 1 from public.request_pets rp
        join public.requests r on r.id = rp.request_id
        where rp.pet_id = ((storage.foldername(name))[1])::uuid and r.professional_id = auth.uid()
      )
    )
  );

create policy pet_documents_storage_insert on storage.objects
  for insert with check (
    bucket_id = 'pet-documents'
    and public.is_tutor_of_pet(((storage.foldername(name))[1])::uuid)
  );

create policy pet_documents_storage_update on storage.objects
  for update using (
    bucket_id = 'pet-documents'
    and public.is_tutor_of_pet(((storage.foldername(name))[1])::uuid)
  );

create policy pet_documents_storage_delete on storage.objects
  for delete using (
    bucket_id = 'pet-documents'
    and public.is_tutor_of_pet(((storage.foldername(name))[1])::uuid)
  );

-- ----------------------------------------------------------------------------
-- Storage — professional-certifications (privado — documento de habilitação,
-- ex.: CRMV). Leitura: só o próprio dono e admin/supervisor.
-- ----------------------------------------------------------------------------
insert into storage.buckets (id, name, public)
values ('professional-certifications', 'professional-certifications', false)
on conflict (id) do nothing;

-- Caminho esperado: {professional_id}/{arquivo}.
create policy professional_certifications_storage_select on storage.objects
  for select using (
    bucket_id = 'professional-certifications'
    and (
      (storage.foldername(name))[1] = auth.uid()::text
      or public.is_admin_or_supervisor()
    )
  );

create policy professional_certifications_storage_insert on storage.objects
  for insert with check (
    bucket_id = 'professional-certifications'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

create policy professional_certifications_storage_delete on storage.objects
  for delete using (
    bucket_id = 'professional-certifications'
    and (storage.foldername(name))[1] = auth.uid()::text
  );
