"use client";

import { useState } from "react";
import { updateTutorAddress } from "@/lib/actions/tutor-profile";

/**
 * Endereço do Tutor (opcional) — alimenta o mapa de cobertura do Admin.
 * Só CEP, geocodificado no servidor (ver lib/services/geocoding.ts); não
 * pede endereço completo/número, que não seria mais preciso pro propósito
 * (identificar região com demanda, não entregar coisa nenhuma aqui).
 */
export function AddressForm({ currentZip }: { currentZip: string | null }) {
  const [cep, setCep] = useState(currentZip ?? "");
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSuccess(false);
    setIsSubmitting(true);
    try {
      const result = await updateTutorAddress({ cep });
      if (result?.error) {
        setError(result.error);
        return;
      }
      setSuccess(true);
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="rounded-lg border border-gray-200 bg-white p-4 flex flex-col gap-3">
      <div>
        <h2 className="text-sm font-semibold text-black">Endereço</h2>
        <p className="text-xs text-gray-500 mt-1">
          Opcional. Ajuda a gente a entender em quais regiões tem mais gente procurando serviço —
          não aparece pra nenhum profissional, só o CEP fica salvo no seu perfil.
        </p>
      </div>
      <input
        value={cep}
        onChange={(e) => setCep(e.target.value)}
        placeholder="CEP (ex: 01310-100)"
        className="input"
        maxLength={9}
      />
      {error && (
        <p role="alert" className="text-sm text-red-600">
          {error}
        </p>
      )}
      {success && <p className="text-sm text-teal">Endereço salvo!</p>}
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
