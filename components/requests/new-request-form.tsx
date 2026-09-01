"use client";

import { useState } from "react";
import { createRequest } from "@/lib/actions/requests";
import { createRequestSchema } from "@/lib/validations/requests";

const RECURRENCE_LABEL: Record<string, string> = {
  diario: "Todo dia",
  semanal: "Toda semana",
  quinzenal: "A cada 15 dias",
  mensal: "Todo mês",
};

const CATEGORY_LABEL: Record<string, string> = {
  pet_sitter: "Pet sitter / cuidador",
  passeador: "Passeador de cães",
  hospedagem_creche: "Hospedagem / creche",
  adestrador: "Adestrador / comportamentalista",
  banho_tosa: "Banho e tosa",
  veterinario_domiciliar: "Veterinário domiciliar",
};

type PetOption = { id: string; name: string };

export function NewRequestForm({
  professionalId,
  pets,
}: {
  professionalId: string;
  pets: PetOption[];
}) {
  const [category, setCategory] = useState("");
  const [petIds, setPetIds] = useState<string[]>([]);
  const [isRecurring, setIsRecurring] = useState(false);
  const [isVisitaInicial, setIsVisitaInicial] = useState(false);
  const [occurrencesTotal, setOccurrencesTotal] = useState("1");
  const [recurrenceInterval, setRecurrenceInterval] = useState("semanal");
  const [firstOccurrenceAt, setFirstOccurrenceAt] = useState("");
  const [notes, setNotes] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  function togglePet(id: string) {
    setPetIds((prev) => (prev.includes(id) ? prev.filter((p) => p !== id) : [...prev, id]));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    const parsed = createRequestSchema.safeParse({
      professionalId,
      category,
      petIds,
      isRecurring,
      occurrencesTotal: isRecurring ? occurrencesTotal : "1",
      recurrenceInterval,
      firstOccurrenceAt,
      notes: notes || undefined,
      isVisitaInicial,
    });

    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message ?? "Verifique os dados informados");
      return;
    }

    setIsSubmitting(true);
    const result = await createRequest(parsed.data);
    setIsSubmitting(false);

    if (result?.error) {
      setError(result.error);
    }
    // Sucesso: createRequest já redireciona para /solicitacoes/[id].
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-5">
      <div>
        <p className="block text-sm font-medium text-black mb-2">Categoria do serviço</p>
        <select value={category} onChange={(e) => setCategory(e.target.value)} className="input">
          <option value="">Selecione</option>
          {Object.entries(CATEGORY_LABEL).map(([value, label]) => (
            <option key={value} value={value}>{label}</option>
          ))}
        </select>
      </div>

      <div>
        <p className="block text-sm font-medium text-black mb-2">Pets</p>
        {pets.length === 0 ? (
          <p className="text-sm text-gray-500">
            Você precisa cadastrar um pet antes de solicitar um atendimento.
          </p>
        ) : (
          <div className="flex flex-col gap-2">
            {pets.map((pet) => (
              <label
                key={pet.id}
                className={`flex items-center gap-3 rounded-lg border px-4 py-3 cursor-pointer transition-colors
                  ${petIds.includes(pet.id) ? "border-teal bg-teal/5" : "border-gray-300"}`}
              >
                <input
                  type="checkbox"
                  checked={petIds.includes(pet.id)}
                  onChange={() => togglePet(pet.id)}
                  className="h-4 w-4 accent-teal"
                />
                <span className="text-sm font-medium text-black">{pet.name}</span>
              </label>
            ))}
          </div>
        )}
      </div>

      <label className="flex items-center gap-3 rounded-lg border border-gray-300 px-4 py-3 cursor-pointer">
        <input
          type="checkbox"
          checked={isVisitaInicial}
          onChange={(e) => setIsVisitaInicial(e.target.checked)}
          className="h-4 w-4 accent-teal"
        />
        <span className="text-sm font-medium text-black">
          Solicitar como visita inicial (conhecer antes de contratar)
        </span>
      </label>

      <label className="flex items-center gap-3 rounded-lg border border-gray-300 px-4 py-3 cursor-pointer">
        <input
          type="checkbox"
          checked={isRecurring}
          onChange={(e) => setIsRecurring(e.target.checked)}
          className="h-4 w-4 accent-teal"
        />
        <span className="text-sm font-medium text-black">Atendimento recorrente</span>
      </label>

      {isRecurring && (
        <>
          <div>
            <label htmlFor="occurrencesTotal" className="block text-sm font-medium text-black mb-1">
              Número de ocorrências
            </label>
            <input
              id="occurrencesTotal"
              type="number"
              min={1}
              value={occurrencesTotal}
              onChange={(e) => setOccurrencesTotal(e.target.value)}
              className="input"
            />
          </div>
          <div>
            <label htmlFor="recurrenceInterval" className="block text-sm font-medium text-black mb-1">
              Frequência
            </label>
            <select
              id="recurrenceInterval"
              value={recurrenceInterval}
              onChange={(e) => setRecurrenceInterval(e.target.value)}
              className="input"
            >
              {Object.entries(RECURRENCE_LABEL).map(([value, label]) => (
                <option key={value} value={value}>{label}</option>
              ))}
            </select>
          </div>
        </>
      )}

      <div>
        <label htmlFor="firstOccurrenceAt" className="block text-sm font-medium text-black mb-1">
          {isRecurring ? "Data e hora do primeiro atendimento" : "Data e hora do atendimento"}
        </label>
        <input
          id="firstOccurrenceAt"
          type="datetime-local"
          value={firstOccurrenceAt}
          onChange={(e) => setFirstOccurrenceAt(e.target.value)}
          className="input"
        />
      </div>

      <div>
        <label htmlFor="notes" className="block text-sm font-medium text-black mb-1">
          Contexto (opcional)
        </label>
        <textarea
          id="notes"
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          rows={3}
          className="input"
          placeholder="Conte um pouco sobre a necessidade do seu pet"
        />
      </div>

      {error && <p className="text-sm text-red-600" role="alert">{error}</p>}

      <button
        type="submit"
        disabled={isSubmitting || pets.length === 0}
        className="w-full rounded-lg bg-teal px-4 py-3 text-sm font-semibold text-white
                   hover:opacity-90 disabled:opacity-60 transition-opacity"
      >
        {isSubmitting ? "Enviando..." : "Enviar solicitação"}
      </button>
      <p className="text-xs text-gray-500 text-center">
        Nenhuma cobrança nesta etapa — o pagamento só acontece depois que
        vocês combinarem os detalhes.
      </p>
    </form>
  );
}
