import { createClient } from "@/lib/supabase/server";
import { notFound } from "next/navigation";
import { ChatPanel } from "@/components/requests/chat-panel";
import { ProposalPanel } from "@/components/requests/proposal-panel";
import { DeclineRequestButton } from "@/components/requests/decline-request-button";
import { RequestTimeline } from "@/components/requests/request-timeline";
import { NoShowButton } from "@/components/requests/no-show-button";
import { ReviewSection } from "@/components/requests/review-section";
import { EvidenceUpload } from "@/components/requests/evidence-upload";

const STATUS_LABEL: Record<string, string> = {
  rascunho: "Rascunho",
  solicitacao_enviada: "Solicitação enviada",
  em_conversa: "Em conversa",
  proposta_enviada: "Proposta enviada",
  aguardando_pagamento: "Aguardando pagamento",
  confirmado: "Confirmado",
  checkin: "Check-in",
  em_andamento: "Em andamento",
  finalizacao: "Finalização",
  concluido: "Concluído",
  avaliacao: "Avaliação",
  recusado: "Recusado",
  expirado: "Expirado",
  cancelado: "Cancelado",
  incidente: "Incidente",
  em_disputa: "Em disputa",
};

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
    .select("id, tutor_id, professional_id, category, status, is_recurring, occurrences_total, is_visita_inicial")
    .eq("id", requestId)
    .single();

  if (!request || !user) {
    notFound();
  }

  const viewerRole = request.tutor_id === user.id ? "tutor" : "profissional";
  const otherPartyId = viewerRole === "tutor" ? request.professional_id : request.tutor_id;

  const [
    { data: messages },
    { data: proposals },
    { data: petLinks },
    { data: history },
    { data: occurrences },
    { data: incidents },
    { data: reviews },
  ] = await Promise.all([
    supabase
      .from("messages")
      .select("id, sender_id, content, created_at")
      .eq("request_id", requestId)
      .order("created_at", { ascending: true }),
    supabase
      .from("proposals")
      .select("id, version, scope, price, additional_fees, validity_at, requires_full_payment, deposit_percent, accepted_at")
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
      .select("id, type, status")
      .eq("request_id", requestId)
      .order("created_at", { ascending: false }),
    supabase
      .from("reviews")
      .select("id, reviewer_id, reviewee_id, rating, comment, response")
      .eq("request_id", requestId),
  ]);

  const pets = (petLinks ?? [])
    .map((link) => link.pets)
    .filter((p): p is NonNullable<typeof p> => p !== null);

  const currentOccurrence = (occurrences ?? []).find((o) =>
    ["agendado", "checkin", "em_andamento"].includes(o.status)
  );

  const openIncident = (incidents ?? []).find((i) => i.status !== "resolvido");

  return (
    <main className="min-h-screen bg-offwhite px-4 py-8">
      <div className="max-w-md mx-auto flex flex-col gap-6">
        <div>
          <span className="inline-block rounded-full bg-teal/10 px-3 py-1 text-xs font-semibold text-teal mb-2">
            {STATUS_LABEL[request.status] ?? request.status}
          </span>
          {request.is_visita_inicial && (
            <span className="inline-block rounded-full bg-gray px-3 py-1 text-xs font-semibold text-black mb-2 ml-2">
              Visita inicial
            </span>
          )}
          <h1 className="text-xl font-bold text-black">
            {pets.map((p) => p.name).join(", ") || "Solicitação"}
          </h1>
          {request.is_recurring && (
            <p className="text-xs text-gray-500">
              Contrato recorrente — {request.occurrences_total} ocorrências
            </p>
          )}
        </div>

        <section>
          <h2 className="text-sm font-semibold text-black mb-2">Proposta</h2>
          <ProposalPanel
            requestId={request.id}
            proposals={proposals ?? []}
            viewerRole={viewerRole}
          />
        </section>

        {viewerRole === "profissional" &&
          ["solicitacao_enviada", "em_conversa", "proposta_enviada"].includes(request.status) && (
            <DeclineRequestButton requestId={request.id} />
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
              <span className="text-xs font-semibold text-teal bg-teal/10 px-2 py-1 rounded-full capitalize">
                {currentOccurrence.status.replace(/_/g, " ")}
              </span>
            </div>
            {currentOccurrence.status === "agendado" && (
              <div className="mt-3">
                <NoShowButton
                  requestId={request.id}
                  occurrenceId={currentOccurrence.id}
                  viewerRole={viewerRole}
                />
              </div>
            )}
          </section>
        )}

        {openIncident && (
          <section className="rounded-lg border border-red-200 bg-white p-4">
            <h2 className="text-sm font-semibold text-black mb-2 capitalize">
              Incidente: {openIncident.type.replace(/_/g, " ")}
            </h2>
            <EvidenceUpload incidentId={openIncident.id} requestId={request.id} uploadedBy={user.id} />
          </section>
        )}

        {(request.status === "avaliacao" || request.status === "concluido") && (
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
              }))}
            />
          </section>
        )}

        <section>
          <h2 className="text-sm font-semibold text-black mb-2">Conversa</h2>
          <ChatPanel requestId={request.id} messages={messages ?? []} currentUserId={user.id} />
        </section>

        <section>
          <h2 className="text-sm font-semibold text-black mb-2">Histórico</h2>
          <RequestTimeline history={history ?? []} />
        </section>
      </div>
    </main>
  );
}
