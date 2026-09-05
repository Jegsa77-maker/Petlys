import type { ServiceCategory } from "@/types/database";

/**
 * Campos específicos por categoria no Serviço publicado (2026-09-06, doc
 * "Petlys | Perfis - Pilar 1", seção 5: "Regras específicas — condições
 * próprias da modalidade. Ex.: Hospedagem: horário de entrada/saída; pet
 * sitter: duração/quantidade de visitas"). Só aparecem na tela de
 * publicar/editar Serviço quando o profissional já tem a categoria como
 * "Habilidade" (professional_skills) — combinado com o usuário: cada
 * serviço publicado pode ter valores diferentes desses campos (ex.:
 * "hospedagem padrão" com um horário de entrada, "hospedagem premium"
 * com outro), por isso ficam em `professional_services.category_details`
 * (jsonb), não no perfil.
 *
 * IMPORTANTE — capacidade/entrada-saída/atraso/diária extra de hospedagem
 * são só INFORMATIVOS por enquanto: aparecem no perfil/serviço, mas não
 * bloqueiam reserva nem calculam cobrança sozinhos — isso exige mudar o
 * modelo da solicitação (data de término etc.), que é a frente de
 * hospedagem combinada como entrega separada.
 */
export type CategoryFieldType = "text" | "textarea" | "number" | "checkbox" | "time" | "select";

export type CategoryFieldDef = {
  key: string;
  label: string;
  type?: CategoryFieldType;
  /** Só pra type "select". */
  options?: { value: string; label: string }[];
  placeholder?: string;
};

export const SERVICE_CATEGORY_FIELDS: Partial<Record<ServiceCategory, CategoryFieldDef[]>> = {
  pet_sitter: [
    {
      key: "attendsAt",
      label: "Atende",
      type: "select",
      options: [
        { value: "casa_tutor", label: "Na casa do Tutor" },
        { value: "casa_profissional", label: "Na sua própria casa" },
        { value: "ambos", label: "Nos dois" },
      ],
    },
    { key: "maxPetsSimultaneous", label: "Quantidade máxima de pets simultâneos", type: "number" },
  ],
  passeador: [
    { key: "maxGroupSize", label: "Tamanho máximo do grupo no passeio", type: "number" },
    { key: "acceptsIncompleteVaccination", label: "Aceita filhote sem vacinação completa", type: "checkbox" },
  ],
  hospedagem_creche: [
    { key: "maxCapacity", label: "Capacidade máxima simultânea (vagas)", type: "number" },
    { key: "acceptsNonNeutered", label: "Aceita pet não castrado", type: "checkbox" },
    { key: "acceptsNonSociable", label: "Aceita pet que não convive bem com outros animais", type: "checkbox" },
    { key: "checkinTime", label: "Horário padrão de entrada", type: "time" },
    { key: "checkoutTime", label: "Horário padrão de saída", type: "time" },
    { key: "lateArrivalRule", label: "Regra de atraso na busca do pet", type: "textarea" },
    { key: "extraDayPrice", label: "Valor da diária extra (R$)", type: "number" },
    { key: "halfDayPrice", label: "Valor da meia diária (R$)", type: "number" },
  ],
  adestrador: [
    {
      key: "attendsAt",
      label: "Atende",
      type: "select",
      options: [
        { value: "domicilio", label: "Em domicílio" },
        { value: "espaco_proprio", label: "No seu espaço" },
        { value: "ambos", label: "Nos dois" },
      ],
    },
  ],
  veterinario_domiciliar: [
    { key: "specialty", label: "Especialidade(s)", placeholder: "Ex.: dermatologia, cardiologia" },
    { key: "bringsEquipment", label: "Leva equipamento pra exame simples no local", type: "checkbox" },
  ],
};
