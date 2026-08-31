"use client";

import { useState } from "react";
import { createPet } from "@/lib/actions/pets";
import { petStep1Schema } from "@/lib/validations/pets";

export function PetForm() {
  const [form, setForm] = useState({
    name: "",
    species: "",
    breed: "",
    sex: "" as "" | "macho" | "femea",
    birthApprox: "",
    size: "" as "" | "pequeno" | "medio" | "grande" | "gigante",
    weight: "",
  });
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  function setField<K extends keyof typeof form>(key: K, value: (typeof form)[K]) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    const parsed = petStep1Schema.safeParse(form);
    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message ?? "Verifique os dados informados");
      return;
    }

    setIsSubmitting(true);
    const result = await createPet(parsed.data);
    setIsSubmitting(false);

    if (result?.error) {
      setError(result.error);
    }
    // Sucesso: createPet já redireciona para /pets/[id].
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4">
      <Field label="Nome do pet">
        <input
          value={form.name}
          onChange={(e) => setField("name", e.target.value)}
          className="input"
          autoFocus
        />
      </Field>

      <Field label="Espécie">
        <input
          value={form.species}
          onChange={(e) => setField("species", e.target.value)}
          placeholder="Ex: Cachorro, Gato"
          className="input"
        />
      </Field>

      <Field label="Raça">
        <input
          value={form.breed}
          onChange={(e) => setField("breed", e.target.value)}
          placeholder="Ex: SRD, Labrador"
          className="input"
        />
      </Field>

      <Field label="Sexo">
        <div className="flex gap-2">
          {(["macho", "femea"] as const).map((option) => (
            <button
              key={option}
              type="button"
              onClick={() => setField("sex", option)}
              className={`flex-1 rounded-lg border px-4 py-3 text-sm font-medium capitalize transition-colors
                ${form.sex === option ? "border-teal bg-teal/5 text-teal" : "border-gray-300 text-black"}`}
            >
              {option === "femea" ? "Fêmea" : "Macho"}
            </button>
          ))}
        </div>
      </Field>

      <Field label="Data de nascimento aproximada">
        <input
          type="date"
          value={form.birthApprox}
          onChange={(e) => setField("birthApprox", e.target.value)}
          className="input"
        />
      </Field>

      <Field label="Porte">
        <div className="grid grid-cols-2 gap-2">
          {(["pequeno", "medio", "grande", "gigante"] as const).map((option) => (
            <button
              key={option}
              type="button"
              onClick={() => setField("size", option)}
              className={`rounded-lg border px-4 py-3 text-sm font-medium capitalize transition-colors
                ${form.size === option ? "border-teal bg-teal/5 text-teal" : "border-gray-300 text-black"}`}
            >
              {option}
            </button>
          ))}
        </div>
      </Field>

      <Field label="Peso aproximado (kg)">
        <input
          type="number"
          inputMode="decimal"
          step="0.1"
          value={form.weight}
          onChange={(e) => setField("weight", e.target.value)}
          className="input"
        />
      </Field>

      {error && <p className="text-sm text-red-600" role="alert">{error}</p>}

      <button
        type="submit"
        disabled={isSubmitting}
        className="w-full rounded-lg bg-teal px-4 py-3 text-sm font-semibold text-white
                   hover:opacity-90 disabled:opacity-60 transition-opacity mt-2"
      >
        {isSubmitting ? "Salvando..." : "Salvar e continuar"}
      </button>
      <p className="text-xs text-gray-500 text-center">
        Depois dá pra completar saúde, comportamento e rotina — só esses
        dados aqui já deixam o pet pronto pra buscar serviços.
      </p>
    </form>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="block text-sm font-medium text-black mb-1">{label}</label>
      {children}
    </div>
  );
}
