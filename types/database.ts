export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.5"
  }
  public: {
    Tables: {
      account_roles: {
        Row: {
          active: boolean
          created_at: string
          id: string
          profile_id: string
          role: Database["public"]["Enums"]["app_role"]
        }
        Insert: {
          active?: boolean
          created_at?: string
          id?: string
          profile_id: string
          role: Database["public"]["Enums"]["app_role"]
        }
        Update: {
          active?: boolean
          created_at?: string
          id?: string
          profile_id?: string
          role?: Database["public"]["Enums"]["app_role"]
        }
        Relationships: [
          {
            foreignKeyName: "account_roles_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      account_suspensions: {
        Row: {
          created_at: string
          decided_at: string | null
          decided_by: string | null
          id: string
          reason: string
          recommended_by: string
          related_incident_id: string | null
          status: Database["public"]["Enums"]["suspension_status"]
          target_profile_id: string
        }
        Insert: {
          created_at?: string
          decided_at?: string | null
          decided_by?: string | null
          id?: string
          reason: string
          recommended_by: string
          related_incident_id?: string | null
          status?: Database["public"]["Enums"]["suspension_status"]
          target_profile_id: string
        }
        Update: {
          created_at?: string
          decided_at?: string | null
          decided_by?: string | null
          id?: string
          reason?: string
          recommended_by?: string
          related_incident_id?: string | null
          status?: Database["public"]["Enums"]["suspension_status"]
          target_profile_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "account_suspensions_decided_by_fkey"
            columns: ["decided_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "account_suspensions_recommended_by_fkey"
            columns: ["recommended_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "account_suspensions_related_incident_id_fkey"
            columns: ["related_incident_id"]
            isOneToOne: false
            referencedRelation: "incidents"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "account_suspensions_target_profile_id_fkey"
            columns: ["target_profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      admin_audit_log: {
        Row: {
          action: string
          actor_id: string
          created_at: string
          details: Json
          id: string
          target_incident_id: string | null
          target_profile_id: string | null
        }
        Insert: {
          action: string
          actor_id: string
          created_at?: string
          details?: Json
          id?: string
          target_incident_id?: string | null
          target_profile_id?: string | null
        }
        Update: {
          action?: string
          actor_id?: string
          created_at?: string
          details?: Json
          id?: string
          target_incident_id?: string | null
          target_profile_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "admin_audit_log_actor_id_fkey"
            columns: ["actor_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "admin_audit_log_target_incident_id_fkey"
            columns: ["target_incident_id"]
            isOneToOne: false
            referencedRelation: "incidents"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "admin_audit_log_target_profile_id_fkey"
            columns: ["target_profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      contact_unlocks: {
        Row: {
          professional_id: string
          tutor_id: string
          unlocked_at: string
          unlocked_by_request_id: string
        }
        Insert: {
          professional_id: string
          tutor_id: string
          unlocked_at?: string
          unlocked_by_request_id: string
        }
        Update: {
          professional_id?: string
          tutor_id?: string
          unlocked_at?: string
          unlocked_by_request_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "contact_unlocks_professional_id_fkey"
            columns: ["professional_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "contact_unlocks_tutor_id_fkey"
            columns: ["tutor_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "contact_unlocks_unlocked_by_request_id_fkey"
            columns: ["unlocked_by_request_id"]
            isOneToOne: false
            referencedRelation: "requests"
            referencedColumns: ["id"]
          },
        ]
      }
      incident_evidence: {
        Row: {
          created_at: string
          id: string
          incident_id: string
          type: string
          uploaded_by: string
          url: string
        }
        Insert: {
          created_at?: string
          id?: string
          incident_id: string
          type: string
          uploaded_by: string
          url: string
        }
        Update: {
          created_at?: string
          id?: string
          incident_id?: string
          type?: string
          uploaded_by?: string
          url?: string
        }
        Relationships: [
          {
            foreignKeyName: "incident_evidence_incident_id_fkey"
            columns: ["incident_id"]
            isOneToOne: false
            referencedRelation: "incidents"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "incident_evidence_uploaded_by_fkey"
            columns: ["uploaded_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      incidents: {
        Row: {
          appeal_reason: string | null
          appealed_at: string | null
          assigned_to: string | null
          blocks_payout: boolean
          created_at: string
          description: string
          id: string
          occurrence_id: string | null
          opened_by: string
          request_id: string
          resolution: string | null
          resolved_at: string | null
          status: Database["public"]["Enums"]["incident_status"]
          type: string
          urgency: Database["public"]["Enums"]["incident_urgency"]
        }
        Insert: {
          appeal_reason?: string | null
          appealed_at?: string | null
          assigned_to?: string | null
          blocks_payout?: boolean
          created_at?: string
          description?: string
          id?: string
          occurrence_id?: string | null
          opened_by: string
          request_id: string
          resolution?: string | null
          resolved_at?: string | null
          status?: Database["public"]["Enums"]["incident_status"]
          type: string
          urgency?: Database["public"]["Enums"]["incident_urgency"]
        }
        Update: {
          appeal_reason?: string | null
          appealed_at?: string | null
          assigned_to?: string | null
          blocks_payout?: boolean
          created_at?: string
          description?: string
          id?: string
          occurrence_id?: string | null
          opened_by?: string
          request_id?: string
          resolution?: string | null
          resolved_at?: string | null
          status?: Database["public"]["Enums"]["incident_status"]
          type?: string
          urgency?: Database["public"]["Enums"]["incident_urgency"]
        }
        Relationships: [
          {
            foreignKeyName: "incidents_assigned_to_fkey"
            columns: ["assigned_to"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "incidents_occurrence_id_fkey"
            columns: ["occurrence_id"]
            isOneToOne: false
            referencedRelation: "request_occurrences"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "incidents_opened_by_fkey"
            columns: ["opened_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "incidents_request_id_fkey"
            columns: ["request_id"]
            isOneToOne: false
            referencedRelation: "requests"
            referencedColumns: ["id"]
          },
        ]
      }
      messages: {
        Row: {
          content: string
          created_at: string
          flagged_at: string | null
          flagged_by: string | null
          flagged_reason: string | null
          hidden_at: string | null
          hidden_by: string | null
          id: string
          request_id: string
          sender_id: string
        }
        Insert: {
          content: string
          created_at?: string
          flagged_at?: string | null
          flagged_by?: string | null
          flagged_reason?: string | null
          hidden_at?: string | null
          hidden_by?: string | null
          id?: string
          request_id: string
          sender_id: string
        }
        Update: {
          content?: string
          created_at?: string
          flagged_at?: string | null
          flagged_by?: string | null
          flagged_reason?: string | null
          hidden_at?: string | null
          hidden_by?: string | null
          id?: string
          request_id?: string
          sender_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "messages_flagged_by_fkey"
            columns: ["flagged_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "messages_hidden_by_fkey"
            columns: ["hidden_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "messages_request_id_fkey"
            columns: ["request_id"]
            isOneToOne: false
            referencedRelation: "requests"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "messages_sender_id_fkey"
            columns: ["sender_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      no_show_records: {
        Row: {
          checkin_confirmed: boolean
          contact_attempt_confirmed: boolean
          created_at: string
          id: string
          min_wait_confirmed: boolean
          occurrence_id: string
          professional_compensation: number | null
          reported_by: string
          reported_party: Database["public"]["Enums"]["no_show_party"]
          request_id: string
          retained_amount: number | null
          retained_percent: number | null
        }
        Insert: {
          checkin_confirmed?: boolean
          contact_attempt_confirmed?: boolean
          created_at?: string
          id?: string
          min_wait_confirmed?: boolean
          occurrence_id: string
          professional_compensation?: number | null
          reported_by: string
          reported_party: Database["public"]["Enums"]["no_show_party"]
          request_id: string
          retained_amount?: number | null
          retained_percent?: number | null
        }
        Update: {
          checkin_confirmed?: boolean
          contact_attempt_confirmed?: boolean
          created_at?: string
          id?: string
          min_wait_confirmed?: boolean
          occurrence_id?: string
          professional_compensation?: number | null
          reported_by?: string
          reported_party?: Database["public"]["Enums"]["no_show_party"]
          request_id?: string
          retained_amount?: number | null
          retained_percent?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "no_show_records_occurrence_id_fkey"
            columns: ["occurrence_id"]
            isOneToOne: false
            referencedRelation: "request_occurrences"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "no_show_records_reported_by_fkey"
            columns: ["reported_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "no_show_records_request_id_fkey"
            columns: ["request_id"]
            isOneToOne: false
            referencedRelation: "requests"
            referencedColumns: ["id"]
          },
        ]
      }
      notifications: {
        Row: {
          created_at: string
          id: string
          payload: Json
          profile_id: string
          read_at: string | null
          type: string
        }
        Insert: {
          created_at?: string
          id?: string
          payload?: Json
          profile_id: string
          read_at?: string | null
          type: string
        }
        Update: {
          created_at?: string
          id?: string
          payload?: Json
          profile_id?: string
          read_at?: string | null
          type?: string
        }
        Relationships: [
          {
            foreignKeyName: "notifications_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      payments: {
        Row: {
          amount: number
          commission_amount: number
          created_at: string
          gateway_transaction_id: string | null
          id: string
          paid_at: string | null
          request_id: string
          status: Database["public"]["Enums"]["payment_status"]
        }
        Insert: {
          amount: number
          commission_amount?: number
          created_at?: string
          gateway_transaction_id?: string | null
          id?: string
          paid_at?: string | null
          request_id: string
          status?: Database["public"]["Enums"]["payment_status"]
        }
        Update: {
          amount?: number
          commission_amount?: number
          created_at?: string
          gateway_transaction_id?: string | null
          id?: string
          paid_at?: string | null
          request_id?: string
          status?: Database["public"]["Enums"]["payment_status"]
        }
        Relationships: [
          {
            foreignKeyName: "payments_request_id_fkey"
            columns: ["request_id"]
            isOneToOne: false
            referencedRelation: "requests"
            referencedColumns: ["id"]
          },
        ]
      }
      payouts: {
        Row: {
          amount: number
          created_at: string
          gateway_transfer_id: string | null
          id: string
          paid_at: string | null
          professional_id: string
          request_id: string
          requested_at: string | null
          status: Database["public"]["Enums"]["payout_status"]
          updated_at: string
        }
        Insert: {
          amount: number
          created_at?: string
          gateway_transfer_id?: string | null
          id?: string
          paid_at?: string | null
          professional_id: string
          request_id: string
          requested_at?: string | null
          status?: Database["public"]["Enums"]["payout_status"]
          updated_at?: string
        }
        Update: {
          amount?: number
          created_at?: string
          gateway_transfer_id?: string | null
          id?: string
          paid_at?: string | null
          professional_id?: string
          request_id?: string
          requested_at?: string | null
          status?: Database["public"]["Enums"]["payout_status"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "payouts_professional_id_fkey"
            columns: ["professional_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payouts_request_id_fkey"
            columns: ["request_id"]
            isOneToOne: false
            referencedRelation: "requests"
            referencedColumns: ["id"]
          },
        ]
      }
      pet_co_tutor_invites: {
        Row: {
          accepted_at: string | null
          created_at: string
          id: string
          invited_by: string
          invited_email: string
          pet_id: string
          status: string
        }
        Insert: {
          accepted_at?: string | null
          created_at?: string
          id?: string
          invited_by: string
          invited_email: string
          pet_id: string
          status?: string
        }
        Update: {
          accepted_at?: string | null
          created_at?: string
          id?: string
          invited_by?: string
          invited_email?: string
          pet_id?: string
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "pet_co_tutor_invites_invited_by_fkey"
            columns: ["invited_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pet_co_tutor_invites_pet_id_fkey"
            columns: ["pet_id"]
            isOneToOne: false
            referencedRelation: "pets"
            referencedColumns: ["id"]
          },
        ]
      }
      pet_tutors: {
        Row: {
          added_at: string
          pet_id: string
          tutor_profile_id: string
        }
        Insert: {
          added_at?: string
          pet_id: string
          tutor_profile_id: string
        }
        Update: {
          added_at?: string
          pet_id?: string
          tutor_profile_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "pet_tutors_pet_id_fkey"
            columns: ["pet_id"]
            isOneToOne: false
            referencedRelation: "pets"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pet_tutors_tutor_profile_id_fkey"
            columns: ["tutor_profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      pets: {
        Row: {
          behavior_info: Json
          birth_approx: string | null
          breed: string | null
          created_at: string
          created_by: string
          document_url: string | null
          emergency_info: Json
          health_info: Json
          id: string
          name: string
          photo_url: string | null
          routine_info: Json
          sex: string | null
          size: Database["public"]["Enums"]["pet_size"] | null
          species: string
          updated_at: string
          weight: number | null
        }
        Insert: {
          behavior_info?: Json
          birth_approx?: string | null
          breed?: string | null
          created_at?: string
          created_by: string
          document_url?: string | null
          emergency_info?: Json
          health_info?: Json
          id?: string
          name: string
          photo_url?: string | null
          routine_info?: Json
          sex?: string | null
          size?: Database["public"]["Enums"]["pet_size"] | null
          species: string
          updated_at?: string
          weight?: number | null
        }
        Update: {
          behavior_info?: Json
          birth_approx?: string | null
          breed?: string | null
          created_at?: string
          created_by?: string
          document_url?: string | null
          emergency_info?: Json
          health_info?: Json
          id?: string
          name?: string
          photo_url?: string | null
          routine_info?: Json
          sex?: string | null
          size?: Database["public"]["Enums"]["pet_size"] | null
          species?: string
          updated_at?: string
          weight?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "pets_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      platform_parameters: {
        Row: {
          atualizado_em: string
          atualizado_por: string
          chave1: string
          chave2: string
          chave3: string
          explicacao: string | null
          id: string
          status: Database["public"]["Enums"]["parameter_lifecycle"]
          valor1: string | null
          valor2: string | null
          valor3: string | null
          vigencia_inicio: string
        }
        Insert: {
          atualizado_em?: string
          atualizado_por: string
          chave1: string
          chave2?: string
          chave3?: string
          explicacao?: string | null
          id?: string
          status?: Database["public"]["Enums"]["parameter_lifecycle"]
          valor1?: string | null
          valor2?: string | null
          valor3?: string | null
          vigencia_inicio?: string
        }
        Update: {
          atualizado_em?: string
          atualizado_por?: string
          chave1?: string
          chave2?: string
          chave3?: string
          explicacao?: string | null
          id?: string
          status?: Database["public"]["Enums"]["parameter_lifecycle"]
          valor1?: string | null
          valor2?: string | null
          valor3?: string | null
          vigencia_inicio?: string
        }
        Relationships: [
          {
            foreignKeyName: "platform_parameters_atualizado_por_fkey"
            columns: ["atualizado_por"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      platform_parameters_log: {
        Row: {
          acao: Database["public"]["Enums"]["parameter_action"]
          alterado_por: string
          chave1: string
          chave2: string
          chave3: string
          criado_em: string
          id: string
          parameter_id: string
          valores_anteriores: Json | null
          valores_novos: Json | null
        }
        Insert: {
          acao: Database["public"]["Enums"]["parameter_action"]
          alterado_por: string
          chave1: string
          chave2: string
          chave3: string
          criado_em?: string
          id?: string
          parameter_id: string
          valores_anteriores?: Json | null
          valores_novos?: Json | null
        }
        Update: {
          acao?: Database["public"]["Enums"]["parameter_action"]
          alterado_por?: string
          chave1?: string
          chave2?: string
          chave3?: string
          criado_em?: string
          id?: string
          parameter_id?: string
          valores_anteriores?: Json | null
          valores_novos?: Json | null
        }
        Relationships: [
          {
            foreignKeyName: "platform_parameters_log_alterado_por_fkey"
            columns: ["alterado_por"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "platform_parameters_log_parameter_id_fkey"
            columns: ["parameter_id"]
            isOneToOne: false
            referencedRelation: "platform_parameters"
            referencedColumns: ["id"]
          },
        ]
      }
      professional_availability: {
        Row: {
          blocked: boolean
          created_at: string
          date_override: string | null
          end_time: string | null
          id: string
          professional_id: string
          reason: string | null
          start_time: string | null
          weekday: number | null
        }
        Insert: {
          blocked?: boolean
          created_at?: string
          date_override?: string | null
          end_time?: string | null
          id?: string
          professional_id: string
          reason?: string | null
          start_time?: string | null
          weekday?: number | null
        }
        Update: {
          blocked?: boolean
          created_at?: string
          date_override?: string | null
          end_time?: string | null
          id?: string
          professional_id?: string
          reason?: string | null
          start_time?: string | null
          weekday?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "professional_availability_professional_id_fkey"
            columns: ["professional_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      professional_cancellations: {
        Row: {
          created_at: string
          debited_commission: number
          id: string
          occurrence_id: string | null
          professional_id: string
          refunded_amount: number
          request_id: string
          settled: boolean
          settled_at: string | null
        }
        Insert: {
          created_at?: string
          debited_commission: number
          id?: string
          occurrence_id?: string | null
          professional_id: string
          refunded_amount: number
          request_id: string
          settled?: boolean
          settled_at?: string | null
        }
        Update: {
          created_at?: string
          debited_commission?: number
          id?: string
          occurrence_id?: string | null
          professional_id?: string
          refunded_amount?: number
          request_id?: string
          settled?: boolean
          settled_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "professional_cancellations_occurrence_id_fkey"
            columns: ["occurrence_id"]
            isOneToOne: false
            referencedRelation: "request_occurrences"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "professional_cancellations_professional_id_fkey"
            columns: ["professional_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "professional_cancellations_request_id_fkey"
            columns: ["request_id"]
            isOneToOne: false
            referencedRelation: "requests"
            referencedColumns: ["id"]
          },
        ]
      }
      professional_certifications: {
        Row: {
          category: Database["public"]["Enums"]["service_category"]
          created_at: string
          document_url: string
          id: string
          professional_id: string
          review_notes: string | null
          reviewed_at: string | null
          reviewed_by: string | null
          status: string
        }
        Insert: {
          category: Database["public"]["Enums"]["service_category"]
          created_at?: string
          document_url: string
          id?: string
          professional_id: string
          review_notes?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: string
        }
        Update: {
          category?: Database["public"]["Enums"]["service_category"]
          created_at?: string
          document_url?: string
          id?: string
          professional_id?: string
          review_notes?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "professional_certifications_professional_id_fkey"
            columns: ["professional_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "professional_certifications_reviewed_by_fkey"
            columns: ["reviewed_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      professional_profiles: {
        Row: {
          avatar_url: string | null
          bio: string | null
          experience_years: number | null
          languages: string[]
          policies: string | null
          profile_id: string
          specializations: string[]
          updated_at: string
          visita_inicial_deductible: boolean
          visita_inicial_duration_minutes: number | null
          visita_inicial_enabled: boolean
          visita_inicial_modality: string | null
          visita_inicial_price: number | null
        }
        Insert: {
          avatar_url?: string | null
          bio?: string | null
          experience_years?: number | null
          languages?: string[]
          policies?: string | null
          profile_id: string
          specializations?: string[]
          updated_at?: string
          visita_inicial_deductible?: boolean
          visita_inicial_duration_minutes?: number | null
          visita_inicial_enabled?: boolean
          visita_inicial_modality?: string | null
          visita_inicial_price?: number | null
        }
        Update: {
          avatar_url?: string | null
          bio?: string | null
          experience_years?: number | null
          languages?: string[]
          policies?: string | null
          profile_id?: string
          specializations?: string[]
          updated_at?: string
          visita_inicial_deductible?: boolean
          visita_inicial_duration_minutes?: number | null
          visita_inicial_enabled?: boolean
          visita_inicial_modality?: string | null
          visita_inicial_price?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "professional_profiles_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: true
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      professional_service_addons: {
        Row: {
          created_at: string
          id: string
          name: string
          price: number
          service_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          name: string
          price: number
          service_id: string
        }
        Update: {
          created_at?: string
          id?: string
          name?: string
          price?: number
          service_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "professional_service_addons_service_id_fkey"
            columns: ["service_id"]
            isOneToOne: false
            referencedRelation: "professional_services"
            referencedColumns: ["id"]
          },
        ]
      }
      professional_service_areas: {
        Row: {
          center_lat: number
          center_lng: number
          created_at: string
          excluded_zips: string[]
          id: string
          professional_id: string
          radius_km: number
        }
        Insert: {
          center_lat: number
          center_lng: number
          created_at?: string
          excluded_zips?: string[]
          id?: string
          professional_id: string
          radius_km?: number
        }
        Update: {
          center_lat?: number
          center_lng?: number
          created_at?: string
          excluded_zips?: string[]
          id?: string
          professional_id?: string
          radius_km?: number
        }
        Relationships: [
          {
            foreignKeyName: "professional_service_areas_professional_id_fkey"
            columns: ["professional_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      professional_services: {
        Row: {
          active: boolean
          base_price: number | null
          category: Database["public"]["Enums"]["service_category"]
          created_at: string
          description: string | null
          duration_minutes: number | null
          id: string
          max_size: Database["public"]["Enums"]["pet_size"] | null
          min_size: Database["public"]["Enums"]["pet_size"] | null
          multi_pet_discount_percent: number | null
          pricing_model: string
          professional_id: string
          restrictions: string | null
          species_accepted: string[]
          subcategory: string | null
          updated_at: string
        }
        Insert: {
          active?: boolean
          base_price?: number | null
          category: Database["public"]["Enums"]["service_category"]
          created_at?: string
          description?: string | null
          duration_minutes?: number | null
          id?: string
          max_size?: Database["public"]["Enums"]["pet_size"] | null
          min_size?: Database["public"]["Enums"]["pet_size"] | null
          multi_pet_discount_percent?: number | null
          pricing_model: string
          professional_id: string
          restrictions?: string | null
          species_accepted?: string[]
          subcategory?: string | null
          updated_at?: string
        }
        Update: {
          active?: boolean
          base_price?: number | null
          category?: Database["public"]["Enums"]["service_category"]
          created_at?: string
          description?: string | null
          duration_minutes?: number | null
          id?: string
          max_size?: Database["public"]["Enums"]["pet_size"] | null
          min_size?: Database["public"]["Enums"]["pet_size"] | null
          multi_pet_discount_percent?: number | null
          pricing_model?: string
          professional_id?: string
          restrictions?: string | null
          species_accepted?: string[]
          subcategory?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "professional_services_professional_id_fkey"
            columns: ["professional_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          address_lat: number | null
          address_lng: number | null
          address_zip: string | null
          birth_date: string | null
          cpf_cnpj: string | null
          created_at: string
          email: string
          email_verified_at: string | null
          full_name: string
          id: string
          internal_username: string | null
          phone: string | null
          phone_verified_at: string | null
          updated_at: string
        }
        Insert: {
          address_lat?: number | null
          address_lng?: number | null
          address_zip?: string | null
          birth_date?: string | null
          cpf_cnpj?: string | null
          created_at?: string
          email: string
          email_verified_at?: string | null
          full_name: string
          id: string
          internal_username?: string | null
          phone?: string | null
          phone_verified_at?: string | null
          updated_at?: string
        }
        Update: {
          address_lat?: number | null
          address_lng?: number | null
          address_zip?: string | null
          birth_date?: string | null
          cpf_cnpj?: string | null
          created_at?: string
          email?: string
          email_verified_at?: string | null
          full_name?: string
          id?: string
          internal_username?: string | null
          phone?: string | null
          phone_verified_at?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      proposals: {
        Row: {
          accepted_at: string | null
          additional_fees: number
          cancellation_policy: Json
          created_at: string
          created_by: string
          deposit_percent: number | null
          id: string
          price: number
          proposed_period: string | null
          proposed_scheduled_at: string | null
          request_id: string
          requires_full_payment: boolean
          scope: string
          validity_at: string
          version: number
        }
        Insert: {
          accepted_at?: string | null
          additional_fees?: number
          cancellation_policy?: Json
          created_at?: string
          created_by: string
          deposit_percent?: number | null
          id?: string
          price: number
          proposed_period?: string | null
          proposed_scheduled_at?: string | null
          request_id: string
          requires_full_payment?: boolean
          scope: string
          validity_at: string
          version?: number
        }
        Update: {
          accepted_at?: string | null
          additional_fees?: number
          cancellation_policy?: Json
          created_at?: string
          created_by?: string
          deposit_percent?: number | null
          id?: string
          price?: number
          proposed_period?: string | null
          proposed_scheduled_at?: string | null
          request_id?: string
          requires_full_payment?: boolean
          scope?: string
          validity_at?: string
          version?: number
        }
        Relationships: [
          {
            foreignKeyName: "proposals_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "proposals_request_id_fkey"
            columns: ["request_id"]
            isOneToOne: false
            referencedRelation: "requests"
            referencedColumns: ["id"]
          },
        ]
      }
      request_attachments: {
        Row: {
          created_at: string
          id: string
          request_id: string
          uploaded_by: string
          url: string
        }
        Insert: {
          created_at?: string
          id?: string
          request_id: string
          uploaded_by: string
          url: string
        }
        Update: {
          created_at?: string
          id?: string
          request_id?: string
          uploaded_by?: string
          url?: string
        }
        Relationships: [
          {
            foreignKeyName: "request_attachments_request_id_fkey"
            columns: ["request_id"]
            isOneToOne: false
            referencedRelation: "requests"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "request_attachments_uploaded_by_fkey"
            columns: ["uploaded_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      request_occurrences: {
        Row: {
          checkin_at: string | null
          checkin_lat: number | null
          checkin_lng: number | null
          completed_at: string | null
          created_at: string
          id: string
          report: Json
          request_id: string
          scheduled_at: string
          sequence_number: number
          status: Database["public"]["Enums"]["occurrence_status"]
        }
        Insert: {
          checkin_at?: string | null
          checkin_lat?: number | null
          checkin_lng?: number | null
          completed_at?: string | null
          created_at?: string
          id?: string
          report?: Json
          request_id: string
          scheduled_at: string
          sequence_number?: number
          status?: Database["public"]["Enums"]["occurrence_status"]
        }
        Update: {
          checkin_at?: string | null
          checkin_lat?: number | null
          checkin_lng?: number | null
          completed_at?: string | null
          created_at?: string
          id?: string
          report?: Json
          request_id?: string
          scheduled_at?: string
          sequence_number?: number
          status?: Database["public"]["Enums"]["occurrence_status"]
        }
        Relationships: [
          {
            foreignKeyName: "request_occurrences_request_id_fkey"
            columns: ["request_id"]
            isOneToOne: false
            referencedRelation: "requests"
            referencedColumns: ["id"]
          },
        ]
      }
      request_pets: {
        Row: {
          pet_id: string
          request_id: string
        }
        Insert: {
          pet_id: string
          request_id: string
        }
        Update: {
          pet_id?: string
          request_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "request_pets_pet_id_fkey"
            columns: ["pet_id"]
            isOneToOne: false
            referencedRelation: "pets"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "request_pets_request_id_fkey"
            columns: ["request_id"]
            isOneToOne: false
            referencedRelation: "requests"
            referencedColumns: ["id"]
          },
        ]
      }
      request_status_history: {
        Row: {
          changed_by: string | null
          created_at: string
          from_status: Database["public"]["Enums"]["request_status"] | null
          id: string
          note: string | null
          request_id: string
          to_status: Database["public"]["Enums"]["request_status"]
        }
        Insert: {
          changed_by?: string | null
          created_at?: string
          from_status?: Database["public"]["Enums"]["request_status"] | null
          id?: string
          note?: string | null
          request_id: string
          to_status: Database["public"]["Enums"]["request_status"]
        }
        Update: {
          changed_by?: string | null
          created_at?: string
          from_status?: Database["public"]["Enums"]["request_status"] | null
          id?: string
          note?: string | null
          request_id?: string
          to_status?: Database["public"]["Enums"]["request_status"]
        }
        Relationships: [
          {
            foreignKeyName: "request_status_history_changed_by_fkey"
            columns: ["changed_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "request_status_history_request_id_fkey"
            columns: ["request_id"]
            isOneToOne: false
            referencedRelation: "requests"
            referencedColumns: ["id"]
          },
        ]
      }
      request_status_transitions_allowed: {
        Row: {
          from_status: Database["public"]["Enums"]["request_status"]
          to_status: Database["public"]["Enums"]["request_status"]
        }
        Insert: {
          from_status: Database["public"]["Enums"]["request_status"]
          to_status: Database["public"]["Enums"]["request_status"]
        }
        Update: {
          from_status?: Database["public"]["Enums"]["request_status"]
          to_status?: Database["public"]["Enums"]["request_status"]
        }
        Relationships: []
      }
      requests: {
        Row: {
          address: string | null
          category: Database["public"]["Enums"]["service_category"]
          category_answers: Json
          commission_percent_snapshot: number | null
          created_at: string
          id: string
          is_recurring: boolean
          is_visita_inicial: boolean
          occurrences_total: number
          origin_request_id: string | null
          professional_id: string
          prontuario_shared_at: string | null
          recurrence_interval: string | null
          status: Database["public"]["Enums"]["request_status"]
          tutor_id: string
          updated_at: string
        }
        Insert: {
          address?: string | null
          category: Database["public"]["Enums"]["service_category"]
          category_answers?: Json
          commission_percent_snapshot?: number | null
          created_at?: string
          id?: string
          is_recurring?: boolean
          is_visita_inicial?: boolean
          occurrences_total?: number
          origin_request_id?: string | null
          professional_id: string
          prontuario_shared_at?: string | null
          recurrence_interval?: string | null
          status?: Database["public"]["Enums"]["request_status"]
          tutor_id: string
          updated_at?: string
        }
        Update: {
          address?: string | null
          category?: Database["public"]["Enums"]["service_category"]
          category_answers?: Json
          commission_percent_snapshot?: number | null
          created_at?: string
          id?: string
          is_recurring?: boolean
          is_visita_inicial?: boolean
          occurrences_total?: number
          origin_request_id?: string | null
          professional_id?: string
          prontuario_shared_at?: string | null
          recurrence_interval?: string | null
          status?: Database["public"]["Enums"]["request_status"]
          tutor_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "requests_origin_request_id_fkey"
            columns: ["origin_request_id"]
            isOneToOne: false
            referencedRelation: "requests"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "requests_professional_id_fkey"
            columns: ["professional_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "requests_tutor_id_fkey"
            columns: ["tutor_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      reviews: {
        Row: {
          comment: string | null
          created_at: string
          flagged_at: string | null
          flagged_by: string | null
          flagged_reason: string | null
          hidden_at: string | null
          hidden_by: string | null
          id: string
          rating: Json
          request_id: string
          response: string | null
          reviewee_id: string
          reviewer_id: string
        }
        Insert: {
          comment?: string | null
          created_at?: string
          flagged_at?: string | null
          flagged_by?: string | null
          flagged_reason?: string | null
          hidden_at?: string | null
          hidden_by?: string | null
          id?: string
          rating: Json
          request_id: string
          response?: string | null
          reviewee_id: string
          reviewer_id: string
        }
        Update: {
          comment?: string | null
          created_at?: string
          flagged_at?: string | null
          flagged_by?: string | null
          flagged_reason?: string | null
          hidden_at?: string | null
          hidden_by?: string | null
          id?: string
          rating?: Json
          request_id?: string
          response?: string | null
          reviewee_id?: string
          reviewer_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "reviews_flagged_by_fkey"
            columns: ["flagged_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reviews_hidden_by_fkey"
            columns: ["hidden_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reviews_request_id_fkey"
            columns: ["request_id"]
            isOneToOne: false
            referencedRelation: "requests"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reviews_reviewee_id_fkey"
            columns: ["reviewee_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reviews_reviewer_id_fkey"
            columns: ["reviewer_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      supervisor_grants: {
        Row: {
          created_at: string
          created_by_admin_id: string
          id: string
          revoked_at: string | null
          revoked_by_admin_id: string | null
          supervisor_profile_id: string
        }
        Insert: {
          created_at?: string
          created_by_admin_id: string
          id?: string
          revoked_at?: string | null
          revoked_by_admin_id?: string | null
          supervisor_profile_id: string
        }
        Update: {
          created_at?: string
          created_by_admin_id?: string
          id?: string
          revoked_at?: string | null
          revoked_by_admin_id?: string | null
          supervisor_profile_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "supervisor_grants_created_by_admin_id_fkey"
            columns: ["created_by_admin_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "supervisor_grants_revoked_by_admin_id_fkey"
            columns: ["revoked_by_admin_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "supervisor_grants_supervisor_profile_id_fkey"
            columns: ["supervisor_profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      terms_acceptances: {
        Row: {
          accepted_at: string
          profile_id: string
          version: string
        }
        Insert: {
          accepted_at?: string
          profile_id: string
          version: string
        }
        Update: {
          accepted_at?: string
          profile_id?: string
          version?: string
        }
        Relationships: [
          {
            foreignKeyName: "terms_acceptances_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      tutor_favorites: {
        Row: {
          created_at: string
          professional_id: string
          tutor_profile_id: string
        }
        Insert: {
          created_at?: string
          professional_id: string
          tutor_profile_id: string
        }
        Update: {
          created_at?: string
          professional_id?: string
          tutor_profile_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "tutor_favorites_professional_id_fkey"
            columns: ["professional_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tutor_favorites_tutor_profile_id_fkey"
            columns: ["tutor_profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      accept_pending_pet_co_tutor_invites: { Args: never; Returns: number }
      appeal_incident: {
        Args: { p_incident_id: string; p_reason: string }
        Returns: undefined
      }
      contact_is_unlocked: {
        Args: { other_profile_id: string }
        Returns: boolean
      }
      dismiss_message_flag: {
        Args: { p_message_id: string }
        Returns: undefined
      }
      dismiss_review_flag: { Args: { p_review_id: string }; Returns: undefined }
      distance_km: {
        Args: { lat1: number; lat2: number; lng1: number; lng2: number }
        Returns: number
      }
      flag_message: {
        Args: { p_message_id: string; p_reason: string }
        Returns: undefined
      }
      flag_review: {
        Args: { p_reason: string; p_review_id: string }
        Returns: undefined
      }
      has_role: {
        Args: { target_role: Database["public"]["Enums"]["app_role"] }
        Returns: boolean
      }
      is_admin_or_supervisor: { Args: never; Returns: boolean }
      is_party_of_request: { Args: { req_id: string }; Returns: boolean }
      is_tutor_of_pet: { Args: { pet_id_arg: string }; Returns: boolean }
      notify: {
        Args: { p_payload: Json; p_profile_id: string; p_type: string }
        Returns: undefined
      }
      set_message_hidden: {
        Args: { p_hidden: boolean; p_message_id: string }
        Returns: undefined
      }
      set_review_hidden: {
        Args: { p_hidden: boolean; p_review_id: string }
        Returns: undefined
      }
    }
    Enums: {
      app_role: "tutor" | "profissional" | "administrador" | "supervisor"
      incident_status: "aberto" | "em_analise" | "resolvido" | "escalado"
      incident_urgency: "baixa" | "media" | "alta" | "emergencia"
      no_show_party: "tutor" | "profissional"
      occurrence_status:
        | "agendado"
        | "checkin"
        | "em_andamento"
        | "finalizacao"
        | "concluido"
        | "cancelado"
        | "nao_compareceu"
      parameter_action: "criacao" | "edicao" | "exclusao"
      parameter_lifecycle: "ativo" | "substituido"
      payment_status:
        | "pendente"
        | "processando"
        | "pago"
        | "estornado"
        | "falhou"
      payout_status:
        | "agendado"
        | "retido"
        | "disponivel"
        | "solicitado"
        | "pago"
        | "bloqueado"
      pet_size: "pequeno" | "medio" | "grande" | "gigante"
      request_status:
        | "rascunho"
        | "solicitacao_enviada"
        | "em_conversa"
        | "proposta_enviada"
        | "aguardando_pagamento"
        | "confirmado"
        | "checkin"
        | "em_andamento"
        | "finalizacao"
        | "concluido"
        | "avaliacao"
        | "recusado"
        | "expirado"
        | "cancelado"
        | "incidente"
        | "em_disputa"
      service_category:
        | "pet_sitter"
        | "passeador"
        | "hospedagem_creche"
        | "adestrador"
        | "banho_tosa"
        | "veterinario_domiciliar"
      suspension_status: "pendente" | "aprovada" | "rejeitada"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {
      app_role: ["tutor", "profissional", "administrador", "supervisor"],
      incident_status: ["aberto", "em_analise", "resolvido", "escalado"],
      incident_urgency: ["baixa", "media", "alta", "emergencia"],
      no_show_party: ["tutor", "profissional"],
      occurrence_status: [
        "agendado",
        "checkin",
        "em_andamento",
        "finalizacao",
        "concluido",
        "cancelado",
        "nao_compareceu",
      ],
      parameter_action: ["criacao", "edicao", "exclusao"],
      parameter_lifecycle: ["ativo", "substituido"],
      payment_status: [
        "pendente",
        "processando",
        "pago",
        "estornado",
        "falhou",
      ],
      payout_status: [
        "agendado",
        "retido",
        "disponivel",
        "solicitado",
        "pago",
        "bloqueado",
      ],
      pet_size: ["pequeno", "medio", "grande", "gigante"],
      request_status: [
        "rascunho",
        "solicitacao_enviada",
        "em_conversa",
        "proposta_enviada",
        "aguardando_pagamento",
        "confirmado",
        "checkin",
        "em_andamento",
        "finalizacao",
        "concluido",
        "avaliacao",
        "recusado",
        "expirado",
        "cancelado",
        "incidente",
        "em_disputa",
      ],
      service_category: [
        "pet_sitter",
        "passeador",
        "hospedagem_creche",
        "adestrador",
        "banho_tosa",
        "veterinario_domiciliar",
      ],
      suspension_status: ["pendente", "aprovada", "rejeitada"],
    },
  },
} as const

// Convenience enum aliases — hand-maintained, re-appended after every type regen.
export type AppRole = Database["public"]["Enums"]["app_role"];
export type IncidentStatus = Database["public"]["Enums"]["incident_status"];
export type IncidentUrgency = Database["public"]["Enums"]["incident_urgency"];
export type NoShowParty = Database["public"]["Enums"]["no_show_party"];
export type OccurrenceStatus = Database["public"]["Enums"]["occurrence_status"];
export type ParameterAction = Database["public"]["Enums"]["parameter_action"];
export type ParameterLifecycle = Database["public"]["Enums"]["parameter_lifecycle"];
export type PaymentStatus = Database["public"]["Enums"]["payment_status"];
export type PayoutStatus = Database["public"]["Enums"]["payout_status"];
export type PetSize = Database["public"]["Enums"]["pet_size"];
export type RequestStatus = Database["public"]["Enums"]["request_status"];
export type ServiceCategory = Database["public"]["Enums"]["service_category"];
export type SuspensionStatus = Database["public"]["Enums"]["suspension_status"];
