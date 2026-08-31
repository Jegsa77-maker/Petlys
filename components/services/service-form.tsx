"use client";

import { useState } from "react";
import { createService } from "@/lib/actions/services";
import { createServiceSchema } from "@/lib/validations/services";

const CATEGORY_LABEL: Record<string, string> = {
  pet_sitter: "Pet sitter / cuidador",
  passeador: "Passeador de cães",
  hospedagem_creche: "Hospedagem / creche",
  adestrador: "Adestrador / comportamentalista",
  banho_tosa: "Banho e tosa",
  veterinario_domiciliar: "Veterinário domiciliar",
};

const PRICING_LABEL: Record<string, string> = {
  fixo: "Preço fixo",
  a_partir_de: "A partir de",
  faixa: "Faixa de valores",
  diaria: "Diária",
  hora: "Por hora",
  pacote: "Pacote",
  orcamento_personalizado: "Orçamento personalizado",
};

export function ServiceForm({ onCreated }: { onCreated?: () => void }) {
  const [category, setCategory] = useState("");
  const [pricingModel, setPricingModel] = useState("");
  const [basePrice, setBasePrice] = useState("");
  const [multiPetDiscountPercent, setMultiPetDiscountPercent] = useState("");
  const [description, setDescription] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    const parsed = createServiceSchema.safeParse({
      category,
      pricingModel,
      basePrice: basePrice || undefined,
      multiPetDiscountPercent: multiPetDiscountPercent || undefined,
      description: description || undefined,
    });

    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message ?? "Verifique os dados informados");
      return;
    }

    setIsSubmitting(true);
    const result = await createService(parsed.data);
    setIsSubmitting(false);

    if (result?.error) {
      setError(result.error);
      return;
    }
    setCategory("");
    setPricingModel("");
    setBasePrice("");
    setMultiPetDiscountPercent("");
    setDescription("");
    onCreated?.();
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-3 rounded-lg border border-gray-200 bg-white p-4">
      <p className="text-sm font-semibold text-black">Novo serviço</p>

      <select value={category} onChange={(e) => setCategory(e.target.value)} className="input">
        <option value="">Categoria</option>
        {Object.entries(CATEGORY_LABEL).map(([value, label]) => (
          <option key={value} value={value}>{label}</option>
        ))}
      </select>

      <select value={pricingModel} onChange={(e) => setPricingModel(e.target.value)} className="input">
        <option value="">Modelo de preço</option>
        {Object.entries(PRICING_LABEL).map(([value, label]) => (
          <option key={value} value={value}>{label}</option>
        ))}
      </select>

      <input
        type="number"
        step="0.01"
        value={basePrice}
        onChange={(e) => setBasePrice(e.target.value)}
        placeholder="Valor de referência (R$) — opcional"
        className="input"
      />

      <input
        type="number"
        step="1"
        min={0}
        max={100}
        value={multiPetDiscountPercent}
        onChange={(e) => setMultiPetDiscountPercent(e.target.value)}
        placeholder="Desconto para múltiplos pets (%) — opcional"
        className="input"
      />

      <textarea
        value={description}
        onChange={(e) => setDescription(e.target.value)}
        placeholder="Descrição do serviço — opcional"
        rows={2}
        className="input"
      />

      {error && <p className="text-sm text-red-600" role="alert">{error}</p>}

      <button
        type="submit"
        disabled={isSubmitting}
        className="rounded-lg bg-teal px-4 py-2 text-sm font-semibold text-white hover:opacity-90 disabled:opacity-60"
      >
        {isSubmitting ? "Publicando..." : "Publicar serviço"}
      </button>
    </form>
  );
}
