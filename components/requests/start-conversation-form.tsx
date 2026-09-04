"use client";

import { useState, useEffect } from "react";
import { startConversation } from "@/lib/actions/requests";
import { trackEvent } from "@/lib/analytics/track";

// Mesmo rótulo de components/requests/new-request-form.tsx — o projeto já
// duplica isso em vários lugares (ver lib/domain/service-catalog.ts,
// achado colateral registrado no CHANGELOG), não centralizando aqui de
// propósito, fora do escopo desta feature.
const CATEGORY_LABEL: Record<string, string> = {
  pet_sitter: "Pet sitter / cuidador",
  passeador: "Passeador de cães",
  hospedagem_creche: "Hospedagem / creche",
  adestrador: "Adestrador / comportamentalista",
  banho_tosa: "Banho e tosa",
  veterinario_domiciliar: "Veterinário domiciliar",
};

export function StartConversationForm({ professionalId }: { professionalId: string }) {
  const [category, setCategory] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    trackEvent("request_started", { professional_id: professionalId, metadata: { entry: "conversa_previa" } });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!category) {
      setError("Selecione o assunto da conversa");
      return;
    }
    setIsSubmitting(true);
    const result = await startConversation({ professionalId, category });
    setIsSubmitting(false);
    if (result?.error) {
      setError(result.error);
    }
    // Em caso de sucesso, startConversation já faz redirect() — nada a
    // fazer aqui.
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4">
      <p className="text-sm text-gray-600">
        Sobre o que você quer conversar? Isso ajuda o profissional a entender sua dúvida —
        você ainda não está criando uma solicitação de verdade.
      </p>
      <div className="grid grid-cols-1 gap-2">
        {Object.entries(CATEGORY_LABEL).map(([value, label]) => (
          <button
            key={value}
            type="button"
            onClick={() => setCategory(value)}
            className={`rounded-lg border px-4 py-3 text-left text-sm font-medium ${
              category === value
                ? "border-teal bg-teal/10 text-teal"
                : "border-gray-300 text-black hover:border-teal"
            }`}
          >
            {label}
          </button>
        ))}
      </div>
      {error && (
        <p role="alert" className="text-sm text-red-600">
          {error}
        </p>
      )}
      <button
        type="submit"
        disabled={isSubmitting}
        className="rounded-lg bg-teal text-white font-semibold py-3 disabled:opacity-60"
      >
        {isSubmitting ? "Abrindo conversa..." : "Começar a conversar"}
      </button>
    </form>
  );
}
