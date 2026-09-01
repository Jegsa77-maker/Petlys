"use client";

import { useState } from "react";
import { ChevronDown, ChevronUp } from "lucide-react";

export type FieldDef = {
  key: string;
  label: string;
  type?: "text" | "textarea" | "checkbox";
};

type ActionResult = { error: string | null };

/**
 * Bloco genérico pras etapas progressivas do prontuário do pet (2 a 5 —
 * saúde, comportamento, rotina, emergência — seção 4.1 da especificação).
 * Reaproveitado pelas 4, só muda título/campos/action — evita repetir o
 * mesmo formulário expansível 4 vezes.
 */
export function PetProfileSection({
  petId,
  title,
  fields,
  initialValues,
  onSave,
}: {
  petId: string;
  title: string;
  fields: FieldDef[];
  initialValues: Record<string, unknown>;
  onSave: (petId: string, values: Record<string, unknown>) => Promise<ActionResult>;
}) {
  const filled = Object.values(initialValues ?? {}).some(
    (v) => (typeof v === "string" && v.trim() !== "") || v === true
  );
  const [editing, setEditing] = useState(false);
  const [values, setValues] = useState<Record<string, unknown>>(() => {
    const base: Record<string, unknown> = {};
    fields.forEach((f) => {
      base[f.key] = f.type === "checkbox" ? false : "";
    });
    return { ...base, ...initialValues };
  });
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [saved, setSaved] = useState(false);

  function setField(key: string, value: unknown) {
    setValues((prev) => ({ ...prev, [key]: value }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setIsSubmitting(true);
    const result = await onSave(petId, values);
    setIsSubmitting(false);
    if (result?.error) {
      setError(result.error);
      return;
    }
    setSaved(true);
    setEditing(false);
  }

  return (
    <div className="rounded-lg border border-gray-200 bg-white p-4">
      <button
        type="button"
        onClick={() => setEditing((v) => !v)}
        className="w-full flex items-center justify-between"
      >
        <span className="text-sm font-semibold text-black">{title}</span>
        <span className="flex items-center gap-2">
          <span
            className={`text-xs font-semibold px-2 py-0.5 rounded-full ${
              filled || saved ? "text-black bg-green" : "text-gray-400 bg-gray"
            }`}
          >
            {filled || saved ? "Preenchido" : "Pendente"}
          </span>
          {editing ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
        </span>
      </button>

      {editing && (
        <form onSubmit={handleSubmit} className="flex flex-col gap-3 mt-4">
          {fields.map((f) =>
            f.type === "checkbox" ? (
              <label key={f.key} className="flex items-center gap-2 text-sm text-black">
                <input
                  type="checkbox"
                  checked={Boolean(values[f.key])}
                  onChange={(e) => setField(f.key, e.target.checked)}
                  className="h-4 w-4 accent-teal"
                />
                {f.label}
              </label>
            ) : (
              <div key={f.key}>
                <label className="block text-xs font-medium text-gray-600 mb-1">{f.label}</label>
                {f.type === "textarea" ? (
                  <textarea
                    value={String(values[f.key] ?? "")}
                    onChange={(e) => setField(f.key, e.target.value)}
                    rows={2}
                    className="input text-sm"
                  />
                ) : (
                  <input
                    value={String(values[f.key] ?? "")}
                    onChange={(e) => setField(f.key, e.target.value)}
                    className="input text-sm"
                  />
                )}
              </div>
            )
          )}

          {error && <p className="text-xs text-red-600" role="alert">{error}</p>}

          <button
            type="submit"
            disabled={isSubmitting}
            className="rounded-lg bg-teal px-3 py-2 text-xs font-semibold text-white hover:opacity-90 disabled:opacity-60"
          >
            {isSubmitting ? "Salvando..." : "Salvar"}
          </button>
        </form>
      )}
    </div>
  );
}
