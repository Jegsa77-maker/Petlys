-- ============================================================================
-- 0085_certifications_public_and_notify.sql
-- Habilitação de profissional (2026-09-06, feedback do usuário): deixa de
-- ser um gate de aprovação pra publicar serviço (ver createService em
-- lib/actions/services.ts, checagem removida no código) — em vez disso o
-- documento fica visível pro Tutor consultar por conta própria, e o
-- Admin/Supervisor é avisado por notificação (mesmo padrão de incidente,
-- 0028_preciso_de_ajuda.sql) pra revisar quando quiser, sem bloquear nada.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- professional_certifications — reabre SELECT pra qualquer um (era só dono
-- + admin/supervisor). Documento de habilitação (ex.: CRMV) agora é
-- informação pública de confiança, mesmo espírito de professional_skills/
-- professional_media (0080/0081): "é literalmente o que aparece no perfil
-- público/card do serviço".
-- ----------------------------------------------------------------------------
drop policy professional_certifications_select on public.professional_certifications;

create policy professional_certifications_select on public.professional_certifications
  for select using (true);

-- ----------------------------------------------------------------------------
-- Storage — professional-certifications vira bucket público (era privado
-- com link assinado só pro dono/admin) — mesma lógica de professional-
-- gallery (0080): o arquivo em si só é útil se o Tutor conseguir abrir.
-- ----------------------------------------------------------------------------
update storage.buckets set public = true where id = 'professional-certifications';

drop policy professional_certifications_storage_select on storage.objects;

create policy professional_certifications_storage_select on storage.objects
  for select using (bucket_id = 'professional-certifications');

-- Insert/delete continuam só pro dono (política antiga preservada, não
-- recriada aqui).

-- ----------------------------------------------------------------------------
-- Notificação automática: documento novo avisa todo Admin/Supervisor ativo
-- — mesmo padrão de notify_new_incident() (0028_preciso_de_ajuda.sql).
-- ----------------------------------------------------------------------------
create or replace function public.notify_new_certification()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.notifications (profile_id, type, payload)
  select profile_id, 'certificacao_enviada', jsonb_build_object(
    'certification_id', new.id,
    'professional_id', new.professional_id,
    'category', new.category
  )
  from public.account_roles
  where role in ('administrador', 'supervisor') and active;
  return new;
end;
$$;

create trigger professional_certifications_notify after insert on public.professional_certifications
  for each row execute function public.notify_new_certification();
