"use client";

import { useState } from "react";
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
  base_price: number | null;
  active: boolean;
  multi_pet_discount_percent: number | null;
};

export function ServiceList({ services }: { services: Service[] }) {
  return (
    <ul className="flex flex-col gap-2">
      {services.map((service) => (
        <ServiceRow key={service.id} service={service} />
      ))}
    </ul>
  );
}

function ServiceRow({ service }: { service: Service }) {
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
        <p className="text-sm font-semibold text-black">{CATEGORY_LABEL[service.category]}</p>
        <p className="text-xs text-gray-500">
          {service.base_price ? `R$ ${service.base_price}` : "Sob consulta"}
          {service.multi_pet_discount_percent
            ? ` · ${service.multi_pet_discount_percent}% multi-pet`
            : ""}
        </p>
      </div>
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
    </li>
  );
}
