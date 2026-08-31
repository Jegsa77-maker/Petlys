-- ============================================================================
-- 0001_extensions_and_enums.sql
-- Plataforma Pet | Pilar 1 | Fase 3
-- Extensões necessárias e tipos enumerados usados em todo o schema.
-- ============================================================================

create extension if not exists pgcrypto;
create extension if not exists "uuid-ossp";

-- ----------------------------------------------------------------------------
-- Papéis de acesso (seção 1.3 / 2.2 da especificação)
-- ----------------------------------------------------------------------------
create type app_role as enum ('tutor', 'profissional', 'administrador', 'supervisor');

-- ----------------------------------------------------------------------------
-- Pets
-- ----------------------------------------------------------------------------
create type pet_size as enum ('pequeno', 'medio', 'grande', 'gigante');

-- ----------------------------------------------------------------------------
-- Categorias de serviço (seção 4.2 / 5.2)
-- ----------------------------------------------------------------------------
create type service_category as enum (
  'pet_sitter',
  'passeador',
  'hospedagem_creche',
  'adestrador',
  'banho_tosa',
  'veterinario_domiciliar'
);

-- ----------------------------------------------------------------------------
-- Ciclo de vida do atendimento (seção 3)
-- ----------------------------------------------------------------------------
create type request_status as enum (
  'rascunho',
  'solicitacao_enviada',
  'em_conversa',
  'proposta_enviada',
  'aguardando_pagamento',
  'confirmado',
  'checkin',
  'em_andamento',
  'finalizacao',
  'concluido',
  'avaliacao',
  'recusado',
  'expirado',
  'cancelado',
  'incidente',
  'em_disputa'
);

-- Status de cada execução individual dentro de um contrato (única ou recorrente)
create type occurrence_status as enum (
  'agendado',
  'checkin',
  'em_andamento',
  'finalizacao',
  'concluido',
  'cancelado',
  'nao_compareceu'
);

-- ----------------------------------------------------------------------------
-- Financeiro (seção 9)
-- ----------------------------------------------------------------------------
create type payment_status as enum ('pendente', 'processando', 'pago', 'estornado', 'falhou');

create type payout_status as enum ('agendado', 'retido', 'disponivel', 'solicitado', 'pago', 'bloqueado');

create type no_show_party as enum ('tutor', 'profissional');

-- ----------------------------------------------------------------------------
-- Incidentes (seção 8.2 / 10)
-- ----------------------------------------------------------------------------
create type incident_status as enum ('aberto', 'em_analise', 'resolvido', 'escalado');

create type incident_urgency as enum ('baixa', 'media', 'alta', 'emergencia');

-- ----------------------------------------------------------------------------
-- Parâmetros comerciais (seção 9.4)
-- ----------------------------------------------------------------------------
create type parameter_lifecycle as enum ('ativo', 'substituido');

create type parameter_action as enum ('criacao', 'edicao', 'exclusao');
