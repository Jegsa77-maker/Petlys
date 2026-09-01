"use server";

import { createClient } from "@/lib/supabase/server";
import { openIncidentSchema } from "@/lib/validations/incidents";
import { defaultUrgencyForType } from "@/lib/domain/incident-types";
import { revalidatePath } from "next/cache";

type ActionResult = { error: string | null };

/**
 * Botão "Preciso de ajuda" (seção 8.2 da Especificação v2.0, item 2 da
 * Onda 4). A RLS (incidents_insert, 0009_rls_policies.sql) já exige
 * opened_by = auth.uid() e ser parte da solicitação — a checagem aqui é
 * só pra devolver uma mensagem de erro clara antes de bater no banco.
 * A urgência não é escolhida por quem abre: vem do tipo selecionado
 * (menos uma decisão pra tomar num momento de estresse).
 */
export async function openIncident(input: unknown): Promise<ActionResult> {
  const parsed = openIncidentSchema.safeParse(input);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Dados inválidos" };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { error: "Sessão expirada. Faça login novamente." };
  }

  const { data: request } = await supabase
    .from("requests")
    .select("id, tutor_id, professional_id, status")
    .eq("id", parsed.data.requestId)
    .single();

  if (!request || (request.tutor_id !== user.id && request.professional_id !== user.id)) {
    return { error: "Você não tem permissão para abrir um incidente nesta solicitação." };
  }

  const { error } = await supabase.from("incidents").insert({
    request_id: parsed.data.requestId,
    occurrence_id: parsed.data.occurrenceId ?? null,
    opened_by: user.id,
    type: parsed.data.type,
    urgency: defaultUrgencyForType(parsed.data.type),
    description: parsed.data.description,
  });

  if (error) {
    return { error: "Não foi possível registrar o incidente. Tente novamente." };
  }

  // A solicitação só entra visivelmente em "incidente" (seção 3) quando
  // já existe um atendimento em curso — antes disso (em_conversa,
  // proposta_enviada etc.) não existe transição permitida pra esse
  // status, e nem faria sentido. Melhor esforço: se falhar, o incidente
  // já foi registrado do mesmo jeito.
  if (["confirmado", "checkin", "em_andamento", "finalizacao"].includes(request.status)) {
    await supabase.from("requests").update({ status: "incidente" }).eq("id", parsed.data.requestId);
  }

  revalidatePath(`/solicitacoes/${parsed.data.requestId}`);
  return { error: null };
}

/**
 * Apelação (seção 12.3, item 3 da Onda 4) — uma das partes discorda de
 * como um incidente já resolvido foi encerrado. Reabre direto pro
 * Administrador (pula "em_analise": apelação já é, por natureza, um
 * pedido de revisão de segunda instância).
 *
 * Passa por uma função SECURITY DEFINER (0030_fix_appeal_incident_rls.sql)
 * em vez de um update() direto: a policy incidents_update só libera
 * Admin/Supervisor, então a própria parte nunca conseguiria de fato
 * apelar por RLS — descoberto testando este item (update "funcionava"
 * sem erro, mas afetava 0 linhas, mesma armadilha do bug de accept em
 * proposals já corrigido nesta sessão). A função valida a permissão e a
 * transição de status por dentro, sem abrir uma policy de UPDATE nova
 * que liberaria a linha inteira (todas as colunas) pra parte.
 */
export async function appealIncident(incidentId: string, reason: string): Promise<ActionResult> {
  if (!reason.trim()) {
    return { error: "Explique por que você está apelando dessa resolução." };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { error: "Sessão expirada. Faça login novamente." };
  }

  const { data: incident } = await supabase
    .from("incidents")
    .select("request_id")
    .eq("id", incidentId)
    .single();

  const { error } = await supabase.rpc("appeal_incident", {
    p_incident_id: incidentId,
    p_reason: reason,
  });

  if (error) {
    return { error: error.message || "Não foi possível registrar a apelação." };
  }

  if (incident?.request_id) {
    revalidatePath(`/solicitacoes/${incident.request_id}`);
  }
  return { error: null };
}
