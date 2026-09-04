import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { notFound } from "next/navigation";
import { ChatPanel } from "@/components/requests/chat-panel";
import { ProposalPanel } from "@/components/requests/proposal-panel";
import { DeclineRequestButton } from "@/components/requests/decline-request-button";
import { RequestTimeline } from "@/components/requests/request-timeline";
import { NoShowButton } from "@/components/requests/no-show-button";
import { ReviewSection } from "@/components/requests/review-section";
import { EvidenceUpload } from "@/components/requests/evidence-upload";
import { RequestAttachmentsSection } from "@/components/requests/request-attachments-section";
import { RescheduleOccurrenceButton } from "@/components/requests/reschedule-occurrence-button";
import { EditRecurrenceForm } from "@/components/requests/edit-recurrence-form";
import { HelpButton } from "@/components/requests/help-button";
import { ConfirmPaymentButton } from "@/components/requests/confirm-payment-button";
import { EndConversationButton } from "@/components/requests/end-conversation-button";
import { ScopeChangePanel } from "@/components/requests/scope-change-panel";
import { ReferralCard } from "@/components/requests/referral-card";
import { SubstituteProfessionalButton } from "@/components/requests/substitute-professional-button";
import { CATEGORY_QUESTIONS } from "@/lib/domain/category-questions";
import { nextActionCopy } from "@/lib/domain/request-status-copy";
import { REQUEST_STATUS_LABEL as STATUS_LABEL } from "@/lib/domain/request-status-labels";
import { occurrenceStageLabel } from "@/lib/domain/occurrence-pipeline";
import type { ServiceCategory, OccurrenceStatus } from "@/types/database";
import { incidentTypeLabel } from "@/lib/domain/incident-types";

export default async function SolicitacaoDetailPage({
  params,
}: {
  params: Promise<{ requestId: string }>;
}) {
  const { requestId } = await params;
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data: request } = await supabase
    .from("requests")
    .select(
      "id, tutor_id, professional_id, category, status, is_recurring, occurrences_total, is_visita_inicial, is_conversa_previa, referred_professional_id, address, category_answers, recurrence_interval"
    )
    .eq("id", requestId)
    .single();

  if (!request || !user) {
    notFound();
  }

  // Quem não é nem tutor nem profissional só chega aqui como staff — a RLS
  // de requests já libera leitura pra admin/supervisor (0009_rls_policies),
  // e eles só têm um motivo legítimo de estar aqui: intervir num incidente
  // aberto vinculado a essa solicitação (ver messages_insert em
  // 0015_staff_chat_intervention.sql).
  const viewerRole: "tutor" | "profissional" | "staff" =
    request.tutor_id === user.id
      ? "tutor"
      : request.professional_id === user.id
        ? "profissional"
        : "staff";
  const otherPartyId = viewerRole === "tutor" ? request.professional_id : request.tutor_id;

  // "Conversa prévia" (chat antes de solicitar, ver 0042_conversa_previa.sql
  // + startConversation): rascunho que nasceu do botão "Conversar" no
  // perfil do profissional, não do formulário completo de nova solicitação.
  const isPreChat = request.status === "rascunho" && request.is_conversa_previa;

  // Só usado pelo botão temporário de confirmação manual de pagamento
  // (beta fechado, sem Onda 3 ainda) — ver ConfirmPaymentButton.
  const { data: adminRole } =
    viewerRole === "staff"
      ? await supabase
          .from("account_roles")
          .select("role")
          .eq("profile_id", user.id)
          .eq("role", "administrador")
          .eq("active", true)
          .maybeSingle()
      : { data: null };
  const isAdmin = Boolean(adminRole);

  const [
    { data: messages },
    { data: proposals },
    { data: petLinks },
    { data: history },
    { data: occurrences },
    { data: incidents },
    { data: reviews },
    { data: attachments },
    { data: otherPartyRows },
    { data: scopeChanges },
    { data: referredProfile },
  ] = await Promise.all([
    supabase
      .from("messages")
      .select("id, sender_id, content, created_at, flagged_reason, hidden_at")
      .eq("request_id", requestId)
      .order("created_at", { ascending: true }),
    supabase
      .from("proposals")
      .select(
        "id, version, scope, price, additional_fees, validity_at, requires_full_payment, deposit_percent, accepted_at, proposed_scheduled_at, proposed_period"
      )
      .eq("request_id", requestId)
      .order("version", { ascending: true }),
    supabase.from("request_pets").select("pets(id, name)").eq("request_id", requestId),
    supabase
      .from("request_status_history")
      .select("id, from_status, to_status, created_at")
      .eq("request_id", requestId)
      .order("created_at", { ascending: true }),
    supabase
      .from("request_occurrences")
      .select("id, sequence_number, scheduled_at, status")
      .eq("request_id", requestId)
      .order("sequence_number", { ascending: true }),
    supabase
      .from("incidents")
      .select("id, type, status, description, resolution")
      .eq("request_id", requestId)
      .order("created_at", { ascending: false }),
    supabase
      .from("reviews")
      .select("id, reviewer_id, reviewee_id, rating, comment, response, flagged_reason, hidden_at")
      .eq("request_id", requestId),
    supabase
      .from("request_attachments")
      .select("id, url, created_at")
      .eq("request_id", requestId)
      .order("created_at", { ascending: true }),
    // Pra staff, a função sempre devolve vazio (auth.uid() não bate com
    // tutor_id nem professional_id) — mais simples que ramificar aqui.
    supabase.rpc("get_request_other_party_name", { p_request_id: requestId }),
    supabase
      .from("scope_change_requests")
      .select("id, proposed_by, field_changed, old_value, new_value, status, created_at")
      .eq("request_id", requestId)
      .order("created_at", { ascending: false }),
    // RPC estreito (0073) em vez de ler profiles direto — o profissional
    // indicado não é parte dessa request, então não há como usar
    // get_request_other_party_name aqui; mesma regra de "só quem tem
    // serviço ativo" que valia na policy pública removida. Se não há
    // indicação, nem chama — mais simples que ramificar o tipo da promise
    // aqui dentro do Promise.all.
    request?.referred_professional_id
      ? supabase.rpc("get_public_professional_names", {
          p_professional_ids: [request.referred_professional_id],
        })
      : Promise.resolve({ data: null }),
  ]);

  const otherPartyName = otherPartyRows?.[0]?.full_name ?? null;
  const otherPartyAvatarUrl = otherPartyRows?.[0]?.avatar_url ?? null;

  const pets = (petLinks ?? [])
    .map((link) => link.pets)
    .filter((p): p is NonNullable<typeof p> => p !== null);

  const currentOccurrence = (occurrences ?? []).find((o) =>
    ["agendado", "checkin", "em_andamento"].includes(o.status)
  );

  const openIncident = (incidents ?? []).find((i) => i.status !== "resolvido");
  // Só mostra o último resolvido (pra apelação) quando não há nenhum em
  // aberto — evita empilhar histórico antigo enquanto há caso ativo.
  const lastResolvedIncident = !openIncident
    ? (incidents ?? []).find((i) => i.status === "resolvido")
    : undefined;

  // Mensagens de quem não é tutor nem profissional só podem ser de
  // suporte/admin (única forma que a RLS permite, ver
  // 0015_staff_chat_intervention.sql) — sinalizamos pra bolha do chat
  // mostrar "Suporte" em vez de deixar as duas partes sem saber quem é
  // essa 3ª pessoa. Não expomos o nome real do admin (RLS de profiles
  // também não deixaria tutor/profissional lerem esse perfil).
  const staffSenderIds = [...new Set((messages ?? []).map((m) => m.sender_id))].filter(
    (id) => id !== request.tutor_id && id !== request.professional_id
  );

  const heroCopy = nextActionCopy(request.status, viewerRole);

  return (
    <main className="min-h-screen bg-offwhite px-4 py-8">
      <div className="max-w-md mx-auto flex flex-col gap-6">
        <div>
          <h1 className="text-xl font-bold text-black mb-1">
            {isPreChat
              ? `Conversa com ${otherPartyName ?? (viewerRole === "tutor" ? "o profissional" : "o tutor")}`
              : pets.map((p) => p.name).join(", ") || "Solicitação"}
          </h1>
          {/* Hero de status (M-013, iniciativa de CX) — a próxima ação em
              linguagem simples fica em destaque; o nome técnico do status
              vira só um selo pequeno ao lado, não o título da tela. */}
          <div className="flex items-start gap-2 mb-2">
            {heroCopy ? (
              <p className="text-sm font-semibold text-teal flex-1">{heroCopy}</p>
            ) : (
              <span className="text-xs font-semibold text-teal">
                {STATUS_LABEL[request.status] ?? request.status}
              </span>
            )}
          </div>
          <div className="flex flex-wrap items-center gap-2 mb-2">
            <span className="inline-block rounded-full bg-teal/10 px-2.5 py-0.5 text-xs font-semibold text-teal">
              {STATUS_LABEL[request.status] ?? request.status}
            </span>
            {request.is_visita_inicial && (
              <span className="inline-block rounded-full bg-gray px-2.5 py-0.5 text-xs font-semibold text-black">
                Visita inicial
              </span>
            )}
          </div>
          {request.is_recurring && (
            <div className="flex items-center gap-2 mt-1">
              <p className="text-xs text-gray-500">
                Contrato recorrente — {request.occurrences_total} ocorrências
              </p>
              {viewerRole !== "staff" && (
                <EditRecurrenceForm requestId={request.id} currentInterval={request.recurrence_interval} />
              )}
            </div>
          )}
          {request.address && (
            <p className="text-xs text-gray-500 mt-1">Local: {request.address}</p>
          )}
          {Object.keys((request.category_answers as Record<string, string>) ?? {}).length > 0 && (
            <div className="mt-1 flex flex-col gap-0.5">
              {Object.entries(request.category_answers as Record<string, string>).map(([key, value]) => {
                const question = CATEGORY_QUESTIONS[request.category]?.find((q) => q.key === key);
                return value ? (
                  <p key={key} className="text-xs text-gray-500">
                    <span className="font-medium">{question?.label ?? key}:</span> {value}
                  </p>
                ) : null;
              })}
            </div>
          )}
          {viewerRole === "tutor" && (request.status === "concluido" || request.status === "avaliacao") && (
            <Link
              href={`/solicitacoes/nova?profissional=${request.professional_id}&repetir=${request.id}`}
              className="inline-block mt-2 text-xs font-semibold text-teal hover:underline"
            >
              Contratar novamente
            </Link>
          )}
          {isPreChat && (
            <p className="text-xs text-gray-500 mt-2 bg-gray/50 rounded-lg px-3 py-2">
              Isso ainda é só uma conversa — nenhuma solicitação foi criada.
            </p>
          )}
        </div>

        {isPreChat && viewerRole === "tutor" && (
          <Link
            href={`/solicitacoes/nova?profissional=${request.professional_id}&continuar=${request.id}`}
            className="rounded-lg bg-teal px-4 py-3 text-center text-sm font-semibold text-white hover:opacity-90"
          >
            Quero solicitar de verdade
          </Link>
        )}
        {isPreChat && viewerRole !== "staff" && <EndConversationButton requestId={request.id} />}

        {viewerRole === "staff" && (
          <p className="text-xs text-gray-500 bg-gray/50 rounded-lg px-3 py-2">
            Você está vendo essa solicitação como suporte.
          </p>
        )}

        {viewerRole === "staff" && isAdmin && request.status === "aguardando_pagamento" && (
          <ConfirmPaymentButton requestId={request.id} />
        )}

        {viewerRole !== "staff" && !isPreChat && (
          <section>
            <h2 className="text-sm font-semibold text-black mb-2">Proposta</h2>
            <ProposalPanel
              requestId={request.id}
              proposals={proposals ?? []}
              viewerRole={viewerRole}
            />
          </section>
        )}

        {viewerRole === "profissional" &&
          ["solicitacao_enviada", "em_conversa", "proposta_enviada"].includes(request.status) && (
            <DeclineRequestButton
              requestId={request.id}
              category={request.category}
              professionalId={request.professional_id}
            />
          )}

        {viewerRole === "tutor" &&
          request.referred_professional_id &&
          ["recusado", "cancelado"].includes(request.status) && (
            <ReferralCard requestId={request.id} referredProfessionalName={referredProfile?.[0]?.full_name ?? "um colega"} />
          )}

        {currentOccurrence && (
          <section className="rounded-lg border border-gray-200 bg-white p-4">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-sm font-semibold text-black">Atendimento atual</h2>
                <p className="text-xs text-gray-500">
                  {new Date(currentOccurrence.scheduled_at).toLocaleString("pt-BR")}
                </p>
              </div>
              <span className="text-xs font-semibold text-teal bg-teal/10 px-2 py-1 rounded-full">
                {occurrenceStageLabel(
                  request.category as ServiceCategory,
                  currentOccurrence.status as OccurrenceStatus
                )}
              </span>
            </div>
            {currentOccurrence.status === "agendado" && viewerRole !== "staff" && (
              <div className="mt-3 flex items-center justify-between">
                <NoShowButton
                  requestId={request.id}
                  occurrenceId={currentOccurrence.id}
                  viewerRole={viewerRole}
                />
                <RescheduleOccurrenceButton occurrenceId={currentOccurrence.id} />
              </div>
            )}
          </section>
        )}

        {viewerRole !== "staff" &&
          ["confirmado", "checkin", "em_andamento", "finalizacao"].includes(request.status) && (
            <section className="flex flex-col gap-2">
              <ScopeChangePanel
                requestId={request.id}
                currentUserId={user.id}
                scopeChanges={scopeChanges ?? []}
                occurrences={(occurrences ?? []).filter((o) => o.status === "agendado")}
              />
              <SubstituteProfessionalButton
                requestId={request.id}
                category={request.category}
                excludeProfessionalId={viewerRole === "tutor" ? request.professional_id : user.id}
                viewerRole={viewerRole}
              />
            </section>
          )}

        {viewerRole !== "staff" && !isPreChat && (
          <HelpButton
            requestId={request.id}
            occurrenceId={currentOccurrence?.id}
            currentIncident={openIncident ?? null}
            lastResolvedIncident={lastResolvedIncident ?? null}
          />
        )}

        {openIncident && (
          <section className="flex flex-col gap-3">
            {viewerRole === "staff" && (
              <h2 className="text-sm font-semibold text-black">
                Incidente: {incidentTypeLabel(openIncident.type)}
              </h2>
            )}
            <EvidenceUpload incidentId={openIncident.id} requestId={request.id} uploadedBy={user.id} />
          </section>
        )}

        {viewerRole !== "staff" && (request.status === "avaliacao" || request.status === "concluido") && (
          <section>
            <h2 className="text-sm font-semibold text-black mb-2">Avaliação</h2>
            <ReviewSection
              requestId={request.id}
              currentUserId={user.id}
              otherPartyId={otherPartyId}
              requestStatus={request.status}
              existingReviews={(reviews ?? []).map((r) => ({
                id: r.id,
                reviewer_id: r.reviewer_id,
                reviewee_id: r.reviewee_id,
                rating: r.rating as {
                  qualidade: number;
                  comunicacao: number;
                  pontualidade: number;
                  aderencia_combinado: number;
                },
                comment: r.comment,
                response: r.response,
                flagged_reason: r.flagged_reason,
                hidden_at: r.hidden_at,
              }))}
            />
          </section>
        )}

        <section>
          <h2 className="text-sm font-semibold text-black mb-2">Conversa</h2>
          <ChatPanel
            requestId={request.id}
            messages={messages ?? []}
            currentUserId={user.id}
            staffSenderIds={staffSenderIds}
            otherPartyName={isPreChat ? otherPartyName : null}
            otherPartyAvatarUrl={isPreChat ? otherPartyAvatarUrl : null}
          />
        </section>

        {viewerRole !== "staff" && !isPreChat && (
          <RequestAttachmentsSection requestId={request.id} attachments={attachments ?? []} />
        )}

        {/* Histórico recolhido por padrão (M-013, iniciativa de CX —
            "recolher informação secundária" sem nunca removê-la, ver
            Matriz_Responsiva "Conteúdo operacional"). */}
        <details className="group">
          <summary className="text-sm font-semibold text-gray-500 cursor-pointer list-none flex items-center gap-1">
            <span className="transition-transform group-open:rotate-90">›</span> Histórico
          </summary>
          <div className="mt-2">
            <RequestTimeline history={history ?? []} />
          </div>
        </details>
      </div>
    </main>
  );
}
