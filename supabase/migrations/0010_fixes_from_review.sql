-- ============================================================================
-- 0010_fixes_from_review.sql
-- Correções identificadas em revisão externa das Fases 1 e 2:
--
-- 1. profiles: usuário não pode mais escrever phone_verified_at /
--    email_verified_at diretamente (RLS de linha não bloqueava isso —
--    era preciso revogar no nível de coluna).
-- 2. request_pets: valida que o pet pertence ao tutor dono da solicitação,
--    não só que a solicitação é dele.
-- 3. contact_unlocked_at (em requests) modelava a liberação de contato por
--    solicitação; a regra real é por PAR tutor-profissional (uma vez
--    liberado, continua liberado nas próximas solicitações entre os dois).
--    Substituído por uma tabela própria, contact_unlocks.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. Trava de verificação: só o backend (service_role) pode marcar
--    phone_verified_at / email_verified_at.
--
--    IMPORTANTE: um REVOKE de coluna sozinho NÃO seria suficiente aqui —
--    o Supabase concede UPDATE em nível de TABELA para o role authenticated
--    por padrão, e essa concessão de tabela cobre todas as colunas
--    independentemente de um REVOKE de coluna feito depois (testado
--    localmente). Por isso a trava real é um trigger, que se aplica
--    independentemente de qual privilégio de coluna existe.
-- ----------------------------------------------------------------------------
create or replace function public.prevent_self_verification()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.role() is distinct from 'service_role' then
    if new.phone_verified_at is distinct from old.phone_verified_at
       or new.email_verified_at is distinct from old.email_verified_at then
      raise exception 'phone_verified_at e email_verified_at só podem ser alterados pelo backend (service_role), após verificação real (OTP / provedor OAuth).';
    end if;
  end if;
  return new;
end;
$$;

create trigger profiles_prevent_self_verification
  before update on public.profiles
  for each row execute function public.prevent_self_verification();

comment on function public.prevent_self_verification() is 'Bloqueia auto-verificação de telefone/e-mail mesmo com UPDATE liberado na linha pela RLS. Ver 0010 para o motivo de não usar REVOKE de coluna.';

-- ----------------------------------------------------------------------------
-- 2. request_pets: exige propriedade do pet, não só da solicitação.
-- ----------------------------------------------------------------------------
drop policy if exists request_pets_insert on public.request_pets;

create policy request_pets_insert on public.request_pets
  for insert with check (
    exists (
      select 1 from public.requests r
      where r.id = request_id and r.tutor_id = auth.uid() and r.status = 'rascunho'
    )
    and public.is_tutor_of_pet(pet_id)
  );

-- ----------------------------------------------------------------------------
-- 3. Desbloqueio de contato por par (tutor, profissional) — não por solicitação.
-- ----------------------------------------------------------------------------
alter table public.requests drop column if exists contact_unlocked_at;

create table public.contact_unlocks (
  tutor_id uuid not null references public.profiles (id),
  professional_id uuid not null references public.profiles (id),
  unlocked_at timestamptz not null default now(),
  unlocked_by_request_id uuid not null references public.requests (id),
  primary key (tutor_id, professional_id)
);

comment on table public.contact_unlocks is 'Contato (e-mail/telefone) liberado entre um tutor e um profissional específicos a partir do primeiro pedido fechado entre os dois — permanece liberado nas próximas solicitações (seção 2.4). Gravado por service_role quando o pagamento é confirmado.';

alter table public.contact_unlocks enable row level security;

create policy contact_unlocks_select on public.contact_unlocks
  for select using (
    tutor_id = auth.uid() or professional_id = auth.uid() or public.is_admin_or_supervisor()
  );

-- Sem policy de insert/update/delete para authenticated: só service_role
-- grava, no momento em que o pagamento da primeira solicitação é confirmado
-- (Server Action dedicada, na etapa de integração com o Pagar.me).

-- Helper para as telas de perfil consultarem se o contato já está liberado
-- com um profissional específico, sem expor a tabela inteira.
create or replace function public.contact_is_unlocked(other_profile_id uuid)
returns boolean
language sql
security definer
stable
set search_path = public
as $$
  select exists (
    select 1 from public.contact_unlocks
    where (tutor_id = auth.uid() and professional_id = other_profile_id)
       or (professional_id = auth.uid() and tutor_id = other_profile_id)
  );
$$;
