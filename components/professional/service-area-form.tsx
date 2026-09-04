"use client";

import { useState } from "react";
import { upsertServiceArea } from "@/lib/actions/service-area";
import { RADIUS_OPTIONS_KM } from "@/lib/validations/service-area";

/**
 * Área de atendimento (CEP + raio) — item que faltava desde a fundação:
 * a tabela e a RLS existiam, mas nenhuma tela nunca deixou o Profissional
 * preencher isso (os únicos registros que existiam vieram de SQL de teste).
 */
export function ServiceAreaForm({
  currentZip,
  currentRadiusKm,
}: {
  currentZip: string | null;
  currentRadiusKm: number | null;
}) {
  const [cep, setCep] = useState(currentZip ?? "");
  const [radiusKm, setRadiusKm] = useState<number | null>(currentRadiusKm ?? 10);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSuccess(false);
    setIsSubmitting(true);
    const result = await upsertServiceArea({ cep, radiusKm });
    setIsSubmitting(false);
    if (result?.error) {
      setError(result.error);
      return;
    }
    setSuccess(true);
  }

  return (
    <form onSubmit={handleSubmit} className="rounded-lg border border-gray-200 bg-white p-4 flex flex-col gap-3">
      <div>
        <h2 className="text-sm font-semibold text-black">Área de atendimento</h2>
        <p className="text-xs text-gray-500 mt-1">
          A partir de qual CEP você atende, e até que distância. Isso decide quando seu perfil aparece
          pro Tutor filtrar por localização na busca.
        </p>
      </div>

      <input
        value={cep}
        onChange={(e) => setCep(e.target.value)}
        placeholder="CEP (ex: 01310-100)"
        className="input"
        maxLength={9}
      />

      <div>
        <p className="text-xs text-gray-500 mb-2">Raio de atendimento</p>
        <div className="flex flex-wrap gap-2">
          {RADIUS_OPTIONS_KM.map((km) => (
            <button
              key={km}
              type="button"
              onClick={() => setRadiusKm(km)}
              className={`rounded-full border px-3 py-1.5 text-xs font-medium transition-colors ${
                radiusKm === km ? "border-teal bg-teal text-white" : "border-gray-300 text-gray-600"
              }`}
            >
              Até {km} km
            </button>
          ))}
          <button
            type="button"
            onClick={() => setRadiusKm(null)}
            className={`rounded-full border px-3 py-1.5 text-xs font-medium transition-colors ${
              radiusKm === null ? "border-teal bg-teal text-white" : "border-gray-300 text-gray-600"
            }`}
          >
            Sem restrição
          </button>
        </div>
      </div>

      {error && (
        <p role="alert" className="text-sm text-red-600">
          {error}
        </p>
      )}
      {success && <p className="text-sm text-teal">Área de atendimento salva!</p>}

      <button
        type="submit"
        disabled={isSubmitting}
        className="rounded-lg bg-teal text-white font-semibold py-3 disabled:opacity-60"
      >
        {isSubmitting ? "Salvando..." : "Salvar"}
      </button>
    </form>
  );
}
