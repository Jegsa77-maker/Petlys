import type { Database } from "@/types/database";
import type { SupabaseClient } from "@supabase/supabase-js";

type ActionResult = { error: string | null };

/**
 * Insere e já aprova uma suspensão de conta (pula a etapa de recomendação
 * do Supervisor — aqui é o próprio Admin ou Supervisor decidindo direto).
 * Precisa das duas etapas porque o trigger que desativa os papéis
 * (account_suspensions_apply, 0011) só dispara em UPDATE de status, não
 * em INSERT.
 *
 * Não tem "use server" — é um helper puro, importado tanto por
 * lib/actions/admin.ts quanto lib/actions/supervisor.ts, nunca chamado
 * direto do client (evita expor um helper com parâmetro não-serializável,
 * o SupabaseClient, como Server Action de verdade).
 */
export async function suspendAccount(
  serviceClient: SupabaseClient<Database>,
  { targetProfileId, actorId, reason }: { targetProfileId: string; actorId: string; reason: string }
): Promise<string | null> {
  const { data: suspension, error: insertError } = await serviceClient
    .from("account_suspensions")
    .insert({ target_profile_id: targetProfileId, recommended_by: actorId, reason })
    .select("id")
    .single();

  if (insertError || !suspension) return "Não foi possível registrar a suspensão.";

  const { error: approveError } = await serviceClient
    .from("account_suspensions")
    .update({ status: "aprovada", decided_by: actorId, decided_at: new Date().toISOString() })
    .eq("id", suspension.id);

  if (approveError) return "Suspensão registrada, mas não foi possível aplicá-la.";

  return null;
}

/**
 * Desfaz uma suspensão aprovada (vira 'revogada', ver 0074) e reativa os
 * papéis que a conta tinha — espelho de suspendAccount. Sem isso, o
 * middleware (lib/supabase/middleware.ts) continuaria bloqueando pra
 * sempre: ele barra qualquer conta com uma linha 'aprovada', não olha
 * account_roles.active.
 */
export async function unsuspendAccount(
  serviceClient: SupabaseClient<Database>,
  { targetProfileId, actorId }: { targetProfileId: string; actorId: string }
): Promise<string | null> {
  const { error: revokeError } = await serviceClient
    .from("account_suspensions")
    .update({ status: "revogada", decided_by: actorId, decided_at: new Date().toISOString() })
    .eq("target_profile_id", targetProfileId)
    .eq("status", "aprovada");

  if (revokeError) return "Não foi possível desbloquear a conta.";

  const { error: reactivateError } = await serviceClient
    .from("account_roles")
    .update({ active: true })
    .eq("profile_id", targetProfileId);

  if (reactivateError) return "Suspensão revogada, mas não foi possível reativar os papéis.";

  return null;
}

/**
 * Impede desativar/excluir/suspender o último Administrador ativo do
 * sistema — sem essa trava seria possível travar o acesso administrativo
 * de toda a plataforma (por engano ou por um Supervisor sem essa noção).
 */
export async function lastActiveAdminGuard(
  serviceClient: SupabaseClient<Database>,
  targetProfileId: string
): Promise<ActionResult | null> {
  const { data: targetRoles } = await serviceClient
    .from("account_roles")
    .select("role")
    .eq("profile_id", targetProfileId)
    .eq("active", true);

  const isTargetAdmin = (targetRoles ?? []).some((r) => r.role === "administrador");
  if (!isTargetAdmin) return null;

  const { count } = await serviceClient
    .from("account_roles")
    .select("id", { count: "exact", head: true })
    .eq("role", "administrador")
    .eq("active", true)
    .neq("profile_id", targetProfileId);

  if ((count ?? 0) === 0) {
    return { error: "Não é possível remover o último Administrador ativo do sistema." };
  }
  return null;
}
