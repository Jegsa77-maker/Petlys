"use client";

import { useState, useMemo, useEffect } from "react";
import Link from "next/link";
import { createRequest } from "@/lib/actions/requests";
import { createRequestSchema } from "@/lib/validations/requests";
import { trackEvent } from "@/lib/analytics/track";
import {
  missingProntuarioSections,
  PRONTUARIO_SECTION_LABEL,
  CATEGORY_REQUIRED_SECTIONS,
  type ProntuarioSection,
} from "@/lib/domain/category-requirements";
import { CATEGORY_QUESTIONS } from "@/lib/domain/category-questions";
import { checkAvailability, type RecurringWindow, type AvailabilityBlock } from "@/lib/domain/availability-check";
import type { ServiceCategory } from "@/types/database";

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

type PetOption = {
  id: string;
  name: string;
  health_info: unknown;
  behavior_info: unknown;
  routine_info: unknown;
  emergency_info: unknown;
};

export function NewRequestForm({
  professionalId,
  pets,
  requiredSections = CATEGORY_REQUIRED_SECTIONS,
  recurringWindows = [],
  availabilityBlocks = [],
  initialIsVisitaInicial = false,
  initialCategory = "",
  initialPetIds = [],
  initialAddress = "",
  initialCategoryAnswers = {},
  continuarRequestId,
}: {
  professionalId: string;
  pets: PetOption[];
  /** Configurável pelo Admin (`/admin/parametros`) — default de fábrica quando não informado. */
  requiredSections?: Record<ServiceCategory, ProntuarioSection[]>;
  /** Disponibilidade real do profissional (2026-09-05) — usada só pra
   * avisar/bloquear horário fora da janela dele, não pra desenhar um
   * seletor novo (continua o mesmo datetime-local de sempre). */
  recurringWindows?: RecurringWindow[];
  availabilityBlocks?: AvailabilityBlock[];
  initialIsVisitaInicial?: boolean;
  /** "Contratar novamente" (seção 12.3, item 6 da Onda 4) — reaproveita categoria, pets, endereço e respostas de um atendimento anterior. Data e consentimento nunca vêm pré-preenchidos: são específicos de cada pedido. */
  initialCategory?: string;
  initialPetIds?: string[];
  initialAddress?: string;
  initialCategoryAnswers?: Record<string, string>;
  /** Formalizando uma conversa prévia (ver startConversation) — createRequest
      atualiza essa request já existente em vez de criar uma nova. */
  continuarRequestId?: string;
}) {
  const [category, setCategory] = useState(initialCategory);
  const [petIds, setPetIds] = useState<string[]>(initialPetIds);
  const [isRecurring, setIsRecurring] = useState(false);
  const [isVisitaInicial, setIsVisitaInicial] = useState(initialIsVisitaInicial);
  const [occurrencesTotal, setOccurrencesTotal] = useState("1");
  const [recurrenceInterval, setRecurrenceInterval] = useState("semanal");
  const [firstOccurrenceAt, setFirstOccurrenceAt] = useState("");
  const [notes, setNotes] = useState("");
  const [address, setAddress] = useState(initialAddress);
  const [categoryAnswers, setCategoryAnswers] = useState<Record<string, string>>(initialCategoryAnswers);
  const [prontuarioConsent, setProntuarioConsent] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Uma vez por montagem do formulário — não a cada troca de categoria.
  useEffect(() => {
    trackEvent("request_started", {
      professional_id: professionalId,
      category: initialCategory ? (initialCategory as ServiceCategory) : undefined,
      metadata: { entry: continuarRequestId ? "conversa_previa" : "formulario_completo" },
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function togglePet(id: string) {
    setPetIds((prev) => (prev.includes(id) ? prev.filter((p) => p !== id) : [...prev, id]));
  }

  // Requisitos dinâmicos por categoria (seção 6.4) — avisa antes de tentar
  // enviar, com link direto pra completar o prontuário do pet.
  const missingByPet = useMemo(() => {
    if (!category) return [];
    const selectedPets = pets.filter((p) => petIds.includes(p.id));
    return selectedPets
      .map((pet) => ({
        pet,
        missing: missingProntuarioSections(pet, category as ServiceCategory, requiredSections),
      }))
      .filter((entry) => entry.missing.length > 0);
  }, [category, petIds, pets, requiredSections]);

  const hasBlockingRequirements = missingByPet.length > 0;

  // Disponibilidade real do profissional (2026-09-05) — só checa o
  // primeiro atendimento (um contrato recorrente repete o mesmo dia da
  // semana/horário, então cobre o caso comum).
  const availability = useMemo(() => {
    if (!firstOccurrenceAt) return { available: true, reason: null };
    return checkAvailability(new Date(firstOccurrenceAt), recurringWindows, availabilityBlocks);
  }, [firstOccurrenceAt, recurringWindows, availabilityBlocks]);

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
      prontuarioConsent,
      address: address || undefined,
      categoryAnswers,
      existingRequestId: continuarRequestId,
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

      {hasBlockingRequirements && (
        <div className="rounded-lg border border-amber-300 bg-amber-50 p-4 text-sm text-amber-900">
          <p className="font-semibold mb-1">Complete o prontuário antes de continuar</p>
          <ul className="flex flex-col gap-1">
            {missingByPet.map(({ pet, missing }) => (
              <li key={pet.id}>
                <Link href={`/pets/${pet.id}`} className="underline font-medium">
                  {pet.name}
                </Link>
                : falta {missing.map((s) => PRONTUARIO_SECTION_LABEL[s]).join(", ")}
              </li>
            ))}
          </ul>
        </div>
      )}

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
        {!availability.available && (
          <p className="text-sm text-red-600 mt-1" role="alert">
            {availability.reason} Escolha outro horário.
          </p>
        )}
      </div>

      <div>
        <label htmlFor="address" className="block text-sm font-medium text-black mb-1">
          Endereço do atendimento (opcional)
        </label>
        <input
          id="address"
          value={address}
          onChange={(e) => setAddress(e.target.value)}
          className="input"
          placeholder="Rua, número, bairro — se o atendimento for na sua casa"
        />
      </div>

      {category && (CATEGORY_QUESTIONS[category] ?? []).length > 0 && (
        <div className="flex flex-col gap-3">
          {CATEGORY_QUESTIONS[category].map((q) => (
            <div key={q.key}>
              <label className="block text-sm font-medium text-black mb-1">{q.label}</label>
              <input
                value={categoryAnswers[q.key] ?? ""}
                onChange={(e) => setCategoryAnswers((prev) => ({ ...prev, [q.key]: e.target.value }))}
                className="input"
              />
            </div>
          ))}
        </div>
      )}

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

      <label className="flex items-start gap-3 rounded-lg border border-gray-300 px-4 py-3 cursor-pointer">
        <input
          type="checkbox"
          checked={prontuarioConsent}
          onChange={(e) => setProntuarioConsent(e.target.checked)}
          className="mt-0.5 h-4 w-4 accent-teal"
        />
        <span className="text-sm text-black">
          Autorizo compartilhar a ficha completa dos pets selecionados (saúde,
          comportamento, rotina e emergência) com este profissional.
        </span>
      </label>

      {error && <p className="text-sm text-red-600" role="alert">{error}</p>}

      <button
        type="submit"
        disabled={isSubmitting || pets.length === 0 || hasBlockingRequirements || !availability.available}
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
