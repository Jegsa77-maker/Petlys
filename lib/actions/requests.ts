"use server";

import { createClient } from "@/lib/supabase/server";
import {
  createRequestSchema,
  sendMessageSchema,
  sendProposalSchema,
} from "@/lib/validations/requests";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

type ActionResult = { error: string | null };

/**
 * Tutor cria uma nova solicitação. Segue o ciclo de vida real (seção 3):
 * nasce em 'rascunho' (só o tutor vê), recebe os pets e ocorrências
 * enquanto ainda está em rascunho — a política de RLS de request_pets
 * exige exatamente esse status para aceitar o vínculo — e só then avança
 * para 'solicitacao_enviada'. Suporta múltiplos pets (seção 6.1) e
 * contratos recorrentes com múltiplas ocorrências (seção 6.2).
 */
export async function createRequest(input: unknown): Promise<ActionResult> {
  const parsed = createRequestSchema.safeParse(input);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Dados da solicitação inválidos" };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { error: "Sessão expirada. Faça login novamente." };
  }

  const { data: request, error: requestError } = await supabase
    .from("requests")
    .insert({
      tutor_id: user.id,
      professional_id: parsed.data.professionalId,
      category: parsed.data.category,
      status: "rascunho",
      is_recurring: parsed.data.isRecurring,
      occurrences_total: parsed.data.occurrencesTotal,
      is_visita_inicial: parsed.data.isVisitaInicial,
    })
    .select("id")
    .single();

  if (requestError || !request) {
    return { error: "Não foi possível criar a solicitação. Tente novamente." };
  }

  // Vínculo dos pets enquanto ainda está em 'rascunho' — a RLS de
  // request_pets valida tanto o status quanto a propriedade do pet
  // (ver 0010_fixes_from_review.sql).
  const petRows = parsed.data.petIds.map((petId) => ({ request_id: request.id, pet_id: petId }));
  const { error: petsError } = await supabase.from("request_pets").insert(petRows);
  if (petsError) {
    return { error: "Não foi possível vincular os pets selecionados à solicitação." };
  }

  const occurrenceRows = Array.from({ length: parsed.data.occurrencesTotal }).map((_, i) => ({
    request_id: request.id,
    sequence_number: i + 1,
    scheduled_at: parsed.data.firstOccurrenceAt,
    status: "agendado" as const,
  }));
  const { error: occurrencesError } = await supabase
    .from("request_occurrences")
    .insert(occurrenceRows);
  if (occurrencesError) {
    return { error: "Solicitação criada, mas houve um erro ao gerar as ocorrências." };
  }

  if (parsed.data.notes) {
    await supabase.from("messages").insert({
      request_id: request.id,
      sender_id: user.id,
      content: parsed.data.notes,
    });
  }

  // Só agora, com tudo montado, a solicitação sai do rascunho e o
  // profissional passa a enxergá-la (seção 3, estado 1 -> 2).
  const { error: statusError } = await supabase
    .from("requests")
    .update({ status: "solicitacao_enviada" })
    .eq("id", request.id);
  if (statusError) {
    return { error: "Solicitação montada, mas houve um erro ao enviá-la. Tente novamente." };
  }

  revalidatePath("/solicitacoes");
  redirect(`/solicitacoes/${request.id}`);
}

/**
 * Chat gratuito antes da confirmação (seção 3.7). Disponível para as
 * duas partes assim que a solicitação existe.
 */
export async function sendMessage(input: unknown): Promise<ActionResult> {
  const parsed = sendMessageSchema.safeParse(input);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Mensagem inválida" };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { error: "Sessão expirada. Faça login novamente." };
  }

  const { error } = await supabase.from("messages").insert({
    request_id: parsed.data.requestId,
    sender_id: user.id,
    content: parsed.data.content,
  });

  if (error) {
    return { error: "Não foi possível enviar a mensagem." };
  }

  revalidatePath(`/solicitacoes/${parsed.data.requestId}`);
  return { error: null };
}

/**
 * Profissional envia proposta (seção 3, estado 4). Congela a comissão
 * vigente no momento (commission_percent_snapshot) — nunca recalculada
 * depois, mesmo que o admin altere o parâmetro (ADR-003).
 */
export async function sendProposal(input: unknown): Promise<ActionResult> {
  const parsed = sendProposalSchema.safeParse(input);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Dados da proposta inválidos" };
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
    .select("id, category, professional_id")
    .eq("id", parsed.data.requestId)
    .single();

  if (!request || request.professional_id !== user.id) {
    return { error: "Você não tem permissão para propor este atendimento." };
  }

  const { data: existingProposals } = await supabase
    .from("proposals")
    .select("version")
    .eq("request_id", parsed.data.requestId)
    .order("version", { ascending: false })
    .limit(1);

  const nextVersion = (existingProposals?.[0]?.version ?? 0) + 1;

  const { data: commissionParam } = await supabase
    .from("platform_parameters")
    .select("valor1")
    .eq("chave1", "comissao_percentual")
    .eq("chave2", request.category)
    .eq("status", "ativo")
    .maybeSingle();

  const commissionPercent = commissionParam?.valor1 ? Number(commissionParam.valor1) : null;
  const validityAt = new Date(Date.now() + parsed.data.validityHours * 60 * 60 * 1000).toISOString();

  const { error: proposalError } = await supabase.from("proposals").insert({
    request_id: parsed.data.requestId,
    version: nextVersion,
    scope: parsed.data.scope,
    price: parsed.data.price,
    additional_fees: parsed.data.additionalFees,
    validity_at: validityAt,
    cancellation_policy: { texto: parsed.data.cancellationPolicyText },
    requires_full_payment: parsed.data.requiresFullPayment,
    deposit_percent: parsed.data.depositPercent ?? null,
    created_by: user.id,
  });

  if (proposalError) {
    return { error: "Não foi possível enviar a proposta." };
  }

  const { error: statusError } = await supabase
    .from("requests")
    .update({
      status: "proposta_enviada",
      commission_percent_snapshot: commissionPercent,
    })
    .eq("id", parsed.data.requestId);

  if (statusError) {
    return { error: "Proposta enviada, mas houve um erro ao atualizar o status." };
  }

  revalidatePath(`/solicitacoes/${parsed.data.requestId}`);
  return { error: null };
}

/**
 * Profissional recusa a solicitação. Recusa é ilimitada e sem penalidade
 * (seção 5, estado 8 "Decisão") — justificativa é sempre opcional.
 */
export async function declineRequest(requestId: string, reason?: string): Promise<ActionResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { error: "Sessão expirada. Faça login novamente." };
  }

  const { data: request } = await supabase
    .from("requests")
    .select("id, professional_id")
    .eq("id", requestId)
    .single();

  if (!request || request.professional_id !== user.id) {
    return { error: "Você não tem permissão para recusar esta solicitação." };
  }

  const { error } = await supabase
    .from("requests")
    .update({ status: "recusado" })
    .eq("id", requestId);

  if (error) {
    return { error: "Não foi possível recusar a solicitação." };
  }

  if (reason) {
    await supabase.from("messages").insert({
      request_id: requestId,
      sender_id: user.id,
      content: `Solicitação recusada. Motivo: ${reason}`,
    });
  }

  revalidatePath("/solicitacoes");
  revalidatePath(`/solicitacoes/${requestId}`);
  return { error: null };
}
/**
 * Tutor aceita a proposta vigente (seção 3, estado 4→5). O pagamento em
 * si é tratado na integração com o Pagar.me (próxima etapa) — aqui só
 * avançamos o status para 'aguardando_pagamento'.
 */
export async function acceptProposal(requestId: string, proposalId: string): Promise<ActionResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { error: "Sessão expirada. Faça login novamente." };
  }

  const { data: request } = await supabase
    .from("requests")
    .select("id, tutor_id")
    .eq("id", requestId)
    .single();

  if (!request || request.tutor_id !== user.id) {
    return { error: "Você não tem permissão para aceitar esta proposta." };
  }

  const { error: proposalError } = await supabase
    .from("proposals")
    .update({ accepted_at: new Date().toISOString() })
    .eq("id", proposalId);

  if (proposalError) {
    return { error: "Não foi possível registrar o aceite da proposta." };
  }

  const { error: statusError } = await supabase
    .from("requests")
    .update({ status: "aguardando_pagamento" })
    .eq("id", requestId);

  if (statusError) {
    return { error: "Proposta aceita, mas houve um erro ao atualizar o status." };
  }

  revalidatePath(`/solicitacoes/${requestId}`);
  return { error: null };
}
