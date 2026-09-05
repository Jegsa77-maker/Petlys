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
  declineRequestSchema,
  substituteProfessionalSchema,
  proposeScopeChangeSchema,
  respondScopeChangeSchema,
  RECURRENCE_INTERVAL_DAYS,
} from "@/lib/validations/requests";
import {
  missingProntuarioSections,
  PRONTUARIO_SECTION_LABEL,
} from "@/lib/domain/category-requirements";
import { getCategoryRequiredSections } from "@/lib/domain/category-requirements-store";
import { checkAvailability } from "@/lib/domain/availability-check";
import { trackEventServer } from "@/lib/analytics/track-server";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import type { ServiceCategory } from "@/types/database";

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

  // Disponibilidade real do profissional (2026-09-05: "o tutor deve ver a
  // disponibilidade somente na solicitação") — o formulário já avisa isso
  // na hora, mas quem decide de verdade é o servidor, nunca o cliente.
  const { data: availabilitySlots } = await supabase
    .from("professional_availability")
    .select("weekday, start_time, end_time, date_override, blocked")
    .eq("professional_id", parsed.data.professionalId);

  const recurringWindows = (availabilitySlots ?? [])
    .filter((s) => s.weekday !== null)
    .map((s) => ({ weekday: s.weekday!, startTime: s.start_time!, endTime: s.end_time! }));
  const availabilityBlocks = (availabilitySlots ?? [])
    .filter((s) => s.date_override !== null)
    .map((s) => ({ date: s.date_override!, startTime: s.start_time, endTime: s.end_time }));

  const availability = checkAvailability(
    new Date(parsed.data.firstOccurrenceAt),
    recurringWindows,
    availabilityBlocks
  );
  if (!availability.available) {
    return { error: `${availability.reason} Escolha outro horário.` };
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
  if (parsed.data.existingRequestId) {
    // Preserva o link já gravado no rascunho — startConversation/
    // acceptReferral/substituteProfessional criam esse rascunho com
    // origin_request_id preenchido antes do tutor chegar aqui. Sem isso, o
    // auto-lookup de visita inicial abaixo roda de novo e sobrescreve com
    // null (bug real encontrado: esse par tutor/novo-profissional nunca
    // teve visita inicial, então o lookup nunca acharia nada e apagaria o
    // vínculo de indicação/substituição).
    const { data: draft } = await supabase
      .from("requests")
      .select("origin_request_id")
      .eq("id", parsed.data.existingRequestId)
      .single();
    originRequestId = draft?.origin_request_id ?? null;
  }
  if (!originRequestId && !parsed.data.isVisitaInicial) {
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

  void trackEventServer("request_submitted", {
    profile_id: user.id,
    professional_id: parsed.data.professionalId,
    request_id: request.id,
    category: parsed.data.category,
    metadata: { existing_request_id: parsed.data.existingRequestId ?? null },
  });

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
export async function declineRequest(input: unknown): Promise<ActionResult> {
  const parsed = declineRequestSchema.safeParse(input);
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
    .select("id, professional_id, category")
    .eq("id", parsed.data.requestId)
    .single();

  if (!request || request.professional_id !== user.id) {
    return { error: "Você não tem permissão para recusar esta solicitação." };
  }

  if (parsed.data.referredProfessionalId) {
    const eligible = await isEligibleColleague(
      supabase,
      request.category,
      parsed.data.referredProfessionalId,
      user.id
    );
    if (!eligible) {
      return { error: "Profissional indicado não está disponível para esta categoria." };
    }
  }

  const { error } = await supabase
    .from("requests")
    .update({
      status: "recusado",
      referred_professional_id: parsed.data.referredProfessionalId ?? null,
    })
    .eq("id", parsed.data.requestId);

  if (error) {
    return { error: "Não foi possível recusar a solicitação." };
  }

  if (parsed.data.reason || parsed.data.referredProfessionalId) {
    const suffix = parsed.data.referredProfessionalId
      ? " Um colega foi indicado como alternativa."
      : "";
    await supabase.from("messages").insert({
      request_id: parsed.data.requestId,
      sender_id: user.id,
      content: `Solicitação recusada.${parsed.data.reason ? ` Motivo: ${parsed.data.reason}.` : ""}${suffix}`,
    });
  }

  revalidatePath("/solicitacoes");
  revalidatePath(`/solicitacoes/${parsed.data.requestId}`);
  return { error: null };
}

/**
 * Colega da mesma categoria, com serviço ativo, diferente de quem está
 * indicando/sendo substituído (itens 25-26 e 29). Consulta simplificada —
 * a sofisticação de distância/nota de /buscar não é necessária aqui.
 */
async function isEligibleColleague(
  supabase: Awaited<ReturnType<typeof createClient>>,
  category: ServiceCategory,
  candidateId: string,
  excludeProfessionalId: string
): Promise<boolean> {
  if (candidateId === excludeProfessionalId) return false;
  const { data } = await supabase
    .from("professional_services")
    .select("id")
    .eq("professional_id", candidateId)
    .eq("category", category)
    .eq("active", true)
    .limit(1)
    .maybeSingle();
  return Boolean(data);
}

/**
 * Rascunho de conversa prévia vinculado à request original via
 * origin_request_id (mesmo padrão de startConversation, 0055) —
 * reaproveitado por acceptReferral e substituteProfessional. No máximo um
 * rascunho aberto por par (tutor, profissional); corrida tratada com retry
 * no índice único.
 */
async function createLinkedPrechat(
  supabase: Awaited<ReturnType<typeof createClient>>,
  tutorId: string,
  professionalId: string,
  category: ServiceCategory,
  originRequestId: string
): Promise<{ id: string } | null> {
  const { data: existing } = await supabase
    .from("requests")
    .select("id")
    .eq("tutor_id", tutorId)
    .eq("professional_id", professionalId)
    .eq("status", "rascunho")
    .eq("is_conversa_previa", true)
    .maybeSingle();
  if (existing) return existing;

  const { data: created } = await supabase
    .from("requests")
    .insert({
      tutor_id: tutorId,
      professional_id: professionalId,
      category,
      status: "rascunho",
      is_conversa_previa: true,
      origin_request_id: originRequestId,
    })
    .select("id")
    .single();
  if (created) return created;

  const { data: retry } = await supabase
    .from("requests")
    .select("id")
    .eq("tutor_id", tutorId)
    .eq("professional_id", professionalId)
    .eq("status", "rascunho")
    .eq("is_conversa_previa", true)
    .maybeSingle();
  return retry ?? null;
}

/**
 * Profissionais elegíveis pra indicação/substituição — mesma categoria,
 * serviço ativo, exceto o próprio. Usado pela UI de indicação (decline) e
 * de substituição pós-aceite.
 */
export async function listEligibleColleagues(category: ServiceCategory, excludeProfessionalId: string) {
  const supabase = await createClient();
  const { data } = await supabase
    .from("professional_services")
    .select("professional_id, profiles(id, full_name)")
    .eq("category", category)
    .eq("active", true)
    .neq("professional_id", excludeProfessionalId);

  const seen = new Set<string>();
  const colleagues = (data ?? [])
    .filter((r) => r.profiles && !seen.has(r.profiles.id) && seen.add(r.profiles.id))
    .map((r) => ({ id: r.profiles!.id, fullName: r.profiles!.full_name }));

  if (colleagues.length === 0) return [];

  // professional_services e professional_profiles não têm FK direta entre
  // si (ambas apontam pra profiles separadamente) — busca o avatar à parte
  // em vez de tentar um embed que o PostgREST não consegue resolver sozinho.
  const { data: avatars } = await supabase
    .from("professional_profiles")
    .select("profile_id, avatar_url")
    .in(
      "profile_id",
      colleagues.map((c) => c.id)
    );
  const avatarByProfileId = new Map((avatars ?? []).map((a) => [a.profile_id, a.avatar_url]));

  return colleagues.map((c) => ({ ...c, avatarUrl: avatarByProfileId.get(c.id) ?? null }));
}

/**
 * Tutor aceita a indicação de colega (item 27) — cria a conversa prévia
 * vinculada à request original (nunca muta professional_id na request
 * antiga, item 28). Só o Tutor pode chamar: requests_insert exige
 * tutor_id = auth.uid(), então nem faria sentido o Profissional tentar.
 */
export async function acceptReferral(requestId: string): Promise<ActionResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { error: "Sessão expirada. Faça login novamente." };
  }

  const { data: original } = await supabase
    .from("requests")
    .select("id, tutor_id, category, status, referred_professional_id")
    .eq("id", requestId)
    .single();

  if (!original || original.tutor_id !== user.id) {
    return { error: "Você não tem permissão para aceitar essa indicação." };
  }
  if (!original.referred_professional_id || !["recusado", "cancelado"].includes(original.status)) {
    return { error: "Não há indicação disponível para essa solicitação." };
  }

  const draft = await createLinkedPrechat(
    supabase,
    user.id,
    original.referred_professional_id,
    original.category,
    requestId
  );
  if (!draft) {
    return { error: "Não foi possível iniciar a conversa com o profissional indicado." };
  }

  redirect(`/solicitacoes/${draft.id}`);
}

/**
 * Substituição pós-aceite (item 29 — o caso mais delicado, já com proposta
 * aceita/em andamento). Cancela a request original (transições já
 * permitidas: confirmado/checkin desde 0012, em_andamento/finalizacao
 * desde 0048 — nenhuma migration de máquina de estados necessária) e, se
 * foi o Tutor quem chamou com um substituto escolhido, já cria a conversa
 * vinculada. Se foi o Profissional, ele só grava a sugestão — o Tutor
 * decide depois via acceptReferral, mesma regra do item 28.
 *
 * ⚠️ Pendência financeira formal (mesmo padrão de confirmPaymentManually,
 * lib/actions/admin.ts): não mexe em payments/payouts/professional_cancellations
 * — hoje as três estão vazias (Onda 3 pausada). Reembolso ao Tutor e
 * eventual débito de comissão do Profissional que cancelou ficam pendentes
 * até o financeiro real retomar.
 */
export async function substituteProfessional(input: unknown): Promise<ActionResult> {
  const parsed = substituteProfessionalSchema.safeParse(input);
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
    .select("id, tutor_id, professional_id, category, status")
    .eq("id", parsed.data.requestId)
    .single();

  if (!request || (request.tutor_id !== user.id && request.professional_id !== user.id)) {
    return { error: "Você não faz parte dessa solicitação." };
  }
  if (!["confirmado", "checkin", "em_andamento", "finalizacao"].includes(request.status)) {
    return { error: "Substituição só é possível depois que o atendimento foi confirmado." };
  }

  const isTutor = request.tutor_id === user.id;
  let referredProfessionalId: string | null = null;

  if (parsed.data.newProfessionalId) {
    const excludeId = isTutor ? request.professional_id : user.id;
    const eligible = await isEligibleColleague(
      supabase,
      request.category,
      parsed.data.newProfessionalId,
      excludeId
    );
    if (!eligible) {
      return { error: "Profissional escolhido não está disponível para esta categoria." };
    }
    referredProfessionalId = parsed.data.newProfessionalId;
  } else if (isTutor) {
    return { error: "Escolha um profissional substituto para continuar." };
  }

  const { error: cancelError } = await supabase
    .from("requests")
    .update({ status: "cancelado", referred_professional_id: referredProfessionalId })
    .eq("id", parsed.data.requestId);
  if (cancelError) {
    return { error: "Não foi possível cancelar a solicitação original." };
  }

  await supabase.from("messages").insert({
    request_id: parsed.data.requestId,
    sender_id: user.id,
    content: `Solicitação cancelada para substituição de profissional. Motivo: ${parsed.data.reason}.`,
  });

  revalidatePath(`/solicitacoes/${parsed.data.requestId}`);

  if (isTutor && referredProfessionalId) {
    const draft = await createLinkedPrechat(
      supabase,
      user.id,
      referredProfessionalId,
      request.category,
      parsed.data.requestId
    );
    if (draft) {
      redirect(`/solicitacoes/${draft.id}`);
    }
  }

  return { error: null };
}

/**
 * Mudança de escopo/valor/data DEPOIS que a proposta já foi aceita (itens
 * 23/24) — nunca mexe em requests.status, diferente de requestAdjustment
 * (pré-aceite). Bidirecional: tutor ou profissional podem propor.
 */
export async function proposeScopeChange(input: unknown): Promise<ActionResult> {
  const parsed = proposeScopeChangeSchema.safeParse(input);
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
    return { error: "Você não faz parte dessa solicitação." };
  }
  if (!["confirmado", "checkin", "em_andamento", "finalizacao"].includes(request.status)) {
    return { error: "Mudança de escopo só é possível depois que a proposta foi aceita." };
  }

  let oldValue: string | null = null;

  if (parsed.data.fieldChanged === "data") {
    const { data: occurrence } = await supabase
      .from("request_occurrences")
      .select("scheduled_at, status")
      .eq("id", parsed.data.occurrenceId!)
      .eq("request_id", parsed.data.requestId)
      .single();
    if (!occurrence || occurrence.status !== "agendado") {
      return { error: "Essa ocorrência não pode mais ter a data alterada." };
    }
    oldValue = occurrence.scheduled_at;
  } else {
    const { data: proposal } = await supabase
      .from("proposals")
      .select("scope, price")
      .eq("request_id", parsed.data.requestId)
      .not("accepted_at", "is", null)
      .order("version", { ascending: false })
      .limit(1)
      .maybeSingle();
    oldValue =
      parsed.data.fieldChanged === "escopo" ? proposal?.scope ?? "" : String(proposal?.price ?? "");
  }

  const { error } = await supabase.from("scope_change_requests").insert({
    request_id: parsed.data.requestId,
    occurrence_id: parsed.data.fieldChanged === "data" ? parsed.data.occurrenceId : null,
    proposed_by: user.id,
    field_changed: parsed.data.fieldChanged,
    old_value: oldValue ?? "",
    new_value: parsed.data.newValue,
  });

  if (error) {
    return {
      error: error.code === "23505"
        ? "Já existe uma proposta de mudança pendente para este campo."
        : "Não foi possível propor a mudança.",
    };
  }

  await supabase.from("messages").insert({
    request_id: parsed.data.requestId,
    sender_id: user.id,
    content: `Proposta de mudança (${parsed.data.fieldChanged}): de "${oldValue}" para "${parsed.data.newValue}".`,
  });

  revalidatePath(`/solicitacoes/${parsed.data.requestId}`);
  return { error: null };
}

/**
 * Só a contraparte de quem propôs pode responder (RLS já garante isso —
 * scope_change_requests_update_counterpart — esta checagem é só pra
 * devolver uma mensagem de erro melhor que "0 linhas afetadas").
 */
export async function respondScopeChange(input: unknown): Promise<ActionResult> {
  const parsed = respondScopeChangeSchema.safeParse(input);
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

  const { data: change } = await supabase
    .from("scope_change_requests")
    .select("id, request_id, proposed_by, field_changed, occurrence_id, new_value, status")
    .eq("id", parsed.data.scopeChangeId)
    .single();

  if (!change) {
    return { error: "Proposta de mudança não encontrada." };
  }
  if (change.proposed_by === user.id) {
    return { error: "Você não pode responder à própria proposta." };
  }
  if (change.status !== "pendente") {
    return { error: "Essa proposta já foi respondida." };
  }

  const { error } = await supabase
    .from("scope_change_requests")
    .update({ status: parsed.data.decision, responded_at: new Date().toISOString(), responded_by: user.id })
    .eq("id", parsed.data.scopeChangeId);

  if (error) {
    return { error: "Não foi possível responder à proposta." };
  }

  if (parsed.data.decision === "aceito" && change.field_changed === "data" && change.occurrence_id) {
    await supabase
      .from("request_occurrences")
      .update({ scheduled_at: change.new_value })
      .eq("id", change.occurrence_id)
      .eq("status", "agendado");
  }
  // escopo/valor aceitos: sem Onda 3, não há como cobrar diferença nem
  // reembolsar automaticamente — fica só como registro histórico na
  // própria scope_change_requests até o financeiro real retomar.

  await supabase.from("messages").insert({
    request_id: change.request_id,
    sender_id: user.id,
    content:
      parsed.data.decision === "aceito"
        ? `Mudança de ${change.field_changed} aceita.`
        : `Mudança de ${change.field_changed} recusada.`,
  });

  revalidatePath(`/solicitacoes/${change.request_id}`);
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
