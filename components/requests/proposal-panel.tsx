"use client";

import { useState } from "react";
import { acceptProposal, sendProposal, requestAdjustment } from "@/lib/actions/requests";
import { sendProposalSchema } from "@/lib/validations/requests";

const PERIOD_LABEL: Record<string, string> = {
  manha: "Manhã",
  tarde: "Tarde",
  noite: "Noite",
};

type Proposal = {
  id: string;
  version: number;
  scope: string;
  price: number;
  additional_fees: number;
  validity_at: string;
  requires_full_payment: boolean;
  deposit_percent: number | null;
  accepted_at: string | null;
  proposed_scheduled_at: string | null;
  proposed_period: string | null;
};

export function ProposalPanel({
  requestId,
  proposals,
  viewerRole,
}: {
  requestId: string;
  proposals: Proposal[];
  viewerRole: "tutor" | "profissional";
}) {
  const latest = proposals.at(-1) ?? null;
  const older = proposals.slice(0, -1).reverse();

  return (
    <div className="flex flex-col gap-4">
      {latest ? (
        <ProposalCard requestId={requestId} proposal={latest} viewerRole={viewerRole} />
      ) : (
        <p className="text-sm text-gray-400">Nenhuma proposta enviada ainda.</p>
      )}

      {older.length > 0 && (
        <details className="text-xs text-gray-500">
          <summary className="cursor-pointer font-semibold text-gray-600">
            Ver versões anteriores ({older.length})
          </summary>
          <ul className="flex flex-col gap-2 mt-2">
            {older.map((p) => {
              const total = Number(p.price) + Number(p.additional_fees);
              const priceDiff = total - (Number(latest?.price ?? 0) + Number(latest?.additional_fees ?? 0));
              return (
                <li key={p.id} className="rounded-lg border border-gray-200 p-3">
                  <div className="flex items-center justify-between">
                    <span className="font-semibold">Proposta v{p.version}</span>
                    <span>R$ {total.toFixed(2)}</span>
                  </div>
                  <p className="mt-1">{p.scope}</p>
                  {priceDiff !== 0 && (
                    <p className="mt-1 text-teal">
                      {priceDiff > 0
                        ? `R$ ${priceDiff.toFixed(2)} mais barata que a versão atual`
                        : `R$ ${Math.abs(priceDiff).toFixed(2)} mais cara que a versão atual`}
                    </p>
                  )}
                </li>
              );
            })}
          </ul>
        </details>
      )}

      {viewerRole === "profissional" && (!latest || latest.accepted_at === null) && (
        <NewProposalForm requestId={requestId} />
      )}
    </div>
  );
}

function ProposalCard({
  requestId,
  proposal,
  viewerRole,
}: {
  requestId: string;
  proposal: Proposal;
  viewerRole: "tutor" | "profissional";
}) {
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isAdjusting, setIsAdjusting] = useState(false);
  const [feedback, setFeedback] = useState("");
  const total = Number(proposal.price) + Number(proposal.additional_fees);
  const isExpired = !proposal.accepted_at && new Date(proposal.validity_at) < new Date();

  async function handleAccept() {
    setError(null);
    setIsSubmitting(true);
    const result = await acceptProposal(requestId, proposal.id);
    setIsSubmitting(false);
    if (result?.error) setError(result.error);
  }

  async function handleAdjustmentSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setIsSubmitting(true);
    const result = await requestAdjustment({ requestId, proposalId: proposal.id, feedback });
    setIsSubmitting(false);
    if (result?.error) {
      setError(result.error);
      return;
    }
    setIsAdjusting(false);
    setFeedback("");
  }

  return (
    <div className="rounded-lg border border-gray-200 bg-white p-4">
      <div className="flex items-center justify-between mb-2">
        <p className="text-sm font-semibold text-black">Proposta v{proposal.version}</p>
        <p className="text-sm font-semibold text-teal">R$ {total.toFixed(2)}</p>
      </div>
      <p className="text-sm text-gray-600 mb-2">{proposal.scope}</p>
      {proposal.proposed_scheduled_at && (
        <p className="text-xs text-teal font-medium">
          Novo horário proposto: {new Date(proposal.proposed_scheduled_at).toLocaleString("pt-BR")}
        </p>
      )}
      {proposal.proposed_period && (
        <p className="text-xs text-teal font-medium">
          Período proposto: {PERIOD_LABEL[proposal.proposed_period] ?? proposal.proposed_period} (horário exato a combinar pelo chat)
        </p>
      )}
      <p className="text-xs text-gray-400">
        Válida até {new Date(proposal.validity_at).toLocaleString("pt-BR")}
      </p>
      <p className="text-xs text-gray-400">
        {proposal.requires_full_payment
          ? "Pagamento integral na confirmação"
          : `Sinal de ${proposal.deposit_percent ?? 0}%`}
      </p>

      {proposal.accepted_at ? (
        <p className="mt-3 inline-block text-xs font-semibold text-black bg-green px-2 py-1 rounded-full">Proposta aceita</p>
      ) : isExpired ? (
        <p className="mt-3 inline-block text-xs font-semibold text-red-700 bg-red-50 px-2 py-1 rounded-full">
          Proposta expirada
        </p>
      ) : viewerRole === "tutor" ? (
        <div className="mt-3 flex flex-col gap-2">
          <button
            type="button"
            onClick={handleAccept}
            disabled={isSubmitting}
            className="w-full rounded-lg bg-teal px-4 py-2 text-sm font-semibold text-white hover:opacity-90 disabled:opacity-60"
          >
            {isSubmitting ? "Aceitando..." : "Aceitar proposta"}
          </button>
          {!isAdjusting ? (
            <button
              type="button"
              onClick={() => setIsAdjusting(true)}
              className="text-xs font-semibold text-teal hover:underline w-fit"
            >
              Pedir ajuste
            </button>
          ) : (
            <form onSubmit={handleAdjustmentSubmit} className="flex flex-col gap-2">
              <textarea
                value={feedback}
                onChange={(e) => setFeedback(e.target.value)}
                placeholder="O que você gostaria de ajustar nessa proposta?"
                rows={2}
                className="input text-sm"
              />
              <div className="flex gap-2">
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="flex-1 rounded-lg border border-teal px-3 py-1.5 text-xs font-semibold text-teal hover:bg-teal/5 disabled:opacity-60"
                >
                  Enviar pedido de ajuste
                </button>
                <button
                  type="button"
                  onClick={() => setIsAdjusting(false)}
                  className="rounded-lg border border-gray-300 px-3 py-1.5 text-xs font-semibold text-gray-600"
                >
                  Cancelar
                </button>
              </div>
            </form>
          )}
        </div>
      ) : null}
      {error && <p className="text-sm text-red-600 mt-2" role="alert">{error}</p>}
    </div>
  );
}

function NewProposalForm({ requestId }: { requestId: string }) {
  const [scope, setScope] = useState("");
  const [price, setPrice] = useState("");
  const [additionalFees, setAdditionalFees] = useState("0");
  const [validityHours, setValidityHours] = useState("24");
  const [requiresFullPayment, setRequiresFullPayment] = useState(true);
  const [depositPercent, setDepositPercent] = useState("");
  const [cancellationPolicyText, setCancellationPolicyText] = useState("");
  const [scheduleChoice, setScheduleChoice] = useState<"manter" | "horario_exato" | "periodo">("manter");
  const [proposedScheduledAt, setProposedScheduledAt] = useState("");
  const [proposedPeriod, setProposedPeriod] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    const parsed = sendProposalSchema.safeParse({
      requestId,
      scope,
      price,
      additionalFees,
      validityHours,
      requiresFullPayment,
      depositPercent: requiresFullPayment ? undefined : depositPercent,
      cancellationPolicyText,
      scheduleChoice,
      proposedScheduledAt: scheduleChoice === "horario_exato" ? proposedScheduledAt : undefined,
      proposedPeriod: scheduleChoice === "periodo" ? proposedPeriod : undefined,
    });

    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message ?? "Verifique os dados da proposta");
      return;
    }

    setIsSubmitting(true);
    const result = await sendProposal(parsed.data);
    setIsSubmitting(false);

    if (result?.error) setError(result.error);
    else {
      setScope("");
      setPrice("");
      setCancellationPolicyText("");
      setScheduleChoice("manter");
      setProposedScheduledAt("");
      setProposedPeriod("");
    }
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-3 rounded-lg border border-gray-200 bg-white p-4">
      <p className="text-sm font-semibold text-black">Enviar proposta</p>
      <textarea
        value={scope}
        onChange={(e) => setScope(e.target.value)}
        placeholder="Escopo do atendimento"
        rows={2}
        className="input"
      />

      <div>
        <p className="text-xs font-medium text-black mb-1">Horário</p>
        <select
          value={scheduleChoice}
          onChange={(e) => setScheduleChoice(e.target.value as typeof scheduleChoice)}
          className="input"
        >
          <option value="manter">Manter o horário que o Tutor pediu</option>
          <option value="horario_exato">Propor outro horário exato</option>
          <option value="periodo">Propor só um período (sem hora exata)</option>
        </select>
        {scheduleChoice === "horario_exato" && (
          <input
            type="datetime-local"
            value={proposedScheduledAt}
            onChange={(e) => setProposedScheduledAt(e.target.value)}
            className="input mt-2"
          />
        )}
        {scheduleChoice === "periodo" && (
          <select
            value={proposedPeriod}
            onChange={(e) => setProposedPeriod(e.target.value)}
            className="input mt-2"
          >
            <option value="">Selecione o período</option>
            <option value="manha">Manhã</option>
            <option value="tarde">Tarde</option>
            <option value="noite">Noite</option>
          </select>
        )}
        <p className="text-xs text-gray-400 mt-1">
          Isso nunca bloqueia sua agenda — é só o que você propõe ao Tutor; o horário final se
          resolve pelo chat se precisar de mais ajuste.
        </p>
      </div>

      <div className="grid grid-cols-2 gap-2">
        <input
          type="number"
          step="0.01"
          value={price}
          onChange={(e) => setPrice(e.target.value)}
          placeholder="Valor (R$)"
          className="input"
        />
        <input
          type="number"
          step="0.01"
          value={additionalFees}
          onChange={(e) => setAdditionalFees(e.target.value)}
          placeholder="Adicionais (R$)"
          className="input"
        />
      </div>
      <input
        type="number"
        value={validityHours}
        onChange={(e) => setValidityHours(e.target.value)}
        placeholder="Validade (horas)"
        className="input"
      />
      <label className="flex items-center gap-2 text-sm text-black">
        <input
          type="checkbox"
          checked={requiresFullPayment}
          onChange={(e) => setRequiresFullPayment(e.target.checked)}
          className="h-4 w-4 accent-teal"
        />
        Exigir pagamento integral (desmarque para pedir sinal)
      </label>
      {!requiresFullPayment && (
        <input
          type="number"
          value={depositPercent}
          onChange={(e) => setDepositPercent(e.target.value)}
          placeholder="Percentual de sinal"
          className="input"
        />
      )}
      <textarea
        value={cancellationPolicyText}
        onChange={(e) => setCancellationPolicyText(e.target.value)}
        placeholder="Política de cancelamento"
        rows={2}
        className="input"
      />
      {error && <p className="text-sm text-red-600" role="alert">{error}</p>}
      <button
        type="submit"
        disabled={isSubmitting}
        className="rounded-lg bg-teal px-4 py-2 text-sm font-semibold text-white hover:opacity-90 disabled:opacity-60"
      >
        {isSubmitting ? "Enviando..." : "Enviar proposta"}
      </button>
    </form>
  );
}
