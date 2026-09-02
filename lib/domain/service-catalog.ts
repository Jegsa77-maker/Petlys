/**
 * Catálogo de serviços flexível (seção 12.1 do plano 100%) — subcategorias
 * sugeridas por categoria, espécies atendidas e portes aceitos. Mantido em
 * código (não em tabela administrável) de propósito: um catálogo editável
 * pelo Admin é um item maior, fora do escopo desta história (ver
 * Especificação v2.0, seção 12.4 "catálogo administrável").
 */
/**
 * Rótulo de cada categoria de serviço — existia repetido em pelo menos 8
 * arquivos (busca, favoritos, perfil público, formulário de solicitação,
 * catálogo de serviços, habilitações...). Consolidado aqui a partir da
 * revisão de pendências de 2026-09-01; não foi feita a migração dos 8
 * arquivos existentes nesta entrega (fora do escopo do item que motivou
 * esta constante) — novos usos devem importar daqui, não duplicar de novo.
 */
export const SERVICE_CATEGORY_LABEL: Record<string, string> = {
  pet_sitter: "Pet sitter / cuidador",
  passeador: "Passeador de cães",
  hospedagem_creche: "Hospedagem / creche",
  adestrador: "Adestrador / comportamentalista",
  banho_tosa: "Banho e tosa",
  veterinario_domiciliar: "Veterinário domiciliar",
};

export const SERVICE_SUBCATEGORIES: Record<string, string[]> = {
  pet_sitter: ["Cuidado na casa do tutor", "Cuidado na casa do profissional", "Visitas pontuais"],
  passeador: ["Passeio individual", "Passeio em grupo", "Passeio para filhotes"],
  hospedagem_creche: ["Hospedagem (pernoite)", "Creche diurna", "Creche por período"],
  adestrador: ["Obediência básica", "Comportamental", "Filhotes", "Cães de trabalho/esporte"],
  banho_tosa: ["Banho", "Tosa higiênica", "Tosa na tesoura", "Hidratação", "Creative grooming"],
  veterinario_domiciliar: ["Consulta geral", "Vacinação", "Exames", "Emergência"],
};

export const SPECIES_OPTIONS = ["Cão", "Gato", "Outros"] as const;

export const PET_SIZES = ["pequeno", "medio", "grande", "gigante"] as const;
export const PET_SIZE_LABEL: Record<(typeof PET_SIZES)[number], string> = {
  pequeno: "Pequeno",
  medio: "Médio",
  grande: "Grande",
  gigante: "Gigante",
};
