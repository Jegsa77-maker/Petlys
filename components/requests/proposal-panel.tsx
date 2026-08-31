"use client";

import { useState } from "react";
import { acceptProposal, sendProposal } from "@/lib/actions/requests";
import { sendProposalSchema } from "@/lib/validations/requests";

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

  return (
    <div className="flex flex-col gap-4">
      {latest ? (
        <ProposalCard requestId={requestId} proposal={latest} viewerRole={viewerRole} />
      ) : (
        <p className="text-sm text-gray-400">Nenhuma proposta enviada ainda.</p>
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
  const total = Number(proposal.price) + Number(proposal.additional_fees);

  async function handleAccept() {
    setError(null);
    setIsSubmitting(true);
    const result = await acceptProposal(requestId, proposal.id);
    setIsSubmitting(false);
    if (result?.error) setError(result.error);
  }

  return (
    <div className="rounded-lg border border-gray-200 bg-white p-4">
      <div className="flex items-center justify-between mb-2">
        <p className="text-sm font-semibold text-black">Proposta v{proposal.version}</p>
        <p className="text-sm font-semibold text-teal">R$ {total.toFixed(2)}</p>
      </div>
      <p className="text-sm text-gray-600 mb-2">{proposal.scope}</p>
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
      ) : viewerRole === "tutor" ? (
        <button
          type="button"
          onClick={handleAccept}
          disabled={isSubmitting}
          className="mt-3 w-full rounded-lg bg-teal px-4 py-2 text-sm font-semibold text-white hover:opacity-90 disabled:opacity-60"
        >
          {isSubmitting ? "Aceitando..." : "Aceitar proposta"}
        </button>
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
