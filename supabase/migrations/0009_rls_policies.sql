-- ============================================================================
-- 0009_rls_policies.sql
-- Habilita RLS em todas as tabelas e cria as políticas por papel.
-- Nenhuma tabela fica sem RLS habilitado (regra rígida do processo).
-- ============================================================================

-- ----------------------------------------------------------------------------
-- profiles
-- ----------------------------------------------------------------------------
alter table public.profiles enable row level security;

create policy profiles_select on public.profiles
  for select using (id = auth.uid() or public.is_admin_or_supervisor());

create policy profiles_insert on public.profiles
  for insert with check (id = auth.uid());  -- trigger handle_new_user usa security definer, não é afetado

create policy profiles_update on public.profiles
  for update using (id = auth.uid() or public.is_admin_or_supervisor());

-- sem policy de delete: exclusão de conta não é feita via API direta.

-- ----------------------------------------------------------------------------
-- account_roles
-- ----------------------------------------------------------------------------
alter table public.account_roles enable row level security;

create policy account_roles_select on public.account_roles
  for select using (profile_id = auth.uid() or public.is_admin_or_supervisor());

create policy account_roles_insert_self on public.account_roles
  for insert with check (
    profile_id = auth.uid() and role in ('tutor', 'profissional')
  );

create policy account_roles_insert_admin on public.account_roles
  for insert with check (
    public.has_role('administrador') and role in ('administrador', 'supervisor')
  );

create policy account_roles_update_admin on public.account_roles
  for update using (public.has_role('administrador'));

create policy account_roles_delete_admin on public.account_roles
  for delete using (public.has_role('administrador'));

-- ----------------------------------------------------------------------------
-- supervisor_grants
-- ----------------------------------------------------------------------------
alter table public.supervisor_grants enable row level security;

create policy supervisor_grants_select_admin on public.supervisor_grants
  for select using (public.has_role('administrador'));

create policy supervisor_grants_insert_admin on public.supervisor_grants
  for insert with check (public.has_role('administrador'));

create policy supervisor_grants_update_admin on public.supervisor_grants
  for update using (public.has_role('administrador'));

-- ----------------------------------------------------------------------------
-- pets
-- ----------------------------------------------------------------------------
alter table public.pets enable row level security;

create policy pets_select on public.pets
  for select using (
    public.is_tutor_of_pet(id)
    or public.is_admin_or_supervisor()
    or exists (
      select 1 from public.request_pets rp
      join public.requests r on r.id = rp.request_id
      where rp.pet_id = pets.id and r.professional_id = auth.uid()
    )
  );

create policy pets_insert on public.pets
  for insert with check (created_by = auth.uid() and public.has_role('tutor'));

create policy pets_update on public.pets
  for update using (public.is_tutor_of_pet(id));

create policy pets_delete on public.pets
  for delete using (public.is_tutor_of_pet(id));

-- ----------------------------------------------------------------------------
-- pet_tutors
-- ----------------------------------------------------------------------------
alter table public.pet_tutors enable row level security;

create policy pet_tutors_select on public.pet_tutors
  for select using (public.is_tutor_of_pet(pet_id) or public.is_admin_or_supervisor());

create policy pet_tutors_insert on public.pet_tutors
  for insert with check (public.is_tutor_of_pet(pet_id));

create policy pet_tutors_delete on public.pet_tutors
  for delete using (
    public.is_tutor_of_pet(pet_id)
    and (select count(*) from public.pet_tutors pt2 where pt2.pet_id = pet_tutors.pet_id) > 1
  );

-- ----------------------------------------------------------------------------
-- professional_services
-- ----------------------------------------------------------------------------
alter table public.professional_services enable row level security;

create policy professional_services_select_public on public.professional_services
  for select using (active or professional_id = auth.uid() or public.is_admin_or_supervisor());

create policy professional_services_insert on public.professional_services
  for insert with check (professional_id = auth.uid() and public.has_role('profissional'));

create policy professional_services_update on public.professional_services
  for update using (professional_id = auth.uid());

create policy professional_services_delete on public.professional_services
  for delete using (professional_id = auth.uid());

-- ----------------------------------------------------------------------------
-- professional_availability
-- ----------------------------------------------------------------------------
alter table public.professional_availability enable row level security;

create policy professional_availability_select_public on public.professional_availability
  for select using (true);

create policy professional_availability_insert on public.professional_availability
  for insert with check (professional_id = auth.uid() and public.has_role('profissional'));

create policy professional_availability_update on public.professional_availability
  for update using (professional_id = auth.uid());

create policy professional_availability_delete on public.professional_availability
  for delete using (professional_id = auth.uid());

-- ----------------------------------------------------------------------------
-- requests
-- ----------------------------------------------------------------------------
alter table public.requests enable row level security;

create policy requests_select on public.requests
  for select using (
    tutor_id = auth.uid() or professional_id = auth.uid() or public.is_admin_or_supervisor()
  );

create policy requests_insert on public.requests
  for insert with check (tutor_id = auth.uid() and public.has_role('tutor'));

create policy requests_update on public.requests
  for update using (
    tutor_id = auth.uid() or professional_id = auth.uid() or public.is_admin_or_supervisor()
  );

-- sem policy de delete: cancelamento é feito via status, não remoção de linha.

-- ----------------------------------------------------------------------------
-- request_pets
-- ----------------------------------------------------------------------------
alter table public.request_pets enable row level security;

create policy request_pets_select on public.request_pets
  for select using (public.is_party_of_request(request_id) or public.is_admin_or_supervisor());

create policy request_pets_insert on public.request_pets
  for insert with check (
    exists (select 1 from public.requests r where r.id = request_id and r.tutor_id = auth.uid() and r.status = 'rascunho')
  );

create policy request_pets_delete on public.request_pets
  for delete using (
    exists (select 1 from public.requests r where r.id = request_id and r.tutor_id = auth.uid() and r.status = 'rascunho')
  );

-- ----------------------------------------------------------------------------
-- request_occurrences
-- ----------------------------------------------------------------------------
alter table public.request_occurrences enable row level security;

create policy request_occurrences_select on public.request_occurrences
  for select using (public.is_party_of_request(request_id) or public.is_admin_or_supervisor());

create policy request_occurrences_insert on public.request_occurrences
  for insert with check (public.is_party_of_request(request_id));

create policy request_occurrences_update on public.request_occurrences
  for update using (public.is_party_of_request(request_id) or public.is_admin_or_supervisor());

-- ----------------------------------------------------------------------------
-- messages
-- ----------------------------------------------------------------------------
alter table public.messages enable row level security;

create policy messages_select on public.messages
  for select using (
    public.is_party_of_request(request_id)
    or (
      public.is_admin_or_supervisor()
      and exists (select 1 from public.incidents i where i.request_id = messages.request_id)
    )
  );

create policy messages_insert on public.messages
  for insert with check (sender_id = auth.uid() and public.is_party_of_request(request_id));

-- sem policy de update/delete: chat é imutável.

-- ----------------------------------------------------------------------------
-- proposals
-- ----------------------------------------------------------------------------
alter table public.proposals enable row level security;

create policy proposals_select on public.proposals
  for select using (public.is_party_of_request(request_id) or public.is_admin_or_supervisor());

create policy proposals_insert on public.proposals
  for insert with check (
    created_by = auth.uid()
    and exists (select 1 from public.requests r where r.id = request_id and r.professional_id = auth.uid())
  );

-- sem policy de update: nova versão é sempre um novo insert, não edição.

-- ----------------------------------------------------------------------------
-- payments (mutação real via service_role nas Server Actions — ver ADR-005)
-- ----------------------------------------------------------------------------
alter table public.payments enable row level security;

create policy payments_select on public.payments
  for select using (public.is_party_of_request(request_id) or public.is_admin_or_supervisor());

-- sem policy de insert/update/delete para authenticated: só service_role grava.

-- ----------------------------------------------------------------------------
-- payouts
-- ----------------------------------------------------------------------------
alter table public.payouts enable row level security;

create policy payouts_select on public.payouts
  for select using (professional_id = auth.uid() or public.is_admin_or_supervisor());

-- solicitação de saque é uma Server Action com service_role que valida
-- status = 'disponivel' e ausência de incidente antes de fazer o update;
-- não expomos update direto de status para o client autenticado.

-- ----------------------------------------------------------------------------
-- professional_cancellations
-- ----------------------------------------------------------------------------
alter table public.professional_cancellations enable row level security;

create policy professional_cancellations_select on public.professional_cancellations
  for select using (
    professional_id = auth.uid()
    or public.is_party_of_request(request_id)
    or public.is_admin_or_supervisor()
  );

create policy professional_cancellations_update_admin on public.professional_cancellations
  for update using (public.is_admin_or_supervisor());

-- ----------------------------------------------------------------------------
-- no_show_records
-- ----------------------------------------------------------------------------
alter table public.no_show_records enable row level security;

create policy no_show_records_select on public.no_show_records
  for select using (public.is_party_of_request(request_id) or public.is_admin_or_supervisor());

create policy no_show_records_insert on public.no_show_records
  for insert with check (reported_by = auth.uid() and public.is_party_of_request(request_id));

-- ----------------------------------------------------------------------------
-- platform_parameters (leitura pública — transparência, seção 1.2)
-- ----------------------------------------------------------------------------
alter table public.platform_parameters enable row level security;

create policy platform_parameters_select_all on public.platform_parameters
  for select using (true);

create policy platform_parameters_insert_admin on public.platform_parameters
  for insert with check (public.has_role('administrador'));

create policy platform_parameters_update_admin on public.platform_parameters
  for update using (public.has_role('administrador'));

create policy platform_parameters_delete_admin on public.platform_parameters
  for delete using (public.has_role('administrador'));

-- ----------------------------------------------------------------------------
-- platform_parameters_log
-- ----------------------------------------------------------------------------
alter table public.platform_parameters_log enable row level security;

create policy platform_parameters_log_select on public.platform_parameters_log
  for select using (public.is_admin_or_supervisor());

-- sem policy de insert para authenticated: só a trigger (security definer) grava.

-- ----------------------------------------------------------------------------
-- incidents
-- ----------------------------------------------------------------------------
alter table public.incidents enable row level security;

create policy incidents_select on public.incidents
  for select using (public.is_party_of_request(request_id) or public.is_admin_or_supervisor());

create policy incidents_insert on public.incidents
  for insert with check (opened_by = auth.uid() and public.is_party_of_request(request_id));

create policy incidents_update on public.incidents
  for update using (public.is_admin_or_supervisor());

-- ----------------------------------------------------------------------------
-- incident_evidence
-- ----------------------------------------------------------------------------
alter table public.incident_evidence enable row level security;

create policy incident_evidence_select on public.incident_evidence
  for select using (
    exists (
      select 1 from public.incidents i
      where i.id = incident_evidence.incident_id
        and (public.is_party_of_request(i.request_id) or public.is_admin_or_supervisor())
    )
  );

create policy incident_evidence_insert on public.incident_evidence
  for insert with check (
    uploaded_by = auth.uid()
    and exists (
      select 1 from public.incidents i
      where i.id = incident_evidence.incident_id and public.is_party_of_request(i.request_id)
    )
  );

-- ----------------------------------------------------------------------------
-- reviews
-- ----------------------------------------------------------------------------
alter table public.reviews enable row level security;

create policy reviews_select_public on public.reviews
  for select using (true);  -- avaliações publicadas são visíveis no perfil

create policy reviews_insert on public.reviews
  for insert with check (
    reviewer_id = auth.uid()
    and public.is_party_of_request(request_id)
    and exists (select 1 from public.requests r where r.id = request_id and r.status = 'avaliacao')
  );

create policy reviews_update_own on public.reviews
  for update using (reviewer_id = auth.uid());

create policy reviews_update_response on public.reviews
  for update using (reviewee_id = auth.uid());  -- restrito ao campo response na aplicação

-- ----------------------------------------------------------------------------
-- notifications
-- ----------------------------------------------------------------------------
alter table public.notifications enable row level security;

create policy notifications_select_own on public.notifications
  for select using (profile_id = auth.uid());

create policy notifications_update_own on public.notifications
  for update using (profile_id = auth.uid());

create policy notifications_delete_own on public.notifications
  for delete using (profile_id = auth.uid());

-- sem policy de insert para authenticated: só service_role gera notificações.
