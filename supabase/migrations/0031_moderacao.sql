-- ============================================================================
-- 0031_moderacao.sql
-- Onda 4, item 4 — moderação de avaliações e mensagens (seção 12.3).
-- `messages.flagged_reason` já existia desde 0004 mas nunca foi escrito
-- por nenhum código — a coluna existia, a funcionalidade não.
--
-- Escrita via função SECURITY DEFINER (mesmo padrão de
-- 0030_fix_appeal_incident_rls.sql), não policy de UPDATE nova: evita
-- liberar a linha inteira (conteúdo da mensagem/nota da avaliação
-- incluídos) pra quem só devia poder sinalizar ou ocultar.
-- ============================================================================

alter table public.messages
  add column flagged_by uuid references public.profiles (id),
  add column flagged_at timestamptz,
  add column hidden_at timestamptz,
  add column hidden_by uuid references public.profiles (id);

alter table public.reviews
  add column flagged_reason text,
  add column flagged_by uuid references public.profiles (id),
  add column flagged_at timestamptz,
  add column hidden_at timestamptz,
  add column hidden_by uuid references public.profiles (id);

comment on column public.reviews.hidden_at is 'Avaliação oculta pelo Admin/Supervisor não entra no cálculo de nota média (lib/domain/professional-reputation.ts) nem aparece pro público — mas fica registrada, nunca apagada.';

-- ----------------------------------------------------------------------------
-- flag_message — qualquer parte da solicitação pode sinalizar uma
-- mensagem que não é dela mesma.
-- ----------------------------------------------------------------------------
create or replace function public.flag_message(p_message_id uuid, p_reason text)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_request_id uuid;
  v_sender_id uuid;
begin
  select m.request_id, m.sender_id into v_request_id, v_sender_id
  from public.messages m where m.id = p_message_id;

  if v_request_id is null then
    raise exception 'Mensagem não encontrada';
  end if;

  if v_sender_id = auth.uid() then
    raise exception 'Você não pode sinalizar sua própria mensagem';
  end if;

  if not public.is_party_of_request(v_request_id) then
    raise exception 'Você não tem permissão pra sinalizar essa mensagem';
  end if;

  update public.messages
    set flagged_reason = p_reason, flagged_by = auth.uid(), flagged_at = now()
    where id = p_message_id;
end;
$$;

grant execute on function public.flag_message(uuid, text) to authenticated;

-- ----------------------------------------------------------------------------
-- flag_review — só quem foi avaliado pode sinalizar a própria avaliação
-- recebida.
-- ----------------------------------------------------------------------------
create or replace function public.flag_review(p_review_id uuid, p_reason text)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_reviewee_id uuid;
begin
  select reviewee_id into v_reviewee_id from public.reviews where id = p_review_id;

  if v_reviewee_id is null then
    raise exception 'Avaliação não encontrada';
  end if;

  if v_reviewee_id <> auth.uid() then
    raise exception 'Você só pode sinalizar avaliações que recebeu';
  end if;

  update public.reviews
    set flagged_reason = p_reason, flagged_by = auth.uid(), flagged_at = now()
    where id = p_review_id;
end;
$$;

grant execute on function public.flag_review(uuid, text) to authenticated;

-- ----------------------------------------------------------------------------
-- hide_message / hide_review — só Admin/Supervisor, reversível.
-- ----------------------------------------------------------------------------
create or replace function public.set_message_hidden(p_message_id uuid, p_hidden boolean)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_admin_or_supervisor() then
    raise exception 'Apenas Admin ou Supervisor podem moderar mensagens';
  end if;

  update public.messages
    set hidden_at = case when p_hidden then now() else null end,
        hidden_by = case when p_hidden then auth.uid() else null end
    where id = p_message_id;
end;
$$;

grant execute on function public.set_message_hidden(uuid, boolean) to authenticated;

create or replace function public.set_review_hidden(p_review_id uuid, p_hidden boolean)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_admin_or_supervisor() then
    raise exception 'Apenas Admin ou Supervisor podem moderar avaliações';
  end if;

  update public.reviews
    set hidden_at = case when p_hidden then now() else null end,
        hidden_by = case when p_hidden then auth.uid() else null end
    where id = p_review_id;
end;
$$;

grant execute on function public.set_review_hidden(uuid, boolean) to authenticated;
