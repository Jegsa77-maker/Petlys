"use server";

import { createClient, createServiceRoleClient } from "@/lib/supabase/server";
import {
  upsertParameterSchema,
  createSupervisorSchema,
} from "@/lib/validations/admin";
import { revalidatePath } from "next/cache";

type ActionResult = { error: string | null };

async function requireAdmin() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return { user: null, isAdmin: false };

  const { data: role } = await supabase
    .from("account_roles")
    .select("role")
    .eq("profile_id", user.id)
    .eq("role", "administrador")
    .eq("active", true)
    .maybeSingle();

  return { user, isAdmin: !!role };
}

/**
 * Cria ou substitui um parâmetro comercial (seção 9.4). Cada alteração já
 * gera automaticamente uma linha em platform_parameters_log, via trigger
 * (0006_platform_parameters.sql) — não precisamos gravar o log aqui.
 * A confirmação ("tem certeza?") acontece na UI antes de chamar esta action.
 */
export async function upsertParameter(input: unknown): Promise<ActionResult> {
  const parsed = upsertParameterSchema.safeParse(input);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Dados do parâmetro inválidos" };
  }

  const { user, isAdmin } = await requireAdmin();
  if (!user || !isAdmin) {
    return { error: "Apenas o Administrador pode configurar parâmetros." };
  }

  const supabase = await createClient();

  if (parsed.data.id) {
    const { error } = await supabase
      .from("platform_parameters")
      .update({
        valor1: parsed.data.valor1,
        valor2: parsed.data.valor2 ?? null,
        valor3: parsed.data.valor3 ?? null,
        explicacao: parsed.data.explicacao,
        vigencia_inicio: parsed.data.vigenciaInicio,
        atualizado_por: user.id,
        atualizado_em: new Date().toISOString(),
      })
      .eq("id", parsed.data.id);

    if (error) return { error: "Não foi possível atualizar o parâmetro." };
  } else {
    const { error } = await supabase.from("platform_parameters").insert({
      chave1: parsed.data.chave1,
      chave2: parsed.data.chave2 ?? "",
      chave3: parsed.data.chave3 ?? "",
      valor1: parsed.data.valor1,
      valor2: parsed.data.valor2 ?? null,
      valor3: parsed.data.valor3 ?? null,
      explicacao: parsed.data.explicacao,
      vigencia_inicio: parsed.data.vigenciaInicio,
      atualizado_por: user.id,
    });

    if (error) return { error: "Não foi possível criar o parâmetro. Verifique se já não existe um ativo com essas chaves." };
  }

  revalidatePath("/parametros");
  return { error: null };
}

/**
 * "Excluir" aqui é sempre soft-delete (status -> 'substituido'), nunca
 * DELETE físico. platform_parameters_log referencia parameter_id sem
 * cascade, e como toda criação já grava uma linha de log, um DELETE de
 * verdade sempre esbarra em violação de foreign key — além de destruir
 * histórico de auditoria que o próprio schema foi desenhado pra manter
 * (ver parameter_lifecycle em 0001, e platform_parameters_log em 0006).
 */
export async function deleteParameter(id: string): Promise<ActionResult> {
  const { isAdmin } = await requireAdmin();
  if (!isAdmin) {
    return { error: "Apenas o Administrador pode excluir parâmetros." };
  }

  const supabase = await createClient();
  const { error } = await supabase
    .from("platform_parameters")
    .update({ status: "substituido" })
    .eq("id", id);

  if (error) return { error: "Não foi possível excluir o parâmetro." };

  revalidatePath("/parametros");
  return { error: null };
}

/**
 * Cria uma conta interna de Supervisor (usuário + senha, seção 10.2).
 * Usa o Admin API do Supabase (service_role) para criar o auth.users
 * diretamente já com senha e e-mail confirmado — não é login social,
 * então não passa pelo fluxo de OTP/verificação de Tutor/Profissional.
 */
export async function createSupervisor(input: unknown): Promise<ActionResult> {
  const parsed = createSupervisorSchema.safeParse(input);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Dados do supervisor inválidos" };
  }

  const { user, isAdmin } = await requireAdmin();
  if (!user || !isAdmin) {
    return { error: "Apenas o Administrador pode criar contas de Supervisor." };
  }

  const serviceClient = createServiceRoleClient();
  const syntheticEmail = `${parsed.data.username}@internal.plataformapet`;

  const { data: created, error: createError } = await serviceClient.auth.admin.createUser({
    email: syntheticEmail,
    password: parsed.data.password,
    email_confirm: true,
    user_metadata: { full_name: parsed.data.fullName },
  });

  if (createError || !created.user) {
    return { error: "Não foi possível criar a conta. O usuário já pode estar em uso." };
  }

  const newProfileId = created.user.id;

  const { error: profileError } = await serviceClient
    .from("profiles")
    .update({
      full_name: parsed.data.fullName,
      internal_username: parsed.data.username,
      phone_verified_at: new Date().toISOString(),
      email_verified_at: new Date().toISOString(),
    })
    .eq("id", newProfileId);

  if (profileError) {
    return { error: "Conta criada, mas houve um erro ao completar o perfil." };
  }

  const { error: roleError } = await serviceClient
    .from("account_roles")
    .insert({ profile_id: newProfileId, role: "supervisor" });

  if (roleError) {
    return { error: "Conta criada, mas houve um erro ao atribuir o papel de Supervisor." };
  }

  await serviceClient.from("supervisor_grants").insert({
    supervisor_profile_id: newProfileId,
    created_by_admin_id: user.id,
  });

  await serviceClient.from("admin_audit_log").insert({
    actor_id: user.id,
    action: "criar_supervisor",
    target_profile_id: newProfileId,
    details: { username: parsed.data.username },
  });

  revalidatePath("/supervisores");
  return { error: null };
}

export async function revokeSupervisor(supervisorProfileId: string): Promise<ActionResult> {
  const { user, isAdmin } = await requireAdmin();
  if (!user || !isAdmin) {
    return { error: "Apenas o Administrador pode revogar contas de Supervisor." };
  }

  const serviceClient = createServiceRoleClient();

  await serviceClient
    .from("account_roles")
    .update({ active: false })
    .eq("profile_id", supervisorProfileId)
    .eq("role", "supervisor");

  await serviceClient
    .from("supervisor_grants")
    .update({ revoked_at: new Date().toISOString(), revoked_by_admin_id: user.id })
    .eq("supervisor_profile_id", supervisorProfileId)
    .is("revoked_at", null);

  await serviceClient.from("admin_audit_log").insert({
    actor_id: user.id,
    action: "revogar_supervisor",
    target_profile_id: supervisorProfileId,
  });

  revalidatePath("/supervisores");
  return { error: null };
}

/**
 * Decisão final sobre uma recomendação de suspensão (seção 10.2). Se
 * aprovada, o trigger account_suspensions_apply desativa os papéis da
 * conta automaticamente (0011_admin_supervisor_accounts.sql).
 */
export async function decideSuspension(
  suspensionId: string,
  decision: "aprovada" | "rejeitada"
): Promise<ActionResult> {
  const { user, isAdmin } = await requireAdmin();
  if (!user || !isAdmin) {
    return { error: "Apenas o Administrador pode decidir uma suspensão." };
  }

  const supabase = await createClient();
  const { error } = await supabase
    .from("account_suspensions")
    .update({ status: decision, decided_by: user.id, decided_at: new Date().toISOString() })
    .eq("id", suspensionId);

  if (error) return { error: "Não foi possível registrar a decisão." };

  const serviceClient = createServiceRoleClient();
  await serviceClient.from("admin_audit_log").insert({
    actor_id: user.id,
    action: decision === "aprovada" ? "aprovar_suspensao" : "rejeitar_suspensao",
    details: { suspension_id: suspensionId },
  });

  revalidatePath("/incidentes");
  return { error: null };
}

/**
 * Encerra um incidente (só Admin toma a decisão final — ver RLS
 * 0009_rls_policies.sql, incidents_update). Libera o bloqueio de saque
 * automaticamente via trigger (0007_safety_and_reputation.sql).
 */
export async function resolveIncident(incidentId: string, resolution: string): Promise<ActionResult> {
  const { user, isAdmin } = await requireAdmin();
  if (!user || !isAdmin) {
    return { error: "Apenas o Administrador pode encerrar um incidente." };
  }

  const supabase = await createClient();
  const { error } = await supabase
    .from("incidents")
    .update({ status: "resolvido", resolution, resolved_at: new Date().toISOString() })
    .eq("id", incidentId);

  if (error) return { error: "Não foi possível encerrar o incidente." };

  revalidatePath("/incidentes");
  return { error: null };
}
