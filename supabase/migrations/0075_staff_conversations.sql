-- ============================================================================
-- 0075_staff_conversations.sql
-- Pedido do usuário: "ambos admin e supervisor podem falar com o usuario
-- via chat a partir do perfil". O chat que já existe (`messages`,
-- 0004_requests_and_proposals.sql) sempre pertence a uma `request_id`
-- (not null) — mesmo a intervenção de staff num incidente (0015) só
-- funciona DENTRO de uma solicitação existente. Não dá pra reaproveitar
-- pra "falar com qualquer usuário a partir do perfil", que não tem
-- solicitação nenhuma por trás — precisa de tabela própria.
--
-- Uma conversa por usuário-alvo, compartilhada entre todo o staff (não é
-- DM privado de um Admin específico) — mesmo espírito de um inbox de
-- suporte: qualquer Admin/Supervisor que abrir o perfil vê o histórico
-- inteiro. Desenhada bidirecional (o próprio usuário-alvo pode responder)
-- mesmo que a tela de usuário final ainda não exista nesta entrega — a UI
-- de hoje é só do lado do staff.
-- ============================================================================

create table public.staff_conversation_messages (
  id uuid primary key default gen_random_uuid(),
  target_profile_id uuid not null references public.profiles (id) on delete cascade,
  sender_id uuid not null references public.profiles (id),
  content text not null,
  created_at timestamptz not null default now()
);

create index staff_conversation_messages_target_idx
  on public.staff_conversation_messages (target_profile_id, created_at);

comment on table public.staff_conversation_messages is
  'Chat entre staff (Admin/Supervisor) e um usuário qualquer, iniciado a partir do perfil dele — não depende de nenhuma solicitação. Uma conversa por usuário-alvo, visível a todo o staff.';

alter table public.staff_conversation_messages enable row level security;

create policy staff_conversation_messages_select on public.staff_conversation_messages
  for select using (
    public.is_admin_or_supervisor() or target_profile_id = auth.uid()
  );

create policy staff_conversation_messages_insert on public.staff_conversation_messages
  for insert with check (
    sender_id = auth.uid()
    and (public.is_admin_or_supervisor() or target_profile_id = auth.uid())
  );
