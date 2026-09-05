"use client";

import { useState } from "react";
import Link from "next/link";
import { Plus, X } from "lucide-react";
import { createService } from "@/lib/actions/services";
import { createServiceSchema } from "@/lib/validations/services";
import { SERVICE_SUBCATEGORIES, SPECIES_OPTIONS, PET_SIZES, PET_SIZE_LABEL } from "@/lib/domain/service-catalog";
import { SERVICE_CATEGORY_LABEL as CATEGORY_LABEL } from "@/lib/domain/service-catalog";
import { SERVICE_CATEGORY_FIELDS } from "@/lib/domain/service-category-fields";
import type { ServiceCategory } from "@/types/database";

const PRICING_LABEL: Record<string, string> = {
  fixo: "Preço fixo",
  a_partir_de: "A partir de",
  faixa: "Faixa de valores",
  diaria: "Diária",
  hora: "Por hora",
  pacote: "Pacote",
  orcamento_personalizado: "Orçamento personalizado",
};

type AddonDraft = { name: string; price: string };

export function ServiceForm({
  skillCategories,
  onCreated,
}: {
  /** Categorias que o profissional já declarou como "Habilidade" (2026-09-06)
   * — só essas podem virar Serviço; libera os campos específicos de cada uma. */
  skillCategories: ServiceCategory[];
  onCreated?: () => void;
}) {
  const [category, setCategory] = useState("");
  const [categoryDetails, setCategoryDetails] = useState<Record<string, string | boolean>>({});
  const [subcategory, setSubcategory] = useState("");
  const [pricingModel, setPricingModel] = useState("");
  const [basePrice, setBasePrice] = useState("");
  const [multiPetDiscountPercent, setMultiPetDiscountPercent] = useState("");
  const [description, setDescription] = useState("");
  const [durationMinutes, setDurationMinutes] = useState("");
  const [speciesAccepted, setSpeciesAccepted] = useState<string[]>([]);
  const [minSize, setMinSize] = useState("");
  const [maxSize, setMaxSize] = useState("");
  const [restrictions, setRestrictions] = useState("");
  const [addons, setAddons] = useState<AddonDraft[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  function toggleSpecies(species: string) {
    setSpeciesAccepted((prev) =>
      prev.includes(species) ? prev.filter((s) => s !== species) : [...prev, species]
    );
  }

  function addAddonRow() {
    setAddons((prev) => [...prev, { name: "", price: "" }]);
  }

  function updateAddon(index: number, field: keyof AddonDraft, value: string) {
    setAddons((prev) => prev.map((a, i) => (i === index ? { ...a, [field]: value } : a)));
  }

  function removeAddon(index: number) {
    setAddons((prev) => prev.filter((_, i) => i !== index));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    const parsed = createServiceSchema.safeParse({
      category,
      subcategory: subcategory || undefined,
      pricingModel,
      basePrice: basePrice || undefined,
      multiPetDiscountPercent: multiPetDiscountPercent || undefined,
      description: description || undefined,
      durationMinutes: durationMinutes || undefined,
      speciesAccepted,
      minSize: minSize || undefined,
      maxSize: maxSize || undefined,
      restrictions: restrictions || undefined,
      addons: addons
        .filter((a) => a.name.trim() || a.price.trim())
        .map((a) => ({ name: a.name, price: a.price || 0 })),
      categoryDetails,
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
    setSubcategory("");
    setPricingModel("");
    setBasePrice("");
    setMultiPetDiscountPercent("");
    setDescription("");
    setDurationMinutes("");
    setSpeciesAccepted([]);
    setMinSize("");
    setMaxSize("");
    setRestrictions("");
    setAddons([]);
    setCategoryDetails({});
    onCreated?.();
  }

  function setCategoryDetail(key: string, value: string | boolean) {
    setCategoryDetails((prev) => ({ ...prev, [key]: value }));
  }

  const subcategoryOptions = category ? SERVICE_SUBCATEGORIES[category] ?? [] : [];
  const categoryFields = category ? SERVICE_CATEGORY_FIELDS[category as ServiceCategory] ?? [] : [];

  if (skillCategories.length === 0) {
    return (
      <div className="rounded-lg border border-amber-300 bg-amber-50 p-4 text-sm text-amber-900">
        <p className="font-semibold mb-1">Adicione uma habilidade antes de publicar um serviço</p>
        <p>
          Em <Link href="/perfil" className="underline font-medium">Meu perfil</Link>, na seção
          &quot;Habilidades&quot;, escolha a categoria que você atua — isso libera os campos certos pra
          publicar o serviço aqui.
        </p>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-3 rounded-lg border border-gray-200 bg-white p-4">
      <p className="text-sm font-semibold text-black">Novo serviço</p>

      <select
        value={category}
        onChange={(e) => {
          setCategory(e.target.value);
          setSubcategory("");
          setCategoryDetails({});
        }}
        className="input"
      >
        <option value="">Categoria</option>
        {skillCategories.map((value) => (
          <option key={value} value={value}>{CATEGORY_LABEL[value]}</option>
        ))}
      </select>

      {subcategoryOptions.length > 0 && (
        <select value={subcategory} onChange={(e) => setSubcategory(e.target.value)} className="input">
          <option value="">Subcategoria (opcional)</option>
          {subcategoryOptions.map((label) => (
            <option key={label} value={label}>{label}</option>
          ))}
        </select>
      )}

      {categoryFields.length > 0 && (
        <div className="flex flex-col gap-2 rounded-lg border border-gray-100 bg-gray-50 p-3">
          <p className="text-xs font-semibold text-gray-600">Específico de {CATEGORY_LABEL[category]}</p>
          {categoryFields.map((field) => {
            const value = categoryDetails[field.key];
            if (field.type === "checkbox") {
              return (
                <label key={field.key} className="flex items-center gap-2 text-sm text-black">
                  <input
                    type="checkbox"
                    checked={Boolean(value)}
                    onChange={(e) => setCategoryDetail(field.key, e.target.checked)}
                    className="h-4 w-4 accent-teal"
                  />
                  {field.label}
                </label>
              );
            }
            if (field.type === "select") {
              return (
                <div key={field.key}>
                  <label className="block text-xs font-medium text-gray-600 mb-1">{field.label}</label>
                  <select
                    value={String(value ?? "")}
                    onChange={(e) => setCategoryDetail(field.key, e.target.value)}
                    className="input text-sm"
                  >
                    <option value="">Selecione</option>
                    {field.options?.map((opt) => (
                      <option key={opt.value} value={opt.value}>{opt.label}</option>
                    ))}
                  </select>
                </div>
              );
            }
            return (
              <div key={field.key}>
                <label className="block text-xs font-medium text-gray-600 mb-1">{field.label}</label>
                {field.type === "textarea" ? (
                  <textarea
                    value={String(value ?? "")}
                    onChange={(e) => setCategoryDetail(field.key, e.target.value)}
                    rows={2}
                    placeholder={field.placeholder}
                    className="input text-sm"
                  />
                ) : (
                  <input
                    type={field.type === "number" ? "number" : field.type === "time" ? "time" : "text"}
                    value={String(value ?? "")}
                    onChange={(e) => setCategoryDetail(field.key, e.target.value)}
                    placeholder={field.placeholder}
                    className="input text-sm"
                  />
                )}
              </div>
            );
          })}
        </div>
      )}

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

      <input
        type="number"
        step="5"
        min={1}
        value={durationMinutes}
        onChange={(e) => setDurationMinutes(e.target.value)}
        placeholder="Duração média (minutos) — opcional"
        className="input"
      />

      <div>
        <p className="text-xs font-medium text-black mb-1">Espécies atendidas (vazio = qualquer uma)</p>
        <div className="flex gap-2 flex-wrap">
          {SPECIES_OPTIONS.map((species) => (
            <label
              key={species}
              className={`flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs cursor-pointer
                ${speciesAccepted.includes(species) ? "border-teal bg-teal/5 text-teal" : "border-gray-300 text-gray-600"}`}
            >
              <input
                type="checkbox"
                checked={speciesAccepted.includes(species)}
                onChange={() => toggleSpecies(species)}
                className="h-3 w-3 accent-teal"
              />
              {species}
            </label>
          ))}
        </div>
      </div>

      <div className="flex gap-2">
        <select value={minSize} onChange={(e) => setMinSize(e.target.value)} className="input">
          <option value="">Porte mínimo (opcional)</option>
          {PET_SIZES.map((size) => (
            <option key={size} value={size}>{PET_SIZE_LABEL[size]}</option>
          ))}
        </select>
        <select value={maxSize} onChange={(e) => setMaxSize(e.target.value)} className="input">
          <option value="">Porte máximo (opcional)</option>
          {PET_SIZES.map((size) => (
            <option key={size} value={size}>{PET_SIZE_LABEL[size]}</option>
          ))}
        </select>
      </div>

      <textarea
        value={restrictions}
        onChange={(e) => setRestrictions(e.target.value)}
        placeholder="Restrições (ex.: não atendo cães com histórico de agressividade) — opcional"
        rows={2}
        className="input"
      />

      <textarea
        value={description}
        onChange={(e) => setDescription(e.target.value)}
        placeholder="Descrição do serviço — opcional"
        rows={2}
        className="input"
      />

      <div>
        <div className="flex items-center justify-between mb-1">
          <p className="text-xs font-medium text-black">Adicionais (opcional)</p>
          <button
            type="button"
            onClick={addAddonRow}
            className="flex items-center gap-1 text-xs font-semibold text-teal hover:underline"
          >
            <Plus size={14} /> Adicionar
          </button>
        </div>
        {addons.map((addon, index) => (
          <div key={index} className="flex gap-2 mb-2">
            <input
              value={addon.name}
              onChange={(e) => updateAddon(index, "name", e.target.value)}
              placeholder="Ex.: Leva e traz"
              className="input flex-1"
            />
            <input
              type="number"
              step="0.01"
              value={addon.price}
              onChange={(e) => updateAddon(index, "price", e.target.value)}
              placeholder="R$"
              className="input w-24"
            />
            <button
              type="button"
              onClick={() => removeAddon(index)}
              className="text-gray-400 hover:text-red-600"
              aria-label="Remover adicional"
            >
              <X size={16} />
            </button>
          </div>
        ))}
      </div>

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
