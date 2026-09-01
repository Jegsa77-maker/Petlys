"use client";

import { useState } from "react";
import { acceptTerms } from "@/lib/actions/terms";

export function AcceptTermsForm() {
  const [checked, setChecked] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!checked) {
      setError("Marque a caixa para confirmar que você leu e concorda.");
      return;
    }
    setError(null);
    setIsSubmitting(true);
    const result = await acceptTerms();
    setIsSubmitting(false);
    if (result?.error) {
      setError(result.error);
    }
    // Sucesso: acceptTerms já redireciona.
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4">
      <label className="flex items-start gap-3 rounded-lg border border-gray-300 px-4 py-3 cursor-pointer">
        <input
          type="checkbox"
          checked={checked}
          onChange={(e) => setChecked(e.target.checked)}
          className="mt-0.5 h-4 w-4 accent-teal"
        />
        <span className="text-sm text-black">
          Li e concordo com os Termos de Uso e a Política de Privacidade.
        </span>
      </label>

      {error && <p className="text-sm text-red-600" role="alert">{error}</p>}

      <button
        type="submit"
        disabled={isSubmitting}
        className="w-full rounded-lg bg-teal px-4 py-3 text-sm font-semibold text-white hover:opacity-90 disabled:opacity-60"
      >
        {isSubmitting ? "Confirmando..." : "Concordar e continuar"}
      </button>
    </form>
  );
}
