"use client";

import { useState, useEffect } from "react";
import { substituteProfessional, listEligibleColleagues } from "@/lib/actions/requests";
import type { ServiceCategory } from "@/types/database";

type Colleague = { id: string; fullName: string; avatarUrl: string | null };

/**
 * Substituição pós-aceite (item 29 — o caso mais delicado). Tutor precisa
 * escolher o substituto já na hora; Profissional só sugere (o Tutor decide
 * depois via ReferralCard/acceptReferral) — mesma regra do item 28.
 */
export function SubstituteProfessionalButton({
  requestId,
  category,
  excludeProfessionalId,
  viewerRole,
}: {
  requestId: string;
  category: ServiceCategory;
  excludeProfessionalId: string;
  viewerRole: "tutor" | "profissional";
}) {
  const [open, setOpen] = useState(false);
  const [colleagues, setColleagues] = useState<Colleague[]>([]);
  const [newProfessionalId, setNewProfessionalId] = useState("");
  const [reason, setReason] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [done, setDone] = useState(false);

  useEffect(() => {
    if (!open) return;
    listEligibleColleagues(category, excludeProfessionalId).then(setColleagues);
  }, [open, category, excludeProfessionalId]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!reason.trim()) {
      setError("Descreva o motivo da substituição");
      return;
    }
    setIsSubmitting(true);
    const result = await substituteProfessional({
      requestId,
      reason,
      newProfessionalId: newProfessionalId || undefined,
    });
    setIsSubmitting(false);
    if (result?.error) {
      setError(result.error);
      return;
    }
    // Quando é o Profissional sugerindo, a action não redireciona (fica na
    // mesma tela, só grava a sugestão) — quando é o Tutor com substituto
    // escolhido, a action já faz redirect() e este código nem executa.
    setDone(true);
  }

  if (done) {
    return (
      <p className="text-sm font-semibold text-teal bg-teal/10 rounded-lg px-3 py-2">
        Solicitação cancelada para substituição — o Tutor decide o próximo passo.
      </p>
    );
  }

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="text-sm text-gray-500 hover:text-red-600 underline underline-offset-2 self-start"
      >
        Trocar de profissional
      </button>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="rounded-lg border border-gray-200 bg-white p-3 flex flex-col gap-2">
      <p className="text-xs text-gray-500">
        {viewerRole === "tutor"
          ? "O atendimento atual será cancelado e você inicia uma conversa com o novo profissional."
          : "O atendimento será cancelado. Se você indicar um colega, o Tutor decide se aceita."}
      </p>
      <textarea
        value={reason}
        onChange={(e) => setReason(e.target.value)}
        placeholder="Motivo da substituição"
        className="input"
        rows={2}
      />
      <select
        value={newProfessionalId}
        onChange={(e) => setNewProfessionalId(e.target.value)}
        className="input"
      >
        <option value="">
          {viewerRole === "tutor" ? "Selecione o substituto" : "Não indicar ninguém"}
        </option>
        {colleagues.map((c) => (
          <option key={c.id} value={c.id}>
            {c.fullName}
          </option>
        ))}
      </select>
      {error && <p role="alert" className="text-sm text-red-600">{error}</p>}
      <div className="flex gap-2">
        <button
          type="submit"
          disabled={isSubmitting}
          className="flex-1 rounded-lg bg-red-600 px-3 py-2 text-sm font-semibold text-white disabled:opacity-60"
        >
          {isSubmitting ? "Enviando..." : "Confirmar substituição"}
        </button>
        <button
          type="button"
          onClick={() => setOpen(false)}
          className="flex-1 rounded-lg border border-gray-300 px-3 py-2 text-sm text-black"
        >
          Voltar
        </button>
      </div>
    </form>
  );
}
