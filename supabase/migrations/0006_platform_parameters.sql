-- ============================================================================
-- 0006_platform_parameters.sql
-- Tabela genérica de parâmetros comerciais + log de auditoria (seção 9.4).
-- Estado atual em uma tabela; toda alteração/exclusão gera automaticamente
-- uma linha no log, via trigger — a aplicação nunca escreve no log direto.
-- ============================================================================

create table public.platform_parameters (
  id uuid primary key default gen_random_uuid(),
  chave1 text not null,
  chave2 text not null default '',
  chave3 text not null default '',
  valor1 text,
  valor2 text,
  valor3 text,
  explicacao text,
  vigencia_inicio timestamptz not null default now(),
  status parameter_lifecycle not null default 'ativo',
  atualizado_por uuid not null references public.profiles (id),
  atualizado_em timestamptz not null default now()
);

comment on table public.platform_parameters is 'Tabela genérica: 3 chaves + 3 valores + explicação, cobre comissão, retenção de no-show, SLA de incidente, etc. (seção 9.4).';

-- Só pode existir um parâmetro ativo por combinação de chaves ao mesmo tempo.
create unique index platform_parameters_active_unique_idx
  on public.platform_parameters (chave1, chave2, chave3)
  where status = 'ativo';

create index platform_parameters_lookup_idx on public.platform_parameters (chave1, chave2, chave3);

-- ----------------------------------------------------------------------------
-- platform_parameters_log — somente insert, nunca editado
-- ----------------------------------------------------------------------------
create table public.platform_parameters_log (
  id uuid primary key default gen_random_uuid(),
  parameter_id uuid not null references public.platform_parameters (id),
  chave1 text not null,
  chave2 text not null,
  chave3 text not null,
  valores_anteriores jsonb,
  valores_novos jsonb,
  acao parameter_action not null,
  alterado_por uuid not null references public.profiles (id),
  criado_em timestamptz not null default now()
);

create index platform_parameters_log_parameter_idx on public.platform_parameters_log (parameter_id);

-- ----------------------------------------------------------------------------
-- Trigger: grava automaticamente no log a cada insert/update/delete
-- ----------------------------------------------------------------------------
create or replace function public.log_platform_parameter_change()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if (tg_op = 'INSERT') then
    insert into public.platform_parameters_log
      (parameter_id, chave1, chave2, chave3, valores_anteriores, valores_novos, acao, alterado_por)
    values
      (new.id, new.chave1, new.chave2, new.chave3, null,
       jsonb_build_object('valor1', new.valor1, 'valor2', new.valor2, 'valor3', new.valor3, 'vigencia_inicio', new.vigencia_inicio),
       'criacao', new.atualizado_por);
    return new;

  elsif (tg_op = 'UPDATE') then
    insert into public.platform_parameters_log
      (parameter_id, chave1, chave2, chave3, valores_anteriores, valores_novos, acao, alterado_por)
    values
      (new.id, new.chave1, new.chave2, new.chave3,
       jsonb_build_object('valor1', old.valor1, 'valor2', old.valor2, 'valor3', old.valor3, 'vigencia_inicio', old.vigencia_inicio, 'status', old.status),
       jsonb_build_object('valor1', new.valor1, 'valor2', new.valor2, 'valor3', new.valor3, 'vigencia_inicio', new.vigencia_inicio, 'status', new.status),
       'edicao', new.atualizado_por);
    return new;

  elsif (tg_op = 'DELETE') then
    insert into public.platform_parameters_log
      (parameter_id, chave1, chave2, chave3, valores_anteriores, valores_novos, acao, alterado_por)
    values
      (old.id, old.chave1, old.chave2, old.chave3,
       jsonb_build_object('valor1', old.valor1, 'valor2', old.valor2, 'valor3', old.valor3),
       null, 'exclusao', old.atualizado_por);
    return old;
  end if;
  return null;
end;
$$;

create trigger platform_parameters_audit
  after insert or update or delete on public.platform_parameters
  for each row execute function public.log_platform_parameter_change();
