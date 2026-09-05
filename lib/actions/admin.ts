"use server";

import { createClient, createServiceRoleClient } from "@/lib/supabase/server";
import {
  upsertParameterSchema,
  createSupervisorSchema,
  createUserByAdminSchema,
  updateUserProfileSchema,
} from "@/lib/validations/admin";
import { revalidatePath } from "next/cache";
import type { AppRole, Database } from "@/types/database";
import type { SupabaseClient } from "@supabase/supabase-js";
import { suspendAccount, lastActiveAdminGuard } from "@/lib/actions/suspension-helpers";
import { seedDefaultAvailability } from "@/lib/domain/availability-defaults";

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
 *
 * Se a solicitação estava "em_disputa" (seção 3 — pagamento, qualidade
 * ou responsabilidade sob análise), o Admin PRECISA decidir o resultado
 * final: o contrato segue (concluído) ou é encerrado (cancelado) — são
 * as duas únicas saídas permitidas desse status. Se estava só
 * "incidente" (nunca virou disputa formal), a solicitação volta
 * sozinha pra onde estava antes de parar.
 */
export async function resolveIncident(
  incidentId: string,
  resolution: string,
  finalOutcome?: "concluido" | "cancelado"
): Promise<ActionResult> {
  const { user, isAdmin } = await requireAdmin();
  if (!user || !isAdmin) {
    return { error: "Apenas o Administrador pode encerrar um incidente." };
  }

  const supabase = await createClient();

  const { data: incident } = await supabase
    .from("incidents")
    .select("request_id, requests(status)")
    .eq("id", incidentId)
    .single();

  const requestStatus = (incident?.requests as { status: string } | null)?.status;

  if (requestStatus === "em_disputa" && !finalOutcome) {
    return { error: "Escolha o resultado final: contrato concluído ou cancelado." };
  }

  const { error } = await supabase
    .from("incidents")
    .update({ status: "resolvido", resolution, resolved_at: new Date().toISOString() })
    .eq("id", incidentId);

  if (error) return { error: "Não foi possível encerrar o incidente." };

  if (incident?.request_id) {
    if (requestStatus === "em_disputa" && finalOutcome) {
      await supabase.from("requests").update({ status: finalOutcome }).eq("id", incident.request_id);
    } else if (requestStatus === "incidente") {
      const { data: occurrences } = await supabase
        .from("request_occurrences")
        .select("status")
        .eq("request_id", incident.request_id)
        .in("status", ["agendado", "checkin", "em_andamento", "finalizacao"])
        .limit(1);

      const occurrenceStatus = occurrences?.[0]?.status as
        | "agendado"
        | "checkin"
        | "em_andamento"
        | "finalizacao"
        | undefined;
      const resumeStatus: "confirmado" | "checkin" | "em_andamento" | "finalizacao" =
        !occurrenceStatus || occurrenceStatus === "agendado" ? "confirmado" : occurrenceStatus;
      await supabase.from("requests").update({ status: resumeStatus }).eq("id", incident.request_id);
    }
    revalidatePath(`/solicitacoes/${incident.request_id}`);
  }

  revalidatePath("/incidentes");
  return { error: null };
}

/**
 * ⚠️ Mecanismo temporário de beta fechado, sem Onda 3 (financeiro real)
 * ainda existir: `acceptProposal` deixa a solicitação em
 * "aguardando_pagamento" esperando o webhook do gateway confirmar — que
 * não existe ainda. Pra destravar o teste com pessoas reais (pagamento
 * combinado por fora, Pix direto entre as partes), o Admin confirma
 * manualmente aqui. A transição `aguardando_pagamento -> confirmado` já
 * é permitida pela máquina de estados (0012) — nenhuma migration nova.
 *
 * Remover esta action (ou trocar por confirmação real via webhook) assim
 * que a Onda 3 tiver a Etapa 2 (Pix) funcionando de ponta a ponta.
 */
export async function confirmPaymentManually(requestId: string): Promise<ActionResult> {
  const { user, isAdmin } = await requireAdmin();
  if (!user || !isAdmin) {
    return { error: "Apenas o Administrador pode confirmar pagamento manualmente." };
  }

  const supabase = await createClient();

  const { data: request } = await supabase
    .from("requests")
    .select("status")
    .eq("id", requestId)
    .single();

  if (request?.status !== "aguardando_pagamento") {
    return { error: "Essa solicitação não está aguardando pagamento." };
  }

  const { error } = await supabase
    .from("requests")
    .update({ status: "confirmado" })
    .eq("id", requestId);

  if (error) {
    return { error: "Não foi possível confirmar o pagamento. Tente novamente." };
  }

  revalidatePath(`/solicitacoes/${requestId}`);
  return { error: null };
}

// ============================================================================
// Tela de Usuários (CRUD pra qualquer papel, inclusive outro Administrador)
// ============================================================================

/**
 * Cria uma conta de qualquer papel (Tutor, Profissional, Supervisor ou
 * Administrador) direto pelo Admin — mesmo mecanismo de conta interna já
 * usado só pra Supervisor (createSupervisor, acima): usuário+senha via
 * Admin API do Supabase, sem e-mail/telefone real, sem passar por
 * OTP/verificação. Generalizado aqui porque o Admin pediu poder criar
 * qualquer papel, não só Supervisor.
 */
export async function createUserByAdmin(input: unknown): Promise<ActionResult> {
  const parsed = createUserByAdminSchema.safeParse(input);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Dados do usuário inválidos" };
  }

  const { user, isAdmin } = await requireAdmin();
  if (!user || !isAdmin) {
    return { error: "Apenas o Administrador pode criar contas." };
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
    .insert({ profile_id: newProfileId, role: parsed.data.role });

  if (roleError) {
    return { error: "Conta criada, mas houve um erro ao atribuir o papel." };
  }

  if (parsed.data.role === "profissional") {
    await seedDefaultAvailability(serviceClient, newProfileId);
  }

  await serviceClient.from("admin_audit_log").insert({
    actor_id: user.id,
    action: "criar_usuario",
    target_profile_id: newProfileId,
    details: { username: parsed.data.username, role: parsed.data.role },
  });

  revalidatePath("/admin/usuarios");
  return { error: null };
}

/**
 * Ativa/desativa um papel já existente de uma conta. Protegido contra
 * autoexclusão e contra desativar o último Administrador ativo do
 * sistema — sem isso seria possível travar o próprio acesso admin.
 */
export async function setUserRoleActive(
  profileId: string,
  role: AppRole,
  active: boolean
): Promise<ActionResult> {
  const { user, isAdmin } = await requireAdmin();
  if (!user || !isAdmin) {
    return { error: "Apenas o Administrador pode alterar papéis." };
  }

  if (!active && role === "administrador") {
    if (profileId === user.id) {
      return { error: "Você não pode desativar seu próprio papel de Administrador." };
    }
    const guardError = await lastActiveAdminGuard(createServiceRoleClient(), profileId);
    if (guardError) return guardError;
  }

  const serviceClient = createServiceRoleClient();
  const { error } = await serviceClient
    .from("account_roles")
    .update({ active })
    .eq("profile_id", profileId)
    .eq("role", role);

  if (error) return { error: "Não foi possível atualizar o papel." };

  if (active && role === "profissional") {
    await seedDefaultAvailability(serviceClient, profileId);
  }

  await serviceClient.from("admin_audit_log").insert({
    actor_id: user.id,
    action: active ? "ativar_papel" : "desativar_papel",
    target_profile_id: profileId,
    details: { role },
  });

  revalidatePath(`/admin/usuarios/${profileId}`);
  revalidatePath("/admin/usuarios");
  return { error: null };
}

/**
 * Concede um papel novo pra uma conta que ainda não tem (ex.: tornar um
 * Tutor existente também Administrador). Se a conta já teve esse papel
 * antes (desativado), reativa em vez de duplicar a linha — a tabela tem
 * unique (profile_id, role).
 */
export async function addUserRole(profileId: string, role: AppRole): Promise<ActionResult> {
  const { user, isAdmin } = await requireAdmin();
  if (!user || !isAdmin) {
    return { error: "Apenas o Administrador pode conceder papéis." };
  }

  const serviceClient = createServiceRoleClient();
  const { error: insertError } = await serviceClient
    .from("account_roles")
    .insert({ profile_id: profileId, role });

  if (insertError) {
    const { error: reactivateError } = await serviceClient
      .from("account_roles")
      .update({ active: true })
      .eq("profile_id", profileId)
      .eq("role", role);
    if (reactivateError) return { error: "Não foi possível conceder o papel." };
  }

  if (role === "profissional") {
    await seedDefaultAvailability(serviceClient, profileId);
  }

  await serviceClient.from("admin_audit_log").insert({
    actor_id: user.id,
    action: "conceder_papel",
    target_profile_id: profileId,
    details: { role },
  });

  revalidatePath(`/admin/usuarios/${profileId}`);
  return { error: null };
}

/** Edita nome/telefone de qualquer conta — o Admin já podia ler qualquer
 * `profiles` (RLS 0009), isso só formaliza a escrita com auditoria. */
export async function updateUserProfileByAdmin(input: unknown): Promise<ActionResult> {
  const parsed = updateUserProfileSchema.safeParse(input);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Dados inválidos" };
  }

  const { user, isAdmin } = await requireAdmin();
  if (!user || !isAdmin) {
    return { error: "Apenas o Administrador pode editar contas." };
  }

  const supabase = await createClient();
  const { error } = await supabase
    .from("profiles")
    .update({ full_name: parsed.data.fullName, phone: parsed.data.phone || null })
    .eq("id", parsed.data.profileId);

  if (error) return { error: "Não foi possível salvar as alterações." };

  const serviceClient = createServiceRoleClient();
  await serviceClient.from("admin_audit_log").insert({
    actor_id: user.id,
    action: "editar_perfil",
    target_profile_id: parsed.data.profileId,
  });

  revalidatePath(`/admin/usuarios/${parsed.data.profileId}`);
  return { error: null };
}

/**
 * "Excluir" uma conta aqui nunca é DELETE físico — o perfil é referenciado
 * por dezenas de tabelas, várias compartilhadas com OUTRA pessoa (uma
 * avaliação que um Tutor escreveu sobre o Profissional, o histórico de
 * mensagens de uma conversa, um pagamento). Decisão explícita: anonimizar
 * o lado da conta excluída (nome/e-mail/telefone/CPF/endereço somem, vira
 * "Usuário removido") e bloquear o acesso pra sempre (suspensão aprovada,
 * mesmo mecanismo que já barra login no middleware) — o histórico
 * compartilhado com outras contas continua intacto, só sem os dados
 * pessoais de quem saiu. Bloqueia se houver pendência financeira (repasse
 * ou pagamento ainda não concluído) — dinheiro em trânsito não pode virar
 * órfão no meio do caminho.
 */
export async function deleteUserAccount(profileId: string): Promise<ActionResult> {
  const { user, isAdmin } = await requireAdmin();
  if (!user || !isAdmin) {
    return { error: "Apenas o Administrador pode excluir contas." };
  }

  if (profileId === user.id) {
    return { error: "Você não pode excluir sua própria conta." };
  }

  const serviceClient = createServiceRoleClient();

  const guardError = await lastActiveAdminGuard(serviceClient, profileId);
  if (guardError) return guardError;

  const hasPendency = await hasPendingFinancialActivity(serviceClient, profileId);
  if (hasPendency) {
    return {
      error: "Essa conta tem pendências financeiras (pagamento ou repasse ainda não concluído) — resolva antes de excluir.",
    };
  }

  const tombstoneEmail = `removido-${profileId}@deleted.plataformapet`;
  const { error: scrubError } = await serviceClient
    .from("profiles")
    .update({
      full_name: "Usuário removido",
      email: tombstoneEmail,
      phone: null,
      cpf_cnpj: null,
      birth_date: null,
      internal_username: null,
      address_zip: null,
      address_lat: null,
      address_lng: null,
    })
    .eq("id", profileId);

  if (scrubError) return { error: "Não foi possível excluir a conta." };

  await serviceClient
    .from("professional_profiles")
    .update({ bio: null, avatar_url: null, policies: null })
    .eq("profile_id", profileId);

  await serviceClient.from("tutor_favorites").delete().eq("tutor_profile_id", profileId);

  const suspendError = await suspendAccount(serviceClient, {
    targetProfileId: profileId,
    actorId: user.id,
    reason: "Conta excluída pelo Administrador — dados pessoais removidos, histórico compartilhado preservado.",
  });
  if (suspendError) return { error: suspendError };

  await serviceClient.from("admin_audit_log").insert({
    actor_id: user.id,
    action: "excluir_usuario",
    target_profile_id: profileId,
  });

  revalidatePath("/admin/usuarios");
  return { error: null };
}

/**
 * Pendência financeira = qualquer pagamento ainda não resolvido (numa
 * solicitação onde essa conta é tutor ou profissional) ou repasse ainda
 * não pago — dinheiro em trânsito não pode virar órfão numa exclusão.
 */
async function hasPendingFinancialActivity(
  serviceClient: SupabaseClient<Database>,
  profileId: string
): Promise<boolean> {
  const { data: requestsInvolved } = await serviceClient
    .from("requests")
    .select("id")
    .or(`tutor_id.eq.${profileId},professional_id.eq.${profileId}`);

  const requestIds = (requestsInvolved ?? []).map((r) => r.id);

  if (requestIds.length > 0) {
    const { count: pendingPayments } = await serviceClient
      .from("payments")
      .select("id", { count: "exact", head: true })
      .in("request_id", requestIds)
      .in("status", ["pendente", "processando", "contestado"]);
    if ((pendingPayments ?? 0) > 0) return true;
  }

  const { count: pendingPayouts } = await serviceClient
    .from("payouts")
    .select("id", { count: "exact", head: true })
    .eq("professional_id", profileId)
    .neq("status", "pago");
  if ((pendingPayouts ?? 0) > 0) return true;

  return false;
}
