"use server";

import { createClient } from "@/lib/supabase/server";
import {
  createRequestSchema,
  sendMessageSchema,
  sendProposalSchema,
  requestAdjustmentSchema,
  rescheduleOccurrenceSchema,
  updateRecurrenceSchema,
  startConversationSchema,
  RECURRENCE_INTERVAL_DAYS,
} from "@/lib/validations/requests";
import {
  missingProntuarioSections,
  PRONTUARIO_SECTION_LABEL,
} from "@/lib/domain/category-requirements";
import { getCategoryRequiredSections } from "@/lib/domain/category-requirements-store";
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

  // Requisitos dinâmicos por categoria (seção 6.4): bloqueia o envio se
  // faltar alguma seção do prontuário que a categoria escolhida exige —
  // ex.: passeador precisa saber comportamento/emergência antes de aceitar.
  const { data: selectedPets } = await supabase
    .from("pets")
    .select("id, name, health_info, behavior_info, routine_info, emergency_info")
    .in("id", parsed.data.petIds);

  const requiredSections = await getCategoryRequiredSections(supabase);
  for (const pet of selectedPets ?? []) {
    const missing = missingProntuarioSections(pet, parsed.data.category, requiredSections);
    if (missing.length > 0) {
      const labels = missing.map((s) => PRONTUARIO_SECTION_LABEL[s]).join(", ");
      return {
        error: `Complete o prontuário de ${pet.name} antes de solicitar esse serviço (falta: ${labels}). Vá em Meus pets > ${pet.name} para preencher.`,
      };
    }
  }

  // Visita inicial anterior com este mesmo par Tutor/Profissional (seção
  // 7.4/12.1) — vincula automaticamente o novo atendimento como
  // continuação, pra permitir abater o valor da visita quando o pagamento
  // real existir (Onda 3). Silencioso: não bloqueia nem exige nada do
  // Tutor, só registra a relação quando ela existe.
  let originRequestId: string | null = null;
  if (!parsed.data.isVisitaInicial) {
    const { data: priorVisita } = await supabase
      .from("requests")
      .select("id")
      .eq("tutor_id", user.id)
      .eq("professional_id", parsed.data.professionalId)
      .eq("is_visita_inicial", true)
      .in("status", ["avaliacao", "concluido"])
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    originRequestId = priorVisita?.id ?? null;
  }

  // Campos comuns aos dois caminhos (nova request ou formalização de uma
  // conversa prévia já existente, ver startConversation abaixo).
  const requestFields = {
    category: parsed.data.category,
    is_recurring: parsed.data.isRecurring,
    occurrences_total: parsed.data.occurrencesTotal,
    recurrence_interval: parsed.data.isRecurring ? parsed.data.recurrenceInterval : null,
    is_visita_inicial: parsed.data.isVisitaInicial,
    origin_request_id: originRequestId,
    address: parsed.data.address || null,
    category_answers: parsed.data.categoryAnswers,
    // Consentimento é validado pelo schema (prontuarioConsent === true) —
    // aqui só registramos o carimbo de quando foi dado (seção 6.4).
    prontuario_shared_at: new Date().toISOString(),
  };

  let request: { id: string } | null;
  let requestError;

  if (parsed.data.existingRequestId) {
    // Formalizando uma conversa prévia (rascunho já existente, chat
    // preservado) em vez de criar uma request nova do zero — o tutor
    // precisa ser o dono e ela ainda precisa estar em rascunho.
    const result = await supabase
      .from("requests")
      .update(requestFields)
      .eq("id", parsed.data.existingRequestId)
      .eq("tutor_id", user.id)
      .eq("status", "rascunho")
      .select("id")
      .single();
    request = result.data;
    requestError = result.error;
  } else {
    const result = await supabase
      .from("requests")
      .insert({ tutor_id: user.id, professional_id: parsed.data.professionalId, status: "rascunho", ...requestFields })
      .select("id")
      .single();
    request = result.data;
    requestError = result.error;
  }

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

  // Cada ocorrência é espaçada pela frequência escolhida (seção 6.2) — sem
  // isto, um contrato "recorrente" empilhava todas as N ocorrências na
  // mesma data/hora do primeiro atendimento.
  const intervalDays = RECURRENCE_INTERVAL_DAYS[parsed.data.recurrenceInterval];
  const firstOccurrenceMs = new Date(parsed.data.firstOccurrenceAt).getTime();
  const occurrenceRows = Array.from({ length: parsed.data.occurrencesTotal }).map((_, i) => ({
    request_id: request.id,
    sequence_number: i + 1,
    scheduled_at: new Date(firstOccurrenceMs + i * intervalDays * 24 * 60 * 60 * 1000).toISOString(),
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
 * "Conversar" no perfil do profissional — chat livre antes de formalizar
 * uma solicitação completa. Não é uma tabela nova: cria uma `requests`
 * mínima em rascunho (só categoria, sem pets/data/endereço), marcada
 * `is_conversa_previa`, seguindo o mesmo padrão já usado pra visita
 * inicial (outra linha de `requests`, nunca uma tabela paralela). O chat
 * já funciona nesse status sem nenhuma mudança de RLS — `is_party_of_request`
 * não olha `status` (0042_conversa_previa.sql).
 */
export async function startConversation(input: unknown): Promise<ActionResult> {
  const parsed = startConversationSchema.safeParse(input);
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

  // Já existe uma conversa aberta com esse profissional? Reaproveita em
  // vez de duplicar (clique repetido no botão "Conversar").
  const { data: existing } = await supabase
    .from("requests")
    .select("id")
    .eq("tutor_id", user.id)
    .eq("professional_id", parsed.data.professionalId)
    .eq("status", "rascunho")
    .eq("is_conversa_previa", true)
    .maybeSingle();

  if (existing) {
    redirect(`/solicitacoes/${existing.id}`);
  }

  const { data: created, error } = await supabase
    .from("requests")
    .insert({
      tutor_id: user.id,
      professional_id: parsed.data.professionalId,
      category: parsed.data.category,
      status: "rascunho",
      is_conversa_previa: true,
    })
    .select("id")
    .single();

  if (error || !created) {
    // Corrida: duas abas criando ao mesmo tempo esbarram no índice único
    // (requests_one_open_prechat_idx) — busca de novo e redireciona pra
    // a que ganhou, em vez de mostrar erro pro usuário.
    const { data: retryExisting } = await supabase
      .from("requests")
      .select("id")
      .eq("tutor_id", user.id)
      .eq("professional_id", parsed.data.professionalId)
      .eq("status", "rascunho")
      .eq("is_conversa_previa", true)
      .maybeSingle();
    if (retryExisting) {
      redirect(`/solicitacoes/${retryExisting.id}`);
    }
    return { error: "Não foi possível iniciar a conversa. Tente novamente." };
  }

  redirect(`/solicitacoes/${created.id}`);
}

/**
 * Encerra uma conversa prévia sem formalizar (tutor ou profissional
 * desistiram de seguir). Não reaproveita `declineRequest`: ele grava
 * status "recusado", que não é uma transição válida a partir de
 * "rascunho" (só solicitacao_enviada/em_conversa/proposta_enviada ->
 * recusado estão liberadas na máquina de estados) — aqui o destino
 * certo é "cancelado" (rascunho -> cancelado já é permitido, 0012).
 */
export async function endPreChatConversation(requestId: string): Promise<ActionResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { error: "Sessão expirada. Faça login novamente." };
  }

  const { data: request } = await supabase
    .from("requests")
    .select("tutor_id, professional_id, status")
    .eq("id", requestId)
    .single();

  if (!request || (request.tutor_id !== user.id && request.professional_id !== user.id)) {
    return { error: "Você não faz parte dessa conversa." };
  }
  if (request.status !== "rascunho") {
    return { error: "Essa conversa já virou uma solicitação." };
  }

  const { error } = await supabase.from("requests").update({ status: "cancelado" }).eq("id", requestId);
  if (error) {
    return { error: "Não foi possível encerrar a conversa. Tente novamente." };
  }

  revalidatePath("/solicitacoes");
  revalidatePath(`/solicitacoes/${requestId}`);
  return { error: null };
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
    // Agenda flexível: nunca bloqueia — só registra o que o Profissional
    // propôs além do horário que o Tutor já tinha pedido (seção 1.2).
    proposed_scheduled_at:
      parsed.data.scheduleChoice === "horario_exato" ? parsed.data.proposedScheduledAt : null,
    proposed_period: parsed.data.scheduleChoice === "periodo" ? parsed.data.proposedPeriod : null,
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

  // Expiração automática (seção 12.1, item 5) — revalidado no servidor,
  // nunca só na interface: uma proposta vencida não pode ser aceita, mesmo
  // que o botão ainda apareça numa tela desatualizada.
  const { data: proposalCheck } = await supabase
    .from("proposals")
    .select("validity_at")
    .eq("id", proposalId)
    .single();

  if (proposalCheck && new Date(proposalCheck.validity_at) < new Date()) {
    return { error: "Essa proposta expirou. Peça ao profissional para enviar uma nova." };
  }

  const { data: proposal, error: proposalError } = await supabase
    .from("proposals")
    .update({ accepted_at: new Date().toISOString() })
    .eq("id", proposalId)
    .select("proposed_scheduled_at")
    .single();

  if (proposalError) {
    return { error: "Não foi possível registrar o aceite da proposta." };
  }

  // Agenda flexível (seção 1.2): se o Profissional propôs um horário
  // exato diferente, desloca TODAS as ocorrências do contrato pela mesma
  // diferença, preservando o espaçamento da recorrência — não mexe em
  // nada quando a proposta só tinha um período (isso é só informativo,
  // o horário exato se resolve pelo chat sem travar ninguém).
  if (proposal?.proposed_scheduled_at) {
    const { data: occurrences } = await supabase
      .from("request_occurrences")
      .select("id, scheduled_at, sequence_number")
      .eq("request_id", requestId)
      .order("sequence_number", { ascending: true });

    const first = occurrences?.[0];
    if (first) {
      const deltaMs = new Date(proposal.proposed_scheduled_at).getTime() - new Date(first.scheduled_at).getTime();
      if (deltaMs !== 0) {
        await Promise.all(
          (occurrences ?? []).map((occ) =>
            supabase
              .from("request_occurrences")
              .update({ scheduled_at: new Date(new Date(occ.scheduled_at).getTime() + deltaMs).toISOString() })
              .eq("id", occ.id)
          )
        );
      }
    }
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

/**
 * Tutor pede ajuste numa proposta em vez de aceitar ou recusar de vez
 * (seção 12.1, item 5). Devolve a solicitação pra conversa — o Profissional
 * pode então enviar uma nova versão da proposta. Registra o pedido como
 * mensagem no chat, pra ficar no histórico visível pras duas partes.
 */
export async function requestAdjustment(input: unknown): Promise<ActionResult> {
  const parsed = requestAdjustmentSchema.safeParse(input);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Descreva o ajuste desejado" };
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
    .select("id, tutor_id, status")
    .eq("id", parsed.data.requestId)
    .single();

  if (!request || request.tutor_id !== user.id) {
    return { error: "Você não tem permissão para pedir ajuste nesta solicitação." };
  }

  const { error: messageError } = await supabase.from("messages").insert({
    request_id: parsed.data.requestId,
    sender_id: user.id,
    content: `Pedido de ajuste na proposta: ${parsed.data.feedback}`,
  });
  if (messageError) {
    return { error: "Não foi possível registrar o pedido de ajuste." };
  }

  const { error: statusError2 } = await supabase
    .from("requests")
    .update({ status: "em_conversa" })
    .eq("id", parsed.data.requestId);
  if (statusError2) {
    return { error: "Pedido registrado no chat, mas houve um erro ao atualizar o status." };
  }

  revalidatePath(`/solicitacoes/${parsed.data.requestId}`);
  return { error: null };
}

/**
 * Reagendar uma ocorrência específica (seção 12.1, item 7 — recorrência
 * avançada). Nunca bloqueia: qualquer parte da solicitação pode mover uma
 * ocorrência ainda não iniciada. Ocorrências em andamento/concluídas ficam
 * intocáveis — reagendar o passado não faz sentido.
 */
export async function rescheduleOccurrence(input: unknown): Promise<ActionResult> {
  const parsed = rescheduleOccurrenceSchema.safeParse(input);
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

  const { data: occurrence } = await supabase
    .from("request_occurrences")
    .select("id, request_id, status")
    .eq("id", parsed.data.occurrenceId)
    .single();

  if (!occurrence) {
    return { error: "Ocorrência não encontrada." };
  }
  if (occurrence.status !== "agendado") {
    return { error: "Só é possível reagendar uma ocorrência que ainda não começou." };
  }

  const { error } = await supabase
    .from("request_occurrences")
    .update({ scheduled_at: new Date(parsed.data.newScheduledAt).toISOString() })
    .eq("id", parsed.data.occurrenceId);

  if (error) {
    return { error: "Não foi possível reagendar. Verifique se você faz parte desta solicitação." };
  }

  revalidatePath(`/solicitacoes/${occurrence.request_id}`);
  return { error: null };
}

/**
 * Muda a frequência de um contrato recorrente dali pra frente, sem
 * corromper ocorrências já executadas (seção 12.1, item 7). Recalcula as
 * datas só das ocorrências ainda 'agendado', ancoradas na próxima que
 * ainda vai acontecer — o histórico (concluído/cancelado) nunca é tocado.
 */
export async function updateRecurrence(input: unknown): Promise<ActionResult> {
  const parsed = updateRecurrenceSchema.safeParse(input);
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
    .select("id, is_recurring")
    .eq("id", parsed.data.requestId)
    .single();

  if (!request || !request.is_recurring) {
    return { error: "Esta solicitação não é um contrato recorrente." };
  }

  const { data: pendingOccurrences } = await supabase
    .from("request_occurrences")
    .select("id, scheduled_at, sequence_number")
    .eq("request_id", parsed.data.requestId)
    .eq("status", "agendado")
    .order("sequence_number", { ascending: true });

  if (!pendingOccurrences || pendingOccurrences.length === 0) {
    return { error: "Não há ocorrências futuras para reorganizar." };
  }

  const intervalDays = RECURRENCE_INTERVAL_DAYS[parsed.data.newInterval];
  const anchorMs = new Date(pendingOccurrences[0].scheduled_at).getTime();

  const updates = pendingOccurrences.map((occ, i) => ({
    id: occ.id,
    scheduled_at: new Date(anchorMs + i * intervalDays * 24 * 60 * 60 * 1000).toISOString(),
  }));

  const updateResults = await Promise.all(
    updates.map((u) =>
      supabase.from("request_occurrences").update({ scheduled_at: u.scheduled_at }).eq("id", u.id)
    )
  );
  const failedUpdate = updateResults.find((r) => r.error);

  if (failedUpdate) {
    return { error: "Não foi possível atualizar as próximas ocorrências." };
  }

  const { error: requestError } = await supabase
    .from("requests")
    .update({ recurrence_interval: parsed.data.newInterval })
    .eq("id", parsed.data.requestId);
  if (requestError) {
    return { error: "Ocorrências atualizadas, mas houve um erro ao salvar a nova frequência." };
  }

  revalidatePath(`/solicitacoes/${parsed.data.requestId}`);
  return { error: null };
}
