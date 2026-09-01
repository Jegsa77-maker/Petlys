-- ============================================================================
-- 0033_dismiss_flag.sql
-- "Manter" na fila de moderação precisa tirar o item da fila de verdade
-- (limpar a sinalização), não só esconder na tela — senão reaparece pra
-- sempre a cada carregamento da página.
-- ============================================================================

create or replace function public.dismiss_message_flag(p_message_id uuid)
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
    set flagged_reason = null, flagged_by = null, flagged_at = null
    where id = p_message_id;
end;
$$;

grant execute on function public.dismiss_message_flag(uuid) to authenticated;

create or replace function public.dismiss_review_flag(p_review_id uuid)
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
    set flagged_reason = null, flagged_by = null, flagged_at = null
    where id = p_review_id;
end;
$$;

grant execute on function public.dismiss_review_flag(uuid) to authenticated;
