"use client";

import { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { SlidersHorizontal } from "lucide-react";
import { SERVICE_SUBCATEGORIES, SPECIES_OPTIONS } from "@/lib/domain/service-catalog";

const NOTA_OPTIONS = [
  { value: "", label: "Qualquer nota" },
  { value: "3", label: "3+ estrelas" },
  { value: "4", label: "4+ estrelas" },
  { value: "4.5", label: "4,5+ estrelas" },
];

/**
 * Filtros avançados de busca (seção 12.1) — preço, nota mínima,
 * subcategoria e espécie. Categoria/localização continuam sendo os chips
 * e o botão de localização já existentes (fora deste componente); aqui só
 * mesclamos os novos parâmetros na mesma URL via useSearchParams, seguindo
 * o padrão de UseMyLocationButton.
 */
export function SearchFiltersForm({ isTutorLoggedIn }: { isTutorLoggedIn: boolean }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [isOpen, setIsOpen] = useState(false);

  const categoria = searchParams.get("categoria") ?? "";
  const subcategoryOptions = categoria ? SERVICE_SUBCATEGORIES[categoria] ?? [] : [];

  const [precoMin, setPrecoMin] = useState(searchParams.get("precoMin") ?? "");
  const [precoMax, setPrecoMax] = useState(searchParams.get("precoMax") ?? "");
  const [notaMin, setNotaMin] = useState(searchParams.get("notaMin") ?? "");
  const [subcategoria, setSubcategoria] = useState(searchParams.get("subcategoria") ?? "");
  const [especie, setEspecie] = useState(searchParams.get("especie") ?? "");
  const [apenasFavoritos, setApenasFavoritos] = useState(searchParams.get("favoritos") === "1");

  const activeCount = [precoMin, precoMax, notaMin, subcategoria, especie, apenasFavoritos ? "1" : ""].filter(
    Boolean
  ).length;

  function applyFilters(e: React.FormEvent) {
    e.preventDefault();
    const params = new URLSearchParams(searchParams.toString());

    function setOrDelete(key: string, value: string) {
      if (value) params.set(key, value);
      else params.delete(key);
    }

    setOrDelete("precoMin", precoMin);
    setOrDelete("precoMax", precoMax);
    setOrDelete("notaMin", notaMin);
    setOrDelete("subcategoria", subcategoria);
    setOrDelete("especie", especie);
    setOrDelete("favoritos", apenasFavoritos ? "1" : "");

    router.push(`/buscar?${params.toString()}`);
    setIsOpen(false);
  }

  function clearFilters() {
    setPrecoMin("");
    setPrecoMax("");
    setNotaMin("");
    setSubcategoria("");
    setEspecie("");
    setApenasFavoritos(false);
    const params = new URLSearchParams(searchParams.toString());
    ["precoMin", "precoMax", "notaMin", "subcategoria", "especie", "favoritos"].forEach((k) => params.delete(k));
    router.push(`/buscar?${params.toString()}`);
    setIsOpen(false);
  }

  return (
    <div className="mb-4">
      <button
        type="button"
        onClick={() => setIsOpen((v) => !v)}
        className={`flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-full border transition-colors ${
          activeCount > 0 ? "border-teal bg-teal text-white" : "border-gray-300 text-gray-600"
        }`}
      >
        <SlidersHorizontal size={12} />
        Filtros{activeCount > 0 ? ` (${activeCount})` : ""}
      </button>

      {isOpen && (
        <form onSubmit={applyFilters} className="mt-3 flex flex-col gap-3 rounded-lg border border-gray-200 bg-white p-4">
          <div className="flex gap-2">
            <input
              type="number"
              min={0}
              value={precoMin}
              onChange={(e) => setPrecoMin(e.target.value)}
              placeholder="Preço mín. (R$)"
              className="input"
            />
            <input
              type="number"
              min={0}
              value={precoMax}
              onChange={(e) => setPrecoMax(e.target.value)}
              placeholder="Preço máx. (R$)"
              className="input"
            />
          </div>

          <select value={notaMin} onChange={(e) => setNotaMin(e.target.value)} className="input">
            {NOTA_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>{opt.label}</option>
            ))}
          </select>

          {subcategoryOptions.length > 0 && (
            <select value={subcategoria} onChange={(e) => setSubcategoria(e.target.value)} className="input">
              <option value="">Qualquer subcategoria</option>
              {subcategoryOptions.map((label) => (
                <option key={label} value={label}>{label}</option>
              ))}
            </select>
          )}

          <select value={especie} onChange={(e) => setEspecie(e.target.value)} className="input">
            <option value="">Qualquer espécie</option>
            {SPECIES_OPTIONS.map((s) => (
              <option key={s} value={s}>{s}</option>
            ))}
          </select>

          {isTutorLoggedIn && (
            <label className="flex items-center gap-2 text-sm text-black">
              <input
                type="checkbox"
                checked={apenasFavoritos}
                onChange={(e) => setApenasFavoritos(e.target.checked)}
                className="h-4 w-4 accent-teal"
              />
              Somente favoritos
            </label>
          )}

          <div className="flex gap-2">
            <button
              type="submit"
              className="flex-1 rounded-lg bg-teal px-4 py-2 text-sm font-semibold text-white hover:opacity-90"
            >
              Aplicar filtros
            </button>
            <button
              type="button"
              onClick={clearFilters}
              className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-semibold text-gray-600"
            >
              Limpar
            </button>
          </div>
        </form>
      )}
    </div>
  );
}
