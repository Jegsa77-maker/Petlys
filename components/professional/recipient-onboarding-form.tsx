"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { submitRecipientOnboarding } from "@/lib/actions/payments";
import { recipientOnboardingSchema } from "@/lib/validations/payments";

const initialValues = {
  bankCode: "",
  agencia: "",
  agenciaDv: "",
  conta: "",
  contaDv: "",
  contaTipo: "corrente" as "corrente" | "poupanca",
};

export function RecipientOnboardingForm() {
  const router = useRouter();
  const [values, setValues] = useState(initialValues);
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  function setField<K extends keyof typeof values>(key: K, value: (typeof values)[K]) {
    setValues((prev) => ({ ...prev, [key]: value }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    const parsed = recipientOnboardingSchema.safeParse(values);
    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message ?? "Verifique os dados informados");
      return;
    }

    setIsSubmitting(true);
    const result = await submitRecipientOnboarding(values);
    setIsSubmitting(false);

    if (result?.error) {
      setError(result.error);
      return;
    }
    router.refresh();
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4">
      <p className="text-sm text-gray-600">
        Seus dados de recebimento ficam guardados diretamente com o gateway de pagamento —
        a Petlys nunca vê o número da sua conta depois deste cadastro.
      </p>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="block text-sm font-semibold text-black mb-1">Banco (código)</label>
          <input
            type="text"
            inputMode="numeric"
            maxLength={3}
            value={values.bankCode}
            onChange={(e) => setField("bankCode", e.target.value)}
            placeholder="000"
            className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
          />
        </div>
        <div>
          <label className="block text-sm font-semibold text-black mb-1">Tipo de conta</label>
          <select
            value={values.contaTipo}
            onChange={(e) => setField("contaTipo", e.target.value as "corrente" | "poupanca")}
            className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
          >
            <option value="corrente">Conta corrente</option>
            <option value="poupanca">Poupança</option>
          </select>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="block text-sm font-semibold text-black mb-1">Agência</label>
          <input
            type="text"
            value={values.agencia}
            onChange={(e) => setField("agencia", e.target.value)}
            className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
          />
        </div>
        <div>
          <label className="block text-sm font-semibold text-black mb-1">Dígito da agência (opcional)</label>
          <input
            type="text"
            maxLength={2}
            value={values.agenciaDv}
            onChange={(e) => setField("agenciaDv", e.target.value)}
            className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
          />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="block text-sm font-semibold text-black mb-1">Conta</label>
          <input
            type="text"
            value={values.conta}
            onChange={(e) => setField("conta", e.target.value)}
            className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
          />
        </div>
        <div>
          <label className="block text-sm font-semibold text-black mb-1">Dígito da conta</label>
          <input
            type="text"
            maxLength={2}
            value={values.contaDv}
            onChange={(e) => setField("contaDv", e.target.value)}
            className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
          />
        </div>
      </div>

      {error && (
        <p role="alert" className="text-sm text-red-600">
          {error}
        </p>
      )}

      <button
        type="submit"
        disabled={isSubmitting}
        className="rounded-lg bg-teal text-white font-semibold py-2.5 disabled:opacity-60"
      >
        {isSubmitting ? "Enviando..." : "Cadastrar dados de recebimento"}
      </button>
    </form>
  );
}
