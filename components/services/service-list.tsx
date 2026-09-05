"use client";

import { useState } from "react";
import { Pencil } from "lucide-react";
import { toggleServiceActive } from "@/lib/actions/services";

const CATEGORY_LABEL: Record<string, string> = {
  pet_sitter: "Pet sitter / cuidador",
  passeador: "Passeador de cães",
  hospedagem_creche: "Hospedagem / creche",
  adestrador: "Adestrador / comportamentalista",
  banho_tosa: "Banho e tosa",
  veterinario_domiciliar: "Veterinário domiciliar",
};

type Service = {
  id: string;
  category: string;
  subcategory: string | null;
  base_price: number | null;
  active: boolean;
  multi_pet_discount_percent: number | null;
  duration_minutes: number | null;
  species_accepted: string[];
  restrictions: string | null;
  professional_service_addons: { id: string; name: string; price: number }[];
};

export function ServiceList({
  services,
  onEdit,
}: {
  services: Service[];
  /** Ausente = tela sem edição habilitada (mantém a lista só-leitura de antes). */
  onEdit?: (serviceId: string) => void;
}) {
  return (
    <ul className="flex flex-col gap-2">
      {services.map((service) => (
        <ServiceRow key={service.id} service={service} onEdit={onEdit} />
      ))}
    </ul>
  );
}

function ServiceRow({ service, onEdit }: { service: Service; onEdit?: (serviceId: string) => void }) {
  const [active, setActive] = useState(service.active);
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleToggle() {
    setIsSubmitting(true);
    const result = await toggleServiceActive(service.id, !active);
    setIsSubmitting(false);
    if (!result?.error) setActive(!active);
  }

  return (
    <li className="flex items-center justify-between rounded-lg border border-gray-200 bg-white p-4">
      <div>
        <p className="text-sm font-semibold text-black">
          {CATEGORY_LABEL[service.category]}
          {service.subcategory ? ` · ${service.subcategory}` : ""}
        </p>
        <p className="text-xs text-gray-500">
          {service.base_price ? `R$ ${service.base_price}` : "Sob consulta"}
          {service.duration_minutes ? ` · ${service.duration_minutes} min` : ""}
          {service.multi_pet_discount_percent
            ? ` · ${service.multi_pet_discount_percent}% multi-pet`
            : ""}
        </p>
        {service.species_accepted.length > 0 && (
          <p className="text-xs text-gray-400">Atende: {service.species_accepted.join(", ")}</p>
        )}
        {service.professional_service_addons.length > 0 && (
          <p className="text-xs text-gray-400">
            Adicionais: {service.professional_service_addons.map((a) => `${a.name} (R$ ${a.price})`).join(", ")}
          </p>
        )}
      </div>
      <div className="flex items-center gap-2 shrink-0">
        {onEdit && (
          <button
            type="button"
            onClick={() => onEdit(service.id)}
            aria-label="Editar serviço"
            className="p-1.5 rounded-full text-gray-400 hover:text-teal hover:bg-teal/5"
          >
            <Pencil size={14} />
          </button>
        )}
        <button
          type="button"
          onClick={handleToggle}
          disabled={isSubmitting}
          className={`text-xs font-semibold px-3 py-1.5 rounded-full transition-colors ${
            active ? "bg-teal text-white" : "bg-gray text-gray-500"
          }`}
        >
          {active ? "Ativo" : "Pausado"}
        </button>
      </div>
    </li>
  );
}
