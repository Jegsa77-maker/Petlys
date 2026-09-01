-- ============================================================================
-- 0023_solicitacao_contextual.sql
-- Onda 2, item 4 — solicitação contextual completa: local do atendimento,
-- respostas às perguntas por categoria, e anexos na própria solicitação
-- (seção 12.1 da Especificação v2.0). "Período" fica coberto pela agenda
-- flexível já entregue na proposta (0021) — não duplicado aqui.
-- ============================================================================

alter table public.requests
  add column address text,
  add column category_answers jsonb not null default '{}'::jsonb;

comment on column public.requests.address is 'Endereço do atendimento (texto livre) — relevante pra categorias domiciliares. Opcional: nem todo serviço acontece na casa do Tutor.';
comment on column public.requests.category_answers is 'Respostas às perguntas específicas da categoria escolhida (ver lib/domain/category-questions.ts) — chave/valor livre, perguntas mantidas em código, mesmo padrão de subcategorias (0019).';

-- ----------------------------------------------------------------------------
-- request_attachments — anexos da própria solicitação (fotos/documentos
-- específicos daquele pedido, diferente dos documentos do prontuário do pet)
-- ----------------------------------------------------------------------------
create table public.request_attachments (
  id uuid primary key default gen_random_uuid(),
  request_id uuid not null references public.requests (id) on delete cascade,
  url text not null,
  uploaded_by uuid not null references public.profiles (id),
  created_at timestamptz not null default now()
);

comment on table public.request_attachments is 'Anexos da solicitação (seção 12.1) — ex.: foto de uma lesão de pele pra mostrar ao veterinário antes do atendimento.';

create index request_attachments_request_idx on public.request_attachments (request_id);

alter table public.request_attachments enable row level security;

create policy request_attachments_select on public.request_attachments
  for select using (public.is_party_of_request(request_id) or public.is_admin_or_supervisor());

create policy request_attachments_insert on public.request_attachments
  for insert with check (uploaded_by = auth.uid() and public.is_party_of_request(request_id));

-- ----------------------------------------------------------------------------
-- Storage — bucket privado pra anexos de solicitação
-- ----------------------------------------------------------------------------
insert into storage.buckets (id, name, public)
values ('request-attachments', 'request-attachments', false)
on conflict (id) do nothing;

-- Caminho esperado: {request_id}/{arquivo}.
create policy request_attachments_storage_select on storage.objects
  for select using (
    bucket_id = 'request-attachments'
    and (
      public.is_party_of_request(((storage.foldername(name))[1])::uuid)
      or public.is_admin_or_supervisor()
    )
  );

create policy request_attachments_storage_insert on storage.objects
  for insert with check (
    bucket_id = 'request-attachments'
    and public.is_party_of_request(((storage.foldername(name))[1])::uuid)
  );
