-- Onda 3 (fundação sem gateway): suporte real a vigência futura em platform_parameters.
-- Hoje `vigencia_inicio` existe mas não faz nada — o parâmetro nasce `ativo` na hora.
-- Passa a existir um status `agendado` (adicionado em migration própria, 0042) para
-- linhas com vigência no futuro; um job promove pra `ativo` quando a data chega.

create extension if not exists pg_cron with schema extensions;

-- Só pode haver um valor agendado por combinação de chaves ao mesmo tempo
-- (mesma regra de negócio do índice já existente para 'ativo').
create unique index platform_parameters_scheduled_unique_idx
  on public.platform_parameters (chave1, chave2, chave3)
  where status = 'agendado';

comment on index public.platform_parameters_scheduled_unique_idx is
  'No máximo um agendamento pendente por combinação de chaves — evita duas mudanças futuras conflitantes pra o mesmo parâmetro.';

create or replace function public.promote_scheduled_parameters()
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  r record;
begin
  for r in
    select * from public.platform_parameters
    where status = 'agendado' and vigencia_inicio <= now()
  loop
    -- rebaixa o valor atualmente vigente da mesma chave (se existir) antes de promover o novo
    update public.platform_parameters
      set status = 'substituido', atualizado_em = now()
      where chave1 = r.chave1 and chave2 = r.chave2 and chave3 = r.chave3
        and status = 'ativo';

    update public.platform_parameters
      set status = 'ativo', atualizado_em = now()
      where id = r.id;
  end loop;
end;
$$;

comment on function public.promote_scheduled_parameters() is
  'Chamada pelo pg_cron a cada 10 min. Promove platform_parameters agendado->ativo quando vigencia_inicio chega, rebaixando o ativo antigo pra substituido. Passa pela mesma trigger de auditoria (log_platform_parameter_change) que qualquer outra mudança na tabela.';

revoke execute on function public.promote_scheduled_parameters() from anon, authenticated;

select cron.schedule(
  'promote-scheduled-parameters',
  '*/10 * * * *',
  $$select public.promote_scheduled_parameters()$$
);
