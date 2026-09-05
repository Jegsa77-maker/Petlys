"use client";

import { useState } from "react";
import { X } from "lucide-react";
import { addProfessionalSkill, removeProfessionalSkill } from "@/lib/actions/professional-skills";
import { SERVICE_CATEGORY_LABEL } from "@/lib/domain/service-catalog";
import type { ServiceCategory } from "@/types/database";

type Skill = { id: string; category: ServiceCategory };

const ALL_CATEGORIES = Object.keys(SERVICE_CATEGORY_LABEL) as ServiceCategory[];

/**
 * "Habilidades" (doc "Petlys | Perfis - Pilar 1", 2026-09-06) — categorias
 * que o profissional declara que atua. Aparece publicamente no perfil
 * (badges) e libera os campos específicos daquela categoria na tela de
 * Serviços (ver ServiceCategoryFieldsSection).
 */
export function ProfessionalSkillsSection({ initialSkills }: { initialSkills: Skill[] }) {
  const [skills, setSkills] = useState(initialSkills);
  const [selected, setSelected] = useState<ServiceCategory | "">("");
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const availableToAdd = ALL_CATEGORIES.filter((c) => !skills.some((s) => s.category === c));

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault();
    if (!selected) return;
    setError(null);
    setIsSubmitting(true);
    const result = await addProfessionalSkill(selected);
    setIsSubmitting(false);
    if (result?.error) {
      setError(result.error);
      return;
    }
    setSkills((prev) => [...prev, { id: selected, category: selected }]);
    setSelected("");
  }

  async function handleRemove(skill: Skill) {
    setError(null);
    const result = await removeProfessionalSkill(skill.id);
    if (result?.error) {
      setError(result.error);
      return;
    }
    setSkills((prev) => prev.filter((s) => s.id !== skill.id));
  }

  return (
    <div className="rounded-lg border border-gray-200 bg-white p-4">
      <p className="text-sm font-semibold text-black mb-1">Habilidades</p>
      <p className="text-xs text-gray-500 mb-3">
        As categorias em que você atua — aparece no seu perfil público e libera os campos específicos de
        cada uma na hora de publicar um serviço.
      </p>

      {skills.length > 0 && (
        <div className="flex flex-wrap gap-2 mb-3">
          {skills.map((skill) => (
            <span
              key={skill.id}
              className="flex items-center gap-1 rounded-full bg-teal/10 text-teal text-xs font-semibold px-3 py-1"
            >
              {SERVICE_CATEGORY_LABEL[skill.category]}
              <button type="button" onClick={() => handleRemove(skill)} className="hover:text-red-600">
                <X size={12} />
              </button>
            </span>
          ))}
        </div>
      )}

      {availableToAdd.length > 0 && (
        <form onSubmit={handleAdd} className="flex gap-2">
          <select
            value={selected}
            onChange={(e) => setSelected(e.target.value as ServiceCategory)}
            className="input flex-1"
          >
            <option value="">Adicionar categoria...</option>
            {availableToAdd.map((c) => (
              <option key={c} value={c}>{SERVICE_CATEGORY_LABEL[c]}</option>
            ))}
          </select>
          <button
            type="submit"
            disabled={!selected || isSubmitting}
            className="rounded-lg bg-teal px-4 py-2 text-sm font-semibold text-white hover:opacity-90 disabled:opacity-60"
          >
            Adicionar
          </button>
        </form>
      )}

      {error && <p className="text-xs text-red-600 mt-2" role="alert">{error}</p>}
    </div>
  );
}
