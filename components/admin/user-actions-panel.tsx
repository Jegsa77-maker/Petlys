"use client";

import { useState } from "react";
import { resetInternalPassword, recommendSuspension } from "@/lib/actions/supervisor";
import { recommendSuspensionSchema } from "@/lib/validations/admin";

export function UserActionsPanel({
  profileId,
  hasInternalUsername,
}: {
  profileId: string;
  hasInternalUsername: boolean;
}) {
  const [tempPassword, setTempPassword] = useState<string | null>(null);
  const [reason, setReason] = useState("");
  const [showSuspendForm, setShowSuspendForm] = useState(false);
  const [suspendSent, setSuspendSent] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleReset() {
    setError(null);
    setIsSubmitting(true);
    const result = await resetInternalPassword(profileId);
    setIsSubmitting(false);
    if (result?.error) {
      setError(result.error);
      return;
    }
    setTempPassword(result.temporaryPassword ?? null);
  }

  async function handleSuspend(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    const parsed = recommendSuspensionSchema.safeParse({ targetProfileId: profileId, reason });
    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message ?? "Verifique o motivo informado");
      return;
    }

    setIsSubmitting(true);
    const result = await recommendSuspension(parsed.data);
    setIsSubmitting(false);
    if (result?.error) {
      setError(result.error);
      return;
    }
    setSuspendSent(true);
  }

  return (
    <div className="flex flex-col gap-4">
      {hasInternalUsername && (
        <div className="rounded-lg border border-gray-200 bg-white p-4">
          <p className="text-sm font-semibold text-black mb-2">Redefinir senha</p>
          {tempPassword ? (
            <div>
              <p className="text-xs text-gray-500 mb-1">
                Senha temporária gerada — mostrada só uma vez, repasse por um canal seguro:
              </p>
              <p className="font-mono text-sm bg-gray px-3 py-2 rounded-lg text-black">{tempPassword}</p>
            </div>
          ) : (
            <button
              onClick={handleReset}
              disabled={isSubmitting}
              className="text-xs font-semibold rounded-lg bg-teal text-white px-3 py-2 hover:opacity-90 disabled:opacity-60"
            >
              Gerar nova senha
            </button>
          )}
        </div>
      )}

      <div className="rounded-lg border border-gray-200 bg-white p-4">
        <p className="text-sm font-semibold text-black mb-2">Suspensão</p>
        {suspendSent ? (
          <p className="text-sm text-black bg-green inline-block px-3 py-2 rounded-lg">
            Recomendação enviada — aguardando decisão do Administrador.
          </p>
        ) : !showSuspendForm ? (
          <button
            onClick={() => setShowSuspendForm(true)}
            className="text-xs font-semibold rounded-lg border border-red-300 text-red-600 px-3 py-2 hover:bg-red-50"
          >
            Recomendar suspensão
          </button>
        ) : (
          <form onSubmit={handleSuspend} className="flex flex-col gap-2">
            <textarea
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="Motivo da recomendação"
              rows={2}
              className="input text-xs"
            />
            <button
              type="submit"
              disabled={isSubmitting}
              className="text-xs font-semibold rounded-lg bg-red-600 text-white px-3 py-2 hover:opacity-90 disabled:opacity-60"
            >
              Enviar recomendação
            </button>
          </form>
        )}
      </div>

      {error && <p className="text-sm text-red-600" role="alert">{error}</p>}
    </div>
  );
}
