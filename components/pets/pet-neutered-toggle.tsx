"use client";

import { useState } from "react";
import { updatePetNeutered } from "@/lib/actions/pets";

/**
 * "Castrado" (identificação — doc "Petlys | Perfis - Pilar 1") salva na
 * hora, mesmo espírito de toggleServiceActive — não precisa de botão
 * "Salvar" separado pra um campo sim/não/não informado.
 */
export function PetNeuteredToggle({ petId, initialValue }: { petId: string; initialValue: boolean | null }) {
  const [value, setValue] = useState<boolean | null>(initialValue);
  const [isSaving, setIsSaving] = useState(false);

  async function handleChange(next: boolean) {
    const previous = value;
    setValue(next);
    setIsSaving(true);
    const result = await updatePetNeutered(petId, next);
    setIsSaving(false);
    if (result?.error) setValue(previous);
  }

  return (
    <div className="rounded-lg border border-gray-200 bg-white p-3">
      <p className="text-xs text-gray-500 mb-2">Castrado</p>
      <div className="flex gap-2">
        <button
          type="button"
          onClick={() => handleChange(true)}
          disabled={isSaving}
          className={`flex-1 rounded-lg border px-3 py-1.5 text-xs font-semibold transition-colors disabled:opacity-60 ${
            value === true ? "border-teal bg-teal/5 text-teal" : "border-gray-300 text-gray-600"
          }`}
        >
          Sim
        </button>
        <button
          type="button"
          onClick={() => handleChange(false)}
          disabled={isSaving}
          className={`flex-1 rounded-lg border px-3 py-1.5 text-xs font-semibold transition-colors disabled:opacity-60 ${
            value === false ? "border-teal bg-teal/5 text-teal" : "border-gray-300 text-gray-600"
          }`}
        >
          Não
        </button>
      </div>
    </div>
  );
}
