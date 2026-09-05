"use client";

import { useState } from "react";
import { ServiceForm, type EditingServiceData } from "@/components/services/service-form";
import { ServiceList } from "@/components/services/service-list";
import type { EffectiveCertificationStatus } from "@/lib/domain/certification-status";
import type { ServiceCategory } from "@/types/database";

type ServiceRow = {
  id: string;
  category: string;
  subcategory: string | null;
  pricing_model: string;
  base_price: number | null;
  active: boolean;
  multi_pet_discount_percent: number | null;
  description: string | null;
  duration_minutes: number | null;
  species_accepted: string[];
  min_size: string | null;
  max_size: string | null;
  restrictions: string | null;
  // `Json` no tipo gerado (pode vir `null` de uma linha antiga) — sempre
  // tratado como objeto vazio quando ausente, ver `editing` abaixo.
  category_details: unknown;
  professional_service_addons: { id: string; name: string; price: number }[];
};

/**
 * Junta lista + formulário de Serviço num client component só (2026-09-06,
 * "tem que permitir editar o serviço") — precisa de estado compartilhado
 * (qual serviço está sendo editado) que não dava pra fazer com os dois
 * soltos na Server Component de app/(profissional)/servicos/page.tsx.
 */
export function ServicesManager({
  professionalId,
  services,
  skillCategories,
  certificationsByCategory,
}: {
  professionalId: string;
  services: ServiceRow[];
  skillCategories: ServiceCategory[];
  certificationsByCategory: Record<string, { status: EffectiveCertificationStatus; documentUrl: string | null }>;
}) {
  const [editingId, setEditingId] = useState<string | null>(null);

  const editingRow = services.find((s) => s.id === editingId) ?? null;
  const editing: EditingServiceData | null = editingRow
    ? {
        id: editingRow.id,
        category: editingRow.category,
        subcategory: editingRow.subcategory ?? "",
        pricingModel: editingRow.pricing_model,
        basePrice: editingRow.base_price != null ? String(editingRow.base_price) : "",
        multiPetDiscountPercent:
          editingRow.multi_pet_discount_percent != null ? String(editingRow.multi_pet_discount_percent) : "",
        description: editingRow.description ?? "",
        durationMinutes: editingRow.duration_minutes != null ? String(editingRow.duration_minutes) : "",
        speciesAccepted: editingRow.species_accepted ?? [],
        minSize: editingRow.min_size ?? "",
        maxSize: editingRow.max_size ?? "",
        restrictions: editingRow.restrictions ?? "",
        addons: editingRow.professional_service_addons.map((a) => ({ name: a.name, price: String(a.price) })),
        categoryDetails: (editingRow.category_details as Record<string, string | boolean> | null) ?? {},
      }
    : null;

  return (
    <>
      {services.length > 0 && <ServiceList services={services} onEdit={setEditingId} />}

      {/* key força remontar o formulário (estado interno limpo) sempre que
          troca entre criar/editar ou entre dois serviços diferentes — mais
          simples que sincronizar via useEffect. */}
      <ServiceForm
        key={editingId ?? "new"}
        professionalId={professionalId}
        skillCategories={skillCategories}
        certificationsByCategory={certificationsByCategory}
        editing={editing}
        onCancelEdit={() => setEditingId(null)}
        onSaved={() => setEditingId(null)}
      />
    </>
  );
}
