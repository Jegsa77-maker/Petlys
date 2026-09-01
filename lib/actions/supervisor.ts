"use server";

import { createClient, createServiceRoleClient } from "@/lib/supabase/server";
import { recommendSuspensionSchema } from "@/lib/validations/admin";
import { revalidatePath } from "next/cache";

type ActionResult = { error: string | null };
type ResetPasswordResult = { error: string | null; temporaryPassword?: string };

async function requireSupervisorOrAdmin() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return { user: null, allowed: false };

  const { data: roles } = await supabase
    .from("account_roles")
    .select("role")
    .eq("profile_id", user.id)
    .eq("active", true)
    .in("role", ["supervisor", "administrador"]);

  return { user, allowed: (roles?.length ?? 0) > 0 };
}

/**
 * Supervisor assume um incidente e registra o tratamento (seção 10.2).
 * A decisão final de encerrar fica com o Admin (lib/actions/admin.ts).
 */
export async function takeIncident(incidentId: string): Promise<ActionResult> {
  const { user, allowed } = await requireSupervisorOrAdmin();
  if (!user || !allowed) {
    return { error: "Apenas Supervisor ou Administrador podem tratar incidentes." };
  }

  const supabase = await createClient();
  const { error } = await supabase
    .from("incidents")
    .update({ status: "em_analise", assigned_to: user.id })
    .eq("id", incidentId);

  if (error) return { error: "Não foi possível assumir o incidente." };

  revalidatePath("/incidentes");
  return { error: null };
}

/**
 * Escalar pro Administrador (seção 10.2) é o que caracteriza uma
 * disputa de verdade (seção 3: "pagamento, qualidade ou
 * responsabilidade sob análise administrativa") — por isso também
 * avança a solicitação de 'incidente' pra 'em_disputa' quando possível.
 */
export async function escalateIncident(incidentId: string): Promise<ActionResult> {
  const { user, allowed } = await requireSupervisorOrAdmin();
  if (!user || !allowed) {
    return { error: "Apenas Supervisor ou Administrador podem escalar incidentes." };
  }

  const supabase = await createClient();
  const { data: incident, error } = await supabase
    .from("incidents")
    .update({ status: "escalado" })
    .eq("id", incidentId)
    .select("request_id")
    .single();

  if (error) return { error: "Não foi possível escalar o incidente." };

  await supabase
    .from("requests")
    .update({ status: "em_disputa" })
    .eq("id", incident.request_id)
    .eq("status", "incidente");

  revalidatePath("/incidentes");
  return { error: null };
}

/**
 * Supervisor recomenda suspensão de uma conta — a suspensão efetiva só
 * acontece quando o Administrador aprova (decideSuspension, em admin.ts).
 */
export async function recommendSuspension(input: unknown): Promise<ActionResult> {
  const parsed = recommendSuspensionSchema.safeParse(input);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Dados inválidos" };
  }

  const { user, allowed } = await requireSupervisorOrAdmin();
  if (!user || !allowed) {
    return { error: "Apenas Supervisor ou Administrador podem recomendar suspensão." };
  }

  const supabase = await createClient();
  const { error } = await supabase.from("account_suspensions").insert({
    target_profile_id: parsed.data.targetProfileId,
    recommended_by: user.id,
    reason: parsed.data.reason,
    related_incident_id: parsed.data.relatedIncidentId ?? null,
  });

  if (error) return { error: "Não foi possível registrar a recomendação de suspensão." };

  revalidatePath(`/usuarios/${parsed.data.targetProfileId}`);
  return { error: null };
}

/**
 * Reset de senha — só se aplica a contas internas (Admin/Supervisor),
 * que têm usuário+senha. Tutor/Profissional entram por Google/Facebook
 * e não têm senha para redefinir.
 */
export async function resetInternalPassword(targetProfileId: string): Promise<ResetPasswordResult> {
  const { user, allowed } = await requireSupervisorOrAdmin();
  if (!user || !allowed) {
    return { error: "Apenas Supervisor ou Administrador podem resetar senha." };
  }

  const supabase = await createClient();
  const { data: target } = await supabase
    .from("profiles")
    .select("internal_username")
    .eq("id", targetProfileId)
    .single();

  if (!target?.internal_username) {
    return { error: "Esta conta não tem usuário/senha interno — só se aplica a Administrador/Supervisor." };
  }

  const serviceClient = createServiceRoleClient();
  const temporaryPassword = crypto.randomUUID().slice(0, 12);

  const { error } = await serviceClient.auth.admin.updateUserById(targetProfileId, {
    password: temporaryPassword,
  });

  if (error) {
    return { error: "Não foi possível resetar a senha." };
  }

  await serviceClient.from("admin_audit_log").insert({
    actor_id: user.id,
    action: "reset_senha",
    target_profile_id: targetProfileId,
  });

  // Retornada uma única vez para quem executou a ação — quem chama esta
  // Server Action é responsável por exibi-la uma vez e orientar a pessoa
  // a trocá-la no primeiro acesso. Nunca fica salva em texto plano.
  return { error: null, temporaryPassword };
}
