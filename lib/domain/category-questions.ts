/**
 * Perguntas específicas por categoria na solicitação (seção 12.1 — "item 4
 * da Onda 2"). Mantidas em código, mesmo padrão de subcategorias
 * (lib/domain/service-catalog.ts) — catálogo administrável fica pra outra
 * história. Nenhuma pergunta é tecnicamente obrigatória no schema: a
 * plataforma pergunta, mas não trava o envio por uma resposta em branco
 * (autonomia do Tutor sobre o quanto quer detalhar).
 */
export type CategoryQuestion = { key: string; label: string };

export const CATEGORY_QUESTIONS: Record<string, CategoryQuestion[]> = {
  pet_sitter: [
    { key: "acessoResidencia", label: "Como o profissional vai ter acesso à casa?" },
  ],
  passeador: [
    { key: "pontoEncontro", label: "Ponto de encontro pro passeio" },
  ],
  hospedagem_creche: [
    { key: "itensProprios", label: "O pet vai levar cama, ração ou brinquedos próprios?" },
  ],
  adestrador: [
    { key: "comportamentoFoco", label: "Qual comportamento você quer trabalhar?" },
  ],
  banho_tosa: [
    { key: "historicoAgressividade", label: "Seu pet tem histórico de agressividade durante tosa?" },
  ],
  veterinario_domiciliar: [
    { key: "sintomas", label: "Descreva os sintomas ou o motivo da consulta" },
  ],
};
