"use client";

import { useState } from "react";
import { sendPhoneOtp, verifyPhoneOtp } from "@/lib/actions/auth";
import { phoneFormSchema, otpFormSchema } from "@/lib/validations/auth";

type Step = "telefone" | "codigo";

export function VerifyPhoneForm() {
  const [step, setStep] = useState<Step>("telefone");
  const [phone, setPhone] = useState("");
  const [token, setToken] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleSendCode(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    const parsed = phoneFormSchema.safeParse({ phone });
    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message ?? "Telefone inválido");
      return;
    }

    setIsSubmitting(true);
    const result = await sendPhoneOtp({ phone: parsed.data.phone });
    setIsSubmitting(false);

    if (result.error) {
      setError(result.error);
      return;
    }
    setStep("codigo");
  }

  async function handleConfirmCode(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    const parsed = otpFormSchema.safeParse({ phone, token });
    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message ?? "Código inválido");
      return;
    }

    setIsSubmitting(true);
    const result = await verifyPhoneOtp({ phone: parsed.data.phone, token: parsed.data.token });
    setIsSubmitting(false);

    if (result?.error) {
      setError(result.error);
    }
    // Em caso de sucesso, verifyPhoneOtp já redireciona (redirect() no server).
  }

  if (step === "telefone") {
    return (
      <form onSubmit={handleSendCode} className="flex flex-col gap-4">
        <div>
          <label htmlFor="phone" className="block text-sm font-medium text-black mb-1">
            Telefone (com DDD)
          </label>
          <input
            id="phone"
            type="tel"
            inputMode="tel"
            placeholder="+5511987654321"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            className="w-full rounded-lg border border-gray-300 px-4 py-3 text-base
                       focus:outline-none focus:ring-2 focus:ring-teal"
            autoFocus
          />
        </div>
        {error && <p className="text-sm text-red-600" role="alert">{error}</p>}
        <button
          type="submit"
          disabled={isSubmitting}
          className="w-full rounded-lg bg-teal px-4 py-3 text-sm font-semibold text-white
                     hover:opacity-90 disabled:opacity-60 transition-opacity"
        >
          {isSubmitting ? "Enviando..." : "Enviar código por SMS"}
        </button>
      </form>
    );
  }

  return (
    <form onSubmit={handleConfirmCode} className="flex flex-col gap-4">
      <div>
        <p className="text-sm text-gray-600 mb-3">
          Enviamos um código de 6 dígitos para <strong>{phone}</strong>.
        </p>
        <label htmlFor="token" className="block text-sm font-medium text-black mb-1">
          Código de verificação
        </label>
        <input
          id="token"
          type="text"
          inputMode="numeric"
          maxLength={6}
          placeholder="000000"
          value={token}
          onChange={(e) => setToken(e.target.value.replace(/\D/g, ""))}
          className="w-full rounded-lg border border-gray-300 px-4 py-3 text-base tracking-[0.5em] text-center
                     focus:outline-none focus:ring-2 focus:ring-teal"
          autoFocus
        />
      </div>
      {error && <p className="text-sm text-red-600" role="alert">{error}</p>}
      <button
        type="submit"
        disabled={isSubmitting}
        className="w-full rounded-lg bg-teal px-4 py-3 text-sm font-semibold text-white
                   hover:opacity-90 disabled:opacity-60 transition-opacity"
      >
        {isSubmitting ? "Confirmando..." : "Confirmar código"}
      </button>
      <button
        type="button"
        onClick={() => setStep("telefone")}
        className="text-sm text-gray-500 hover:text-black underline underline-offset-2"
      >
        Corrigir número de telefone
      </button>
    </form>
  );
}
