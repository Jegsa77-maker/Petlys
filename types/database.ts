// ============================================================================
// types/database.ts
// Gerado a partir do schema real em supabase/migrations/*.sql (tabelas,
// enums e foreign keys introspectadas de um Postgres local de teste).
// Para regenerar contra o projeto Supabase provisionado, prefira:
//   supabase gen types typescript --project-id <id> > types/database.ts
// ============================================================================

export type Json =
  | string | number | boolean | null
  | { [key: string]: Json | undefined }
  | Json[];

// ---------------------------------------------------------------------------
// Enum types
// ---------------------------------------------------------------------------
export type AppRole = "tutor" | "profissional" | "administrador" | "supervisor";
export type IncidentStatus = "aberto" | "em_analise" | "resolvido" | "escalado";
export type IncidentUrgency = "baixa" | "media" | "alta" | "emergencia";
export type NoShowParty = "tutor" | "profissional";
export type OccurrenceStatus = "agendado" | "checkin" | "em_andamento" | "finalizacao" | "concluido" | "cancelado" | "nao_compareceu";
export type ParameterAction = "criacao" | "edicao" | "exclusao";
export type ParameterLifecycle = "ativo" | "substituido";
export type PaymentStatus = "pendente" | "processando" | "pago" | "estornado" | "falhou";
export type PayoutStatus = "agendado" | "retido" | "disponivel" | "solicitado" | "pago" | "bloqueado";
export type PetSize = "pequeno" | "medio" | "grande" | "gigante";
export type RequestStatus = "rascunho" | "solicitacao_enviada" | "em_conversa" | "proposta_enviada" | "aguardando_pagamento" | "confirmado" | "checkin" | "em_andamento" | "finalizacao" | "concluido" | "avaliacao" | "recusado" | "expirado" | "cancelado" | "incidente" | "em_disputa";
export type ServiceCategory = "pet_sitter" | "passeador" | "hospedagem_creche" | "adestrador" | "banho_tosa" | "veterinario_domiciliar";
export type SuspensionStatus = "pendente" | "aprovada" | "rejeitada";

// ---------------------------------------------------------------------------
// Tabelas
// ---------------------------------------------------------------------------
export interface Database {
  public: {
    Tables: {
      account_roles: {
        Row: {
          id: string;
          profile_id: string;
          role: AppRole;
          active: boolean;
          created_at: string;
        };
        Insert: {
          id?: string;
          profile_id: string;
          role: AppRole;
          active?: boolean;
          created_at?: string;
        };
        Update: {
          id?: string;
          profile_id?: string;
          role?: AppRole;
          active?: boolean;
          created_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "account_roles_profile_id_fkey",
            columns: ["profile_id"],
            isOneToOne: false,
            referencedRelation: "profiles",
            referencedColumns: ["id"]
          },
        ];
      };
      account_suspensions: {
        Row: {
          id: string;
          target_profile_id: string;
          recommended_by: string;
          reason: string;
          related_incident_id: string | null;
          status: SuspensionStatus;
          decided_by: string | null;
          decided_at: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          target_profile_id: string;
          recommended_by: string;
          reason: string;
          related_incident_id?: string | null;
          status?: SuspensionStatus;
          decided_by?: string | null;
          decided_at?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          target_profile_id?: string;
          recommended_by?: string;
          reason?: string;
          related_incident_id?: string | null;
          status?: SuspensionStatus;
          decided_by?: string | null;
          decided_at?: string | null;
          created_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "account_suspensions_recommended_by_fkey",
            columns: ["recommended_by"],
            isOneToOne: false,
            referencedRelation: "profiles",
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "account_suspensions_related_incident_id_fkey",
            columns: ["related_incident_id"],
            isOneToOne: false,
            referencedRelation: "incidents",
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "account_suspensions_target_profile_id_fkey",
            columns: ["target_profile_id"],
            isOneToOne: false,
            referencedRelation: "profiles",
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "account_suspensions_decided_by_fkey",
            columns: ["decided_by"],
            isOneToOne: false,
            referencedRelation: "profiles",
            referencedColumns: ["id"]
          },
        ];
      };
      admin_audit_log: {
        Row: {
          id: string;
          actor_id: string;
          action: string;
          target_profile_id: string | null;
          target_incident_id: string | null;
          details: Json;
          created_at: string;
        };
        Insert: {
          id?: string;
          actor_id: string;
          action: string;
          target_profile_id?: string | null;
          target_incident_id?: string | null;
          details?: Json;
          created_at?: string;
        };
        Update: {
          id?: string;
          actor_id?: string;
          action?: string;
          target_profile_id?: string | null;
          target_incident_id?: string | null;
          details?: Json;
          created_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "admin_audit_log_target_profile_id_fkey",
            columns: ["target_profile_id"],
            isOneToOne: false,
            referencedRelation: "profiles",
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "admin_audit_log_actor_id_fkey",
            columns: ["actor_id"],
            isOneToOne: false,
            referencedRelation: "profiles",
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "admin_audit_log_target_incident_id_fkey",
            columns: ["target_incident_id"],
            isOneToOne: false,
            referencedRelation: "incidents",
            referencedColumns: ["id"]
          },
        ];
      };
      contact_unlocks: {
        Row: {
          tutor_id: string;
          professional_id: string;
          unlocked_at: string;
          unlocked_by_request_id: string;
        };
        Insert: {
          tutor_id: string;
          professional_id: string;
          unlocked_at?: string;
          unlocked_by_request_id: string;
        };
        Update: {
          tutor_id?: string;
          professional_id?: string;
          unlocked_at?: string;
          unlocked_by_request_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "contact_unlocks_unlocked_by_request_id_fkey",
            columns: ["unlocked_by_request_id"],
            isOneToOne: false,
            referencedRelation: "requests",
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "contact_unlocks_professional_id_fkey",
            columns: ["professional_id"],
            isOneToOne: false,
            referencedRelation: "profiles",
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "contact_unlocks_tutor_id_fkey",
            columns: ["tutor_id"],
            isOneToOne: false,
            referencedRelation: "profiles",
            referencedColumns: ["id"]
          },
        ];
      };
      incident_evidence: {
        Row: {
          id: string;
          incident_id: string;
          url: string;
          type: string;
          uploaded_by: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          incident_id: string;
          url: string;
          type: string;
          uploaded_by: string;
          created_at?: string;
        };
        Update: {
          id?: string;
          incident_id?: string;
          url?: string;
          type?: string;
          uploaded_by?: string;
          created_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "incident_evidence_uploaded_by_fkey",
            columns: ["uploaded_by"],
            isOneToOne: false,
            referencedRelation: "profiles",
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "incident_evidence_incident_id_fkey",
            columns: ["incident_id"],
            isOneToOne: false,
            referencedRelation: "incidents",
            referencedColumns: ["id"]
          },
        ];
      };
      incidents: {
        Row: {
          id: string;
          request_id: string;
          occurrence_id: string | null;
          opened_by: string;
          type: string;
          urgency: IncidentUrgency;
          status: IncidentStatus;
          assigned_to: string | null;
          resolution: string | null;
          blocks_payout: boolean;
          created_at: string;
          resolved_at: string | null;
        };
        Insert: {
          id?: string;
          request_id: string;
          occurrence_id?: string | null;
          opened_by: string;
          type: string;
          urgency?: IncidentUrgency;
          status?: IncidentStatus;
          assigned_to?: string | null;
          resolution?: string | null;
          blocks_payout?: boolean;
          created_at?: string;
          resolved_at?: string | null;
        };
        Update: {
          id?: string;
          request_id?: string;
          occurrence_id?: string | null;
          opened_by?: string;
          type?: string;
          urgency?: IncidentUrgency;
          status?: IncidentStatus;
          assigned_to?: string | null;
          resolution?: string | null;
          blocks_payout?: boolean;
          created_at?: string;
          resolved_at?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "incidents_opened_by_fkey",
            columns: ["opened_by"],
            isOneToOne: false,
            referencedRelation: "profiles",
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "incidents_request_id_fkey",
            columns: ["request_id"],
            isOneToOne: false,
            referencedRelation: "requests",
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "incidents_occurrence_id_fkey",
            columns: ["occurrence_id"],
            isOneToOne: false,
            referencedRelation: "request_occurrences",
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "incidents_assigned_to_fkey",
            columns: ["assigned_to"],
            isOneToOne: false,
            referencedRelation: "profiles",
            referencedColumns: ["id"]
          },
        ];
      };
      messages: {
        Row: {
          id: string;
          request_id: string;
          sender_id: string;
          content: string;
          flagged_reason: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          request_id: string;
          sender_id: string;
          content: string;
          flagged_reason?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          request_id?: string;
          sender_id?: string;
          content?: string;
          flagged_reason?: string | null;
          created_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "messages_request_id_fkey",
            columns: ["request_id"],
            isOneToOne: false,
            referencedRelation: "requests",
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "messages_sender_id_fkey",
            columns: ["sender_id"],
            isOneToOne: false,
            referencedRelation: "profiles",
            referencedColumns: ["id"]
          },
        ];
      };
      no_show_records: {
        Row: {
          id: string;
          request_id: string;
          occurrence_id: string;
          reported_party: NoShowParty;
          reported_by: string;
          min_wait_confirmed: boolean;
          checkin_confirmed: boolean;
          contact_attempt_confirmed: boolean;
          retained_percent: number | null;
          retained_amount: number | null;
          professional_compensation: number | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          request_id: string;
          occurrence_id: string;
          reported_party: NoShowParty;
          reported_by: string;
          min_wait_confirmed?: boolean;
          checkin_confirmed?: boolean;
          contact_attempt_confirmed?: boolean;
          retained_percent?: number | null;
          retained_amount?: number | null;
          professional_compensation?: number | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          request_id?: string;
          occurrence_id?: string;
          reported_party?: NoShowParty;
          reported_by?: string;
          min_wait_confirmed?: boolean;
          checkin_confirmed?: boolean;
          contact_attempt_confirmed?: boolean;
          retained_percent?: number | null;
          retained_amount?: number | null;
          professional_compensation?: number | null;
          created_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "no_show_records_reported_by_fkey",
            columns: ["reported_by"],
            isOneToOne: false,
            referencedRelation: "profiles",
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "no_show_records_request_id_fkey",
            columns: ["request_id"],
            isOneToOne: false,
            referencedRelation: "requests",
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "no_show_records_occurrence_id_fkey",
            columns: ["occurrence_id"],
            isOneToOne: false,
            referencedRelation: "request_occurrences",
            referencedColumns: ["id"]
          },
        ];
      };
      notifications: {
        Row: {
          id: string;
          profile_id: string;
          type: string;
          payload: Json;
          read_at: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          profile_id: string;
          type: string;
          payload?: Json;
          read_at?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          profile_id?: string;
          type?: string;
          payload?: Json;
          read_at?: string | null;
          created_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "notifications_profile_id_fkey",
            columns: ["profile_id"],
            isOneToOne: false,
            referencedRelation: "profiles",
            referencedColumns: ["id"]
          },
        ];
      };
      payments: {
        Row: {
          id: string;
          request_id: string;
          gateway_transaction_id: string | null;
          amount: number;
          commission_amount: number;
          status: PaymentStatus;
          paid_at: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          request_id: string;
          gateway_transaction_id?: string | null;
          amount: number;
          commission_amount?: number;
          status?: PaymentStatus;
          paid_at?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          request_id?: string;
          gateway_transaction_id?: string | null;
          amount?: number;
          commission_amount?: number;
          status?: PaymentStatus;
          paid_at?: string | null;
          created_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "payments_request_id_fkey",
            columns: ["request_id"],
            isOneToOne: false,
            referencedRelation: "requests",
            referencedColumns: ["id"]
          },
        ];
      };
      payouts: {
        Row: {
          id: string;
          professional_id: string;
          request_id: string;
          amount: number;
          status: PayoutStatus;
          requested_at: string | null;
          paid_at: string | null;
          gateway_transfer_id: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          professional_id: string;
          request_id: string;
          amount: number;
          status?: PayoutStatus;
          requested_at?: string | null;
          paid_at?: string | null;
          gateway_transfer_id?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          professional_id?: string;
          request_id?: string;
          amount?: number;
          status?: PayoutStatus;
          requested_at?: string | null;
          paid_at?: string | null;
          gateway_transfer_id?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "payouts_request_id_fkey",
            columns: ["request_id"],
            isOneToOne: false,
            referencedRelation: "requests",
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payouts_professional_id_fkey",
            columns: ["professional_id"],
            isOneToOne: false,
            referencedRelation: "profiles",
            referencedColumns: ["id"]
          },
        ];
      };
      pet_tutors: {
        Row: {
          pet_id: string;
          tutor_profile_id: string;
          added_at: string;
        };
        Insert: {
          pet_id: string;
          tutor_profile_id: string;
          added_at?: string;
        };
        Update: {
          pet_id?: string;
          tutor_profile_id?: string;
          added_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "pet_tutors_tutor_profile_id_fkey",
            columns: ["tutor_profile_id"],
            isOneToOne: false,
            referencedRelation: "profiles",
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pet_tutors_pet_id_fkey",
            columns: ["pet_id"],
            isOneToOne: false,
            referencedRelation: "pets",
            referencedColumns: ["id"]
          },
        ];
      };
      pets: {
        Row: {
          id: string;
          name: string;
          species: string;
          breed: string | null;
          sex: string | null;
          birth_approx: string | null;
          size: PetSize | null;
          weight: number | null;
          photo_url: string | null;
          health_info: Json;
          behavior_info: Json;
          routine_info: Json;
          emergency_info: Json;
          created_by: string;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          name: string;
          species: string;
          breed?: string | null;
          sex?: string | null;
          birth_approx?: string | null;
          size?: PetSize | null;
          weight?: number | null;
          photo_url?: string | null;
          health_info?: Json;
          behavior_info?: Json;
          routine_info?: Json;
          emergency_info?: Json;
          created_by: string;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          name?: string;
          species?: string;
          breed?: string | null;
          sex?: string | null;
          birth_approx?: string | null;
          size?: PetSize | null;
          weight?: number | null;
          photo_url?: string | null;
          health_info?: Json;
          behavior_info?: Json;
          routine_info?: Json;
          emergency_info?: Json;
          created_by?: string;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "pets_created_by_fkey",
            columns: ["created_by"],
            isOneToOne: false,
            referencedRelation: "profiles",
            referencedColumns: ["id"]
          },
        ];
      };
      platform_parameters: {
        Row: {
          id: string;
          chave1: string;
          chave2: string;
          chave3: string;
          valor1: string | null;
          valor2: string | null;
          valor3: string | null;
          explicacao: string | null;
          vigencia_inicio: string;
          status: ParameterLifecycle;
          atualizado_por: string;
          atualizado_em: string;
        };
        Insert: {
          id?: string;
          chave1: string;
          chave2?: string;
          chave3?: string;
          valor1?: string | null;
          valor2?: string | null;
          valor3?: string | null;
          explicacao?: string | null;
          vigencia_inicio?: string;
          status?: ParameterLifecycle;
          atualizado_por: string;
          atualizado_em?: string;
        };
        Update: {
          id?: string;
          chave1?: string;
          chave2?: string;
          chave3?: string;
          valor1?: string | null;
          valor2?: string | null;
          valor3?: string | null;
          explicacao?: string | null;
          vigencia_inicio?: string;
          status?: ParameterLifecycle;
          atualizado_por?: string;
          atualizado_em?: string;
        };
        Relationships: [
          {
            foreignKeyName: "platform_parameters_atualizado_por_fkey",
            columns: ["atualizado_por"],
            isOneToOne: false,
            referencedRelation: "profiles",
            referencedColumns: ["id"]
          },
        ];
      };
      platform_parameters_log: {
        Row: {
          id: string;
          parameter_id: string;
          chave1: string;
          chave2: string;
          chave3: string;
          valores_anteriores: Json | null;
          valores_novos: Json | null;
          acao: ParameterAction;
          alterado_por: string;
          criado_em: string;
        };
        Insert: {
          id?: string;
          parameter_id: string;
          chave1: string;
          chave2: string;
          chave3: string;
          valores_anteriores?: Json | null;
          valores_novos?: Json | null;
          acao: ParameterAction;
          alterado_por: string;
          criado_em?: string;
        };
        Update: {
          id?: string;
          parameter_id?: string;
          chave1?: string;
          chave2?: string;
          chave3?: string;
          valores_anteriores?: Json | null;
          valores_novos?: Json | null;
          acao?: ParameterAction;
          alterado_por?: string;
          criado_em?: string;
        };
        Relationships: [
          {
            foreignKeyName: "platform_parameters_log_parameter_id_fkey",
            columns: ["parameter_id"],
            isOneToOne: false,
            referencedRelation: "platform_parameters",
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "platform_parameters_log_alterado_por_fkey",
            columns: ["alterado_por"],
            isOneToOne: false,
            referencedRelation: "profiles",
            referencedColumns: ["id"]
          },
        ];
      };
      professional_availability: {
        Row: {
          id: string;
          professional_id: string;
          weekday: number | null;
          start_time: string | null;
          end_time: string | null;
          date_override: string | null;
          blocked: boolean;
          reason: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          professional_id: string;
          weekday?: number | null;
          start_time?: string | null;
          end_time?: string | null;
          date_override?: string | null;
          blocked?: boolean;
          reason?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          professional_id?: string;
          weekday?: number | null;
          start_time?: string | null;
          end_time?: string | null;
          date_override?: string | null;
          blocked?: boolean;
          reason?: string | null;
          created_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "professional_availability_professional_id_fkey",
            columns: ["professional_id"],
            isOneToOne: false,
            referencedRelation: "profiles",
            referencedColumns: ["id"]
          },
        ];
      };
      professional_cancellations: {
        Row: {
          id: string;
          request_id: string;
          occurrence_id: string | null;
          professional_id: string;
          refunded_amount: number;
          debited_commission: number;
          settled: boolean;
          settled_at: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          request_id: string;
          occurrence_id?: string | null;
          professional_id: string;
          refunded_amount: number;
          debited_commission: number;
          settled?: boolean;
          settled_at?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          request_id?: string;
          occurrence_id?: string | null;
          professional_id?: string;
          refunded_amount?: number;
          debited_commission?: number;
          settled?: boolean;
          settled_at?: string | null;
          created_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "professional_cancellations_request_id_fkey",
            columns: ["request_id"],
            isOneToOne: false,
            referencedRelation: "requests",
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "professional_cancellations_occurrence_id_fkey",
            columns: ["occurrence_id"],
            isOneToOne: false,
            referencedRelation: "request_occurrences",
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "professional_cancellations_professional_id_fkey",
            columns: ["professional_id"],
            isOneToOne: false,
            referencedRelation: "profiles",
            referencedColumns: ["id"]
          },
        ];
      };
      professional_service_areas: {
        Row: {
          id: string;
          professional_id: string;
          center_lat: number;
          center_lng: number;
          radius_km: number;
          excluded_zips: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          professional_id: string;
          center_lat: number;
          center_lng: number;
          radius_km?: number;
          excluded_zips?: string;
          created_at?: string;
        };
        Update: {
          id?: string;
          professional_id?: string;
          center_lat?: number;
          center_lng?: number;
          radius_km?: number;
          excluded_zips?: string;
          created_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "professional_service_areas_professional_id_fkey",
            columns: ["professional_id"],
            isOneToOne: false,
            referencedRelation: "profiles",
            referencedColumns: ["id"]
          },
        ];
      };
      professional_services: {
        Row: {
          id: string;
          professional_id: string;
          category: ServiceCategory;
          pricing_model: string;
          base_price: number | null;
          multi_pet_discount_percent: number | null;
          description: string | null;
          active: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          professional_id: string;
          category: ServiceCategory;
          pricing_model: string;
          base_price?: number | null;
          multi_pet_discount_percent?: number | null;
          description?: string | null;
          active?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          professional_id?: string;
          category?: ServiceCategory;
          pricing_model?: string;
          base_price?: number | null;
          multi_pet_discount_percent?: number | null;
          description?: string | null;
          active?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "professional_services_professional_id_fkey",
            columns: ["professional_id"],
            isOneToOne: false,
            referencedRelation: "profiles",
            referencedColumns: ["id"]
          },
        ];
      };
      profiles: {
        Row: {
          id: string;
          full_name: string;
          email: string;
          phone: string | null;
          phone_verified_at: string | null;
          email_verified_at: string | null;
          birth_date: string | null;
          cpf_cnpj: string | null;
          created_at: string;
          updated_at: string;
          internal_username: string | null;
          address_zip: string | null;
          address_lat: number | null;
          address_lng: number | null;
        };
        Insert: {
          id: string;
          full_name: string;
          email: string;
          phone?: string | null;
          phone_verified_at?: string | null;
          email_verified_at?: string | null;
          birth_date?: string | null;
          cpf_cnpj?: string | null;
          created_at?: string;
          updated_at?: string;
          internal_username?: string | null;
          address_zip?: string | null;
          address_lat?: number | null;
          address_lng?: number | null;
        };
        Update: {
          id?: string;
          full_name?: string;
          email?: string;
          phone?: string | null;
          phone_verified_at?: string | null;
          email_verified_at?: string | null;
          birth_date?: string | null;
          cpf_cnpj?: string | null;
          created_at?: string;
          updated_at?: string;
          internal_username?: string | null;
          address_zip?: string | null;
          address_lat?: number | null;
          address_lng?: number | null;
        };
        Relationships: [];
      };
      proposals: {
        Row: {
          id: string;
          request_id: string;
          version: number;
          scope: string;
          price: number;
          additional_fees: number;
          validity_at: string;
          cancellation_policy: Json;
          requires_full_payment: boolean;
          deposit_percent: number | null;
          created_by: string;
          created_at: string;
          accepted_at: string | null;
        };
        Insert: {
          id?: string;
          request_id: string;
          version?: number;
          scope: string;
          price: number;
          additional_fees?: number;
          validity_at: string;
          cancellation_policy?: Json;
          requires_full_payment?: boolean;
          deposit_percent?: number | null;
          created_by: string;
          created_at?: string;
          accepted_at?: string | null;
        };
        Update: {
          id?: string;
          request_id?: string;
          version?: number;
          scope?: string;
          price?: number;
          additional_fees?: number;
          validity_at?: string;
          cancellation_policy?: Json;
          requires_full_payment?: boolean;
          deposit_percent?: number | null;
          created_by?: string;
          created_at?: string;
          accepted_at?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "proposals_created_by_fkey",
            columns: ["created_by"],
            isOneToOne: false,
            referencedRelation: "profiles",
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "proposals_request_id_fkey",
            columns: ["request_id"],
            isOneToOne: false,
            referencedRelation: "requests",
            referencedColumns: ["id"]
          },
        ];
      };
      request_occurrences: {
        Row: {
          id: string;
          request_id: string;
          sequence_number: number;
          scheduled_at: string;
          status: OccurrenceStatus;
          checkin_at: string | null;
          checkin_lat: number | null;
          checkin_lng: number | null;
          completed_at: string | null;
          report: Json;
          created_at: string;
        };
        Insert: {
          id?: string;
          request_id: string;
          sequence_number?: number;
          scheduled_at: string;
          status?: OccurrenceStatus;
          checkin_at?: string | null;
          checkin_lat?: number | null;
          checkin_lng?: number | null;
          completed_at?: string | null;
          report?: Json;
          created_at?: string;
        };
        Update: {
          id?: string;
          request_id?: string;
          sequence_number?: number;
          scheduled_at?: string;
          status?: OccurrenceStatus;
          checkin_at?: string | null;
          checkin_lat?: number | null;
          checkin_lng?: number | null;
          completed_at?: string | null;
          report?: Json;
          created_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "request_occurrences_request_id_fkey",
            columns: ["request_id"],
            isOneToOne: false,
            referencedRelation: "requests",
            referencedColumns: ["id"]
          },
        ];
      };
      request_pets: {
        Row: {
          request_id: string;
          pet_id: string;
        };
        Insert: {
          request_id: string;
          pet_id: string;
        };
        Update: {
          request_id?: string;
          pet_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "request_pets_request_id_fkey",
            columns: ["request_id"],
            isOneToOne: false,
            referencedRelation: "requests",
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "request_pets_pet_id_fkey",
            columns: ["pet_id"],
            isOneToOne: false,
            referencedRelation: "pets",
            referencedColumns: ["id"]
          },
        ];
      };
      request_status_history: {
        Row: {
          id: string;
          request_id: string;
          from_status: RequestStatus | null;
          to_status: RequestStatus;
          changed_by: string | null;
          note: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          request_id: string;
          from_status?: RequestStatus | null;
          to_status: RequestStatus;
          changed_by?: string | null;
          note?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          request_id?: string;
          from_status?: RequestStatus | null;
          to_status?: RequestStatus;
          changed_by?: string | null;
          note?: string | null;
          created_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "request_status_history_request_id_fkey",
            columns: ["request_id"],
            isOneToOne: false,
            referencedRelation: "requests",
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "request_status_history_changed_by_fkey",
            columns: ["changed_by"],
            isOneToOne: false,
            referencedRelation: "profiles",
            referencedColumns: ["id"]
          },
        ];
      };
      request_status_transitions_allowed: {
        Row: {
          from_status: RequestStatus;
          to_status: RequestStatus;
        };
        Insert: {
          from_status: RequestStatus;
          to_status: RequestStatus;
        };
        Update: {
          from_status?: RequestStatus;
          to_status?: RequestStatus;
        };
        Relationships: [];
      };
      requests: {
        Row: {
          id: string;
          tutor_id: string;
          professional_id: string;
          category: ServiceCategory;
          status: RequestStatus;
          is_recurring: boolean;
          occurrences_total: number;
          commission_percent_snapshot: number | null;
          created_at: string;
          updated_at: string;
          is_visita_inicial: boolean;
          origin_request_id: string | null;
        };
        Insert: {
          id?: string;
          tutor_id: string;
          professional_id: string;
          category: ServiceCategory;
          status?: RequestStatus;
          is_recurring?: boolean;
          occurrences_total?: number;
          commission_percent_snapshot?: number | null;
          created_at?: string;
          updated_at?: string;
          is_visita_inicial?: boolean;
          origin_request_id?: string | null;
        };
        Update: {
          id?: string;
          tutor_id?: string;
          professional_id?: string;
          category?: ServiceCategory;
          status?: RequestStatus;
          is_recurring?: boolean;
          occurrences_total?: number;
          commission_percent_snapshot?: number | null;
          created_at?: string;
          updated_at?: string;
          is_visita_inicial?: boolean;
          origin_request_id?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "requests_tutor_id_fkey",
            columns: ["tutor_id"],
            isOneToOne: false,
            referencedRelation: "profiles",
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "requests_origin_request_id_fkey",
            columns: ["origin_request_id"],
            isOneToOne: false,
            referencedRelation: "requests",
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "requests_professional_id_fkey",
            columns: ["professional_id"],
            isOneToOne: false,
            referencedRelation: "profiles",
            referencedColumns: ["id"]
          },
        ];
      };
      reviews: {
        Row: {
          id: string;
          request_id: string;
          reviewer_id: string;
          reviewee_id: string;
          rating: Json;
          comment: string | null;
          response: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          request_id: string;
          reviewer_id: string;
          reviewee_id: string;
          rating: Json;
          comment?: string | null;
          response?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          request_id?: string;
          reviewer_id?: string;
          reviewee_id?: string;
          rating?: Json;
          comment?: string | null;
          response?: string | null;
          created_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "reviews_reviewee_id_fkey",
            columns: ["reviewee_id"],
            isOneToOne: false,
            referencedRelation: "profiles",
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reviews_request_id_fkey",
            columns: ["request_id"],
            isOneToOne: false,
            referencedRelation: "requests",
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reviews_reviewer_id_fkey",
            columns: ["reviewer_id"],
            isOneToOne: false,
            referencedRelation: "profiles",
            referencedColumns: ["id"]
          },
        ];
      };
      supervisor_grants: {
        Row: {
          id: string;
          supervisor_profile_id: string;
          created_by_admin_id: string;
          created_at: string;
          revoked_at: string | null;
          revoked_by_admin_id: string | null;
        };
        Insert: {
          id?: string;
          supervisor_profile_id: string;
          created_by_admin_id: string;
          created_at?: string;
          revoked_at?: string | null;
          revoked_by_admin_id?: string | null;
        };
        Update: {
          id?: string;
          supervisor_profile_id?: string;
          created_by_admin_id?: string;
          created_at?: string;
          revoked_at?: string | null;
          revoked_by_admin_id?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "supervisor_grants_created_by_admin_id_fkey",
            columns: ["created_by_admin_id"],
            isOneToOne: false,
            referencedRelation: "profiles",
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "supervisor_grants_supervisor_profile_id_fkey",
            columns: ["supervisor_profile_id"],
            isOneToOne: false,
            referencedRelation: "profiles",
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "supervisor_grants_revoked_by_admin_id_fkey",
            columns: ["revoked_by_admin_id"],
            isOneToOne: false,
            referencedRelation: "profiles",
            referencedColumns: ["id"]
          },
        ];
      };
    };
    Views: Record<string, never>;
    Functions: Record<string, never>;
    Enums: {
      app_role: "tutor" | "profissional" | "administrador" | "supervisor";
      incident_status: "aberto" | "em_analise" | "resolvido" | "escalado";
      incident_urgency: "baixa" | "media" | "alta" | "emergencia";
      no_show_party: "tutor" | "profissional";
      occurrence_status: "agendado" | "checkin" | "em_andamento" | "finalizacao" | "concluido" | "cancelado" | "nao_compareceu";
      parameter_action: "criacao" | "edicao" | "exclusao";
      parameter_lifecycle: "ativo" | "substituido";
      payment_status: "pendente" | "processando" | "pago" | "estornado" | "falhou";
      payout_status: "agendado" | "retido" | "disponivel" | "solicitado" | "pago" | "bloqueado";
      pet_size: "pequeno" | "medio" | "grande" | "gigante";
      request_status: "rascunho" | "solicitacao_enviada" | "em_conversa" | "proposta_enviada" | "aguardando_pagamento" | "confirmado" | "checkin" | "em_andamento" | "finalizacao" | "concluido" | "avaliacao" | "recusado" | "expirado" | "cancelado" | "incidente" | "em_disputa";
      service_category: "pet_sitter" | "passeador" | "hospedagem_creche" | "adestrador" | "banho_tosa" | "veterinario_domiciliar";
      suspension_status: "pendente" | "aprovada" | "rejeitada";
    };
    CompositeTypes: Record<string, never>;
  };
}
