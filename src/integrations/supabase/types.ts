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
    PostgrestVersion: "14.1"
  }
  public: {
    Tables: {
      answers: {
        Row: {
          answer_text: string
          created_at: string
          id: string
          is_correct: boolean
          organization_id: string
          question_id: string
          sort_order: number
        }
        Insert: {
          answer_text: string
          created_at?: string
          id?: string
          is_correct?: boolean
          organization_id: string
          question_id: string
          sort_order?: number
        }
        Update: {
          answer_text?: string
          created_at?: string
          id?: string
          is_correct?: boolean
          organization_id?: string
          question_id?: string
          sort_order?: number
        }
        Relationships: [
          {
            foreignKeyName: "answers_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "answers_question_id_fkey"
            columns: ["question_id"]
            isOneToOne: false
            referencedRelation: "questions"
            referencedColumns: ["id"]
          },
        ]
      }
      categories: {
        Row: {
          code: string | null
          created_at: string
          id: string
          is_default: boolean
          is_deleted: boolean
          name: string
          organization_id: string
          updated_at: string
        }
        Insert: {
          code?: string | null
          created_at?: string
          id?: string
          is_default?: boolean
          is_deleted?: boolean
          name: string
          organization_id: string
          updated_at?: string
        }
        Update: {
          code?: string | null
          created_at?: string
          id?: string
          is_default?: boolean
          is_deleted?: boolean
          name?: string
          organization_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "categories_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      category_bonuses: {
        Row: {
          created_at: string
          id: string
          organization_id: string
          quiz_category_id: string
          quiz_id: string
          quiz_team_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          organization_id: string
          quiz_category_id: string
          quiz_id: string
          quiz_team_id: string
        }
        Update: {
          created_at?: string
          id?: string
          organization_id?: string
          quiz_category_id?: string
          quiz_id?: string
          quiz_team_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "category_bonuses_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "category_bonuses_quiz_category_id_fkey"
            columns: ["quiz_category_id"]
            isOneToOne: false
            referencedRelation: "quiz_categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "category_bonuses_quiz_id_fkey"
            columns: ["quiz_id"]
            isOneToOne: false
            referencedRelation: "quizzes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "category_bonuses_quiz_team_id_fkey"
            columns: ["quiz_team_id"]
            isOneToOne: false
            referencedRelation: "quiz_teams"
            referencedColumns: ["id"]
          },
        ]
      }
      contact_submissions: {
        Row: {
          created_at: string
          email: string
          id: string
          message: string
          name: string
        }
        Insert: {
          created_at?: string
          email: string
          id?: string
          message: string
          name: string
        }
        Update: {
          created_at?: string
          email?: string
          id?: string
          message?: string
          name?: string
        }
        Relationships: []
      }
      email_send_log: {
        Row: {
          created_at: string
          error_message: string | null
          id: string
          message_id: string | null
          metadata: Json | null
          recipient_email: string
          status: string
          template_name: string
        }
        Insert: {
          created_at?: string
          error_message?: string | null
          id?: string
          message_id?: string | null
          metadata?: Json | null
          recipient_email: string
          status: string
          template_name: string
        }
        Update: {
          created_at?: string
          error_message?: string | null
          id?: string
          message_id?: string | null
          metadata?: Json | null
          recipient_email?: string
          status?: string
          template_name?: string
        }
        Relationships: []
      }
      email_send_state: {
        Row: {
          auth_email_ttl_minutes: number
          batch_size: number
          id: number
          retry_after_until: string | null
          send_delay_ms: number
          transactional_email_ttl_minutes: number
          updated_at: string
        }
        Insert: {
          auth_email_ttl_minutes?: number
          batch_size?: number
          id?: number
          retry_after_until?: string | null
          send_delay_ms?: number
          transactional_email_ttl_minutes?: number
          updated_at?: string
        }
        Update: {
          auth_email_ttl_minutes?: number
          batch_size?: number
          id?: number
          retry_after_until?: string | null
          send_delay_ms?: number
          transactional_email_ttl_minutes?: number
          updated_at?: string
        }
        Relationships: []
      }
      email_unsubscribe_tokens: {
        Row: {
          created_at: string
          email: string
          id: string
          token: string
          used_at: string | null
        }
        Insert: {
          created_at?: string
          email: string
          id?: string
          token: string
          used_at?: string | null
        }
        Update: {
          created_at?: string
          email?: string
          id?: string
          token?: string
          used_at?: string | null
        }
        Relationships: []
      }
      faq_items: {
        Row: {
          answer_en: string
          answer_sr: string
          created_at: string
          id: string
          is_published: boolean
          question_en: string
          question_sr: string
          sort_order: number
          updated_at: string
        }
        Insert: {
          answer_en: string
          answer_sr: string
          created_at?: string
          id?: string
          is_published?: boolean
          question_en: string
          question_sr: string
          sort_order?: number
          updated_at?: string
        }
        Update: {
          answer_en?: string
          answer_sr?: string
          created_at?: string
          id?: string
          is_published?: boolean
          question_en?: string
          question_sr?: string
          sort_order?: number
          updated_at?: string
        }
        Relationships: []
      }
      gift_codes: {
        Row: {
          code: string
          created_at: string
          created_by: string | null
          duration_days: number | null
          id: string
          is_used: boolean
          note: string | null
          used_at: string | null
          used_by_org_id: string | null
        }
        Insert: {
          code: string
          created_at?: string
          created_by?: string | null
          duration_days?: number | null
          id?: string
          is_used?: boolean
          note?: string | null
          used_at?: string | null
          used_by_org_id?: string | null
        }
        Update: {
          code?: string
          created_at?: string
          created_by?: string | null
          duration_days?: number | null
          id?: string
          is_used?: boolean
          note?: string | null
          used_at?: string | null
          used_by_org_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "gift_codes_used_by_org_id_fkey"
            columns: ["used_by_org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      help_types: {
        Row: {
          created_at: string
          description: string | null
          effect: string
          id: string
          name: string
          organization_id: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          effect?: string
          id?: string
          name: string
          organization_id: string
        }
        Update: {
          created_at?: string
          description?: string | null
          effect?: string
          id?: string
          name?: string
          organization_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "help_types_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      help_usages: {
        Row: {
          created_at: string
          help_type_id: string
          id: string
          organization_id: string
          quiz_category_id: string
          quiz_id: string
          quiz_team_id: string
        }
        Insert: {
          created_at?: string
          help_type_id: string
          id?: string
          organization_id: string
          quiz_category_id: string
          quiz_id: string
          quiz_team_id: string
        }
        Update: {
          created_at?: string
          help_type_id?: string
          id?: string
          organization_id?: string
          quiz_category_id?: string
          quiz_id?: string
          quiz_team_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "help_usages_help_type_id_fkey"
            columns: ["help_type_id"]
            isOneToOne: false
            referencedRelation: "help_types"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "help_usages_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "help_usages_quiz_category_id_fkey"
            columns: ["quiz_category_id"]
            isOneToOne: false
            referencedRelation: "quiz_categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "help_usages_quiz_id_fkey"
            columns: ["quiz_id"]
            isOneToOne: false
            referencedRelation: "quizzes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "help_usages_quiz_team_id_fkey"
            columns: ["quiz_team_id"]
            isOneToOne: false
            referencedRelation: "quiz_teams"
            referencedColumns: ["id"]
          },
        ]
      }
      leagues: {
        Row: {
          created_at: string
          id: string
          is_active: boolean
          name: string
          organization_id: string
          season: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          is_active?: boolean
          name: string
          organization_id: string
          season?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          is_active?: boolean
          name?: string
          organization_id?: string
          season?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "leagues_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      location_schedules: {
        Row: {
          category: string | null
          created_at: string
          day_of_week: number | null
          end_time: string | null
          entry_fee: string | null
          event_date: string | null
          id: string
          is_active: boolean
          language: string | null
          notes: string | null
          organization_id: string
          organization_location_id: string
          prize_info: string | null
          recurrence_pattern: string
          schedule_type: string
          start_time: string
          team_size_info: string | null
          title: string | null
          updated_at: string
          valid_from: string | null
          valid_until: string | null
        }
        Insert: {
          category?: string | null
          created_at?: string
          day_of_week?: number | null
          end_time?: string | null
          entry_fee?: string | null
          event_date?: string | null
          id?: string
          is_active?: boolean
          language?: string | null
          notes?: string | null
          organization_id: string
          organization_location_id: string
          prize_info?: string | null
          recurrence_pattern?: string
          schedule_type?: string
          start_time: string
          team_size_info?: string | null
          title?: string | null
          updated_at?: string
          valid_from?: string | null
          valid_until?: string | null
        }
        Update: {
          category?: string | null
          created_at?: string
          day_of_week?: number | null
          end_time?: string | null
          entry_fee?: string | null
          event_date?: string | null
          id?: string
          is_active?: boolean
          language?: string | null
          notes?: string | null
          organization_id?: string
          organization_location_id?: string
          prize_info?: string | null
          recurrence_pattern?: string
          schedule_type?: string
          start_time?: string
          team_size_info?: string | null
          title?: string | null
          updated_at?: string
          valid_from?: string | null
          valid_until?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "location_schedules_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "location_schedules_organization_location_id_fkey"
            columns: ["organization_location_id"]
            isOneToOne: false
            referencedRelation: "org_locations"
            referencedColumns: ["id"]
          },
        ]
      }
      matching_pairs: {
        Row: {
          created_at: string
          id: string
          left_value: string
          organization_id: string
          question_id: string
          right_value: string
          sort_order: number
        }
        Insert: {
          created_at?: string
          id?: string
          left_value: string
          organization_id: string
          question_id: string
          right_value: string
          sort_order?: number
        }
        Update: {
          created_at?: string
          id?: string
          left_value?: string
          organization_id?: string
          question_id?: string
          right_value?: string
          sort_order?: number
        }
        Relationships: [
          {
            foreignKeyName: "matching_pairs_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "matching_pairs_question_id_fkey"
            columns: ["question_id"]
            isOneToOne: false
            referencedRelation: "questions"
            referencedColumns: ["id"]
          },
        ]
      }
      memberships: {
        Row: {
          created_at: string
          id: string
          invited_by: string | null
          organization_id: string
          role: Database["public"]["Enums"]["org_role"]
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          invited_by?: string | null
          organization_id: string
          role?: Database["public"]["Enums"]["org_role"]
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          invited_by?: string | null
          organization_id?: string
          role?: Database["public"]["Enums"]["org_role"]
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "memberships_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      org_locations: {
        Row: {
          address_line: string | null
          city: string
          contact_email: string | null
          contact_phone: string | null
          country: string
          created_at: string
          description: string | null
          facebook_url: string | null
          id: string
          instagram_url: string | null
          is_active: boolean
          latitude: number | null
          longitude: number | null
          organization_id: string
          postal_code: string | null
          reservation_url: string | null
          updated_at: string
          venue_name: string
          website_url: string | null
        }
        Insert: {
          address_line?: string | null
          city: string
          contact_email?: string | null
          contact_phone?: string | null
          country?: string
          created_at?: string
          description?: string | null
          facebook_url?: string | null
          id?: string
          instagram_url?: string | null
          is_active?: boolean
          latitude?: number | null
          longitude?: number | null
          organization_id: string
          postal_code?: string | null
          reservation_url?: string | null
          updated_at?: string
          venue_name: string
          website_url?: string | null
        }
        Update: {
          address_line?: string | null
          city?: string
          contact_email?: string | null
          contact_phone?: string | null
          country?: string
          created_at?: string
          description?: string | null
          facebook_url?: string | null
          id?: string
          instagram_url?: string | null
          is_active?: boolean
          latitude?: number | null
          longitude?: number | null
          organization_id?: string
          postal_code?: string | null
          reservation_url?: string | null
          updated_at?: string
          venue_name?: string
          website_url?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "org_locations_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      organizations: {
        Row: {
          branding_bg_color: string | null
          branding_color: string | null
          branding_header_color: string | null
          branding_text_color: string | null
          created_at: string
          current_period_end: string | null
          default_categories_count: number | null
          default_questions_per_category: number | null
          deleted_at: string | null
          id: string
          is_deleted: boolean
          logo_url: string | null
          name: string
          premium_override: boolean
          premium_override_by: string | null
          premium_override_reason: string | null
          premium_override_until: string | null
          public_map_enabled: boolean
          secondary_color: string | null
          slug: string | null
          subscription_id: string | null
          subscription_status: string | null
          subscription_tier: string
          trial_ends_at: string | null
          updated_at: string
        }
        Insert: {
          branding_bg_color?: string | null
          branding_color?: string | null
          branding_header_color?: string | null
          branding_text_color?: string | null
          created_at?: string
          current_period_end?: string | null
          default_categories_count?: number | null
          default_questions_per_category?: number | null
          deleted_at?: string | null
          id?: string
          is_deleted?: boolean
          logo_url?: string | null
          name: string
          premium_override?: boolean
          premium_override_by?: string | null
          premium_override_reason?: string | null
          premium_override_until?: string | null
          public_map_enabled?: boolean
          secondary_color?: string | null
          slug?: string | null
          subscription_id?: string | null
          subscription_status?: string | null
          subscription_tier?: string
          trial_ends_at?: string | null
          updated_at?: string
        }
        Update: {
          branding_bg_color?: string | null
          branding_color?: string | null
          branding_header_color?: string | null
          branding_text_color?: string | null
          created_at?: string
          current_period_end?: string | null
          default_categories_count?: number | null
          default_questions_per_category?: number | null
          deleted_at?: string | null
          id?: string
          is_deleted?: boolean
          logo_url?: string | null
          name?: string
          premium_override?: boolean
          premium_override_by?: string | null
          premium_override_reason?: string | null
          premium_override_until?: string | null
          public_map_enabled?: boolean
          secondary_color?: string | null
          slug?: string | null
          subscription_id?: string | null
          subscription_status?: string | null
          subscription_tier?: string
          trial_ends_at?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      pending_invites: {
        Row: {
          created_at: string
          email: string
          id: string
          invited_by: string | null
          organization_id: string
          role: Database["public"]["Enums"]["org_role"]
        }
        Insert: {
          created_at?: string
          email: string
          id?: string
          invited_by?: string | null
          organization_id: string
          role?: Database["public"]["Enums"]["org_role"]
        }
        Update: {
          created_at?: string
          email?: string
          id?: string
          invited_by?: string | null
          organization_id?: string
          role?: Database["public"]["Enums"]["org_role"]
        }
        Relationships: [
          {
            foreignKeyName: "pending_invites_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          created_at: string
          deactivated_at: string | null
          email: string | null
          full_name: string | null
          id: string
          is_deactivated: boolean
          preferred_language: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          deactivated_at?: string | null
          email?: string | null
          full_name?: string | null
          id?: string
          is_deactivated?: boolean
          preferred_language?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          deactivated_at?: string | null
          email?: string | null
          full_name?: string | null
          id?: string
          is_deactivated?: boolean
          preferred_language?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      question_categories: {
        Row: {
          category_id: string
          created_at: string
          id: string
          organization_id: string
          question_id: string
        }
        Insert: {
          category_id: string
          created_at?: string
          id?: string
          organization_id: string
          question_id: string
        }
        Update: {
          category_id?: string
          created_at?: string
          id?: string
          organization_id?: string
          question_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "question_categories_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "question_categories_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "question_categories_question_id_fkey"
            columns: ["question_id"]
            isOneToOne: false
            referencedRelation: "questions"
            referencedColumns: ["id"]
          },
        ]
      }
      questions: {
        Row: {
          code: string
          created_at: string
          id: string
          is_deleted: boolean
          media_role: Database["public"]["Enums"]["media_role"] | null
          media_type: Database["public"]["Enums"]["media_type"] | null
          media_url: string | null
          organization_id: string
          question_text: string
          type: Database["public"]["Enums"]["question_type"]
          updated_at: string
        }
        Insert: {
          code: string
          created_at?: string
          id?: string
          is_deleted?: boolean
          media_role?: Database["public"]["Enums"]["media_role"] | null
          media_type?: Database["public"]["Enums"]["media_type"] | null
          media_url?: string | null
          organization_id: string
          question_text: string
          type?: Database["public"]["Enums"]["question_type"]
          updated_at?: string
        }
        Update: {
          code?: string
          created_at?: string
          id?: string
          is_deleted?: boolean
          media_role?: Database["public"]["Enums"]["media_role"] | null
          media_type?: Database["public"]["Enums"]["media_type"] | null
          media_url?: string | null
          organization_id?: string
          question_text?: string
          type?: Database["public"]["Enums"]["question_type"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "questions_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      quiz_categories: {
        Row: {
          category_id: string
          created_at: string
          id: string
          organization_id: string
          quiz_id: string
          sort_order: number | null
        }
        Insert: {
          category_id: string
          created_at?: string
          id?: string
          organization_id: string
          quiz_id: string
          sort_order?: number | null
        }
        Update: {
          category_id?: string
          created_at?: string
          id?: string
          organization_id?: string
          quiz_id?: string
          sort_order?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "quiz_categories_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "quiz_categories_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "quiz_categories_quiz_id_fkey"
            columns: ["quiz_id"]
            isOneToOne: false
            referencedRelation: "quizzes"
            referencedColumns: ["id"]
          },
        ]
      }
      quiz_questions: {
        Row: {
          category_id: string
          created_at: string
          id: string
          organization_id: string
          question_id: string
          question_order: number
          quiz_id: string
        }
        Insert: {
          category_id: string
          created_at?: string
          id?: string
          organization_id: string
          question_id: string
          question_order?: number
          quiz_id: string
        }
        Update: {
          category_id?: string
          created_at?: string
          id?: string
          organization_id?: string
          question_id?: string
          question_order?: number
          quiz_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "quiz_questions_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "quiz_questions_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "quiz_questions_question_id_fkey"
            columns: ["question_id"]
            isOneToOne: false
            referencedRelation: "questions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "quiz_questions_quiz_id_fkey"
            columns: ["quiz_id"]
            isOneToOne: false
            referencedRelation: "quizzes"
            referencedColumns: ["id"]
          },
        ]
      }
      quiz_teams: {
        Row: {
          alias: string | null
          created_at: string
          id: string
          organization_id: string
          quiz_id: string
          rank: number | null
          team_id: string
          total_points: number | null
        }
        Insert: {
          alias?: string | null
          created_at?: string
          id?: string
          organization_id: string
          quiz_id: string
          rank?: number | null
          team_id: string
          total_points?: number | null
        }
        Update: {
          alias?: string | null
          created_at?: string
          id?: string
          organization_id?: string
          quiz_id?: string
          rank?: number | null
          team_id?: string
          total_points?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "quiz_teams_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "quiz_teams_quiz_id_fkey"
            columns: ["quiz_id"]
            isOneToOne: false
            referencedRelation: "quizzes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "quiz_teams_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
        ]
      }
      quizzes: {
        Row: {
          code: string | null
          created_at: string
          created_by: string | null
          date: string
          id: string
          league_id: string | null
          location: string | null
          name: string
          org_location_id: string | null
          organization_id: string
          override_categories_count: number | null
          override_questions_per_category: number | null
          share_token: string | null
          status: Database["public"]["Enums"]["quiz_status"]
          updated_at: string
        }
        Insert: {
          code?: string | null
          created_at?: string
          created_by?: string | null
          date?: string
          id?: string
          league_id?: string | null
          location?: string | null
          name: string
          org_location_id?: string | null
          organization_id: string
          override_categories_count?: number | null
          override_questions_per_category?: number | null
          share_token?: string | null
          status?: Database["public"]["Enums"]["quiz_status"]
          updated_at?: string
        }
        Update: {
          code?: string | null
          created_at?: string
          created_by?: string | null
          date?: string
          id?: string
          league_id?: string | null
          location?: string | null
          name?: string
          org_location_id?: string | null
          organization_id?: string
          override_categories_count?: number | null
          override_questions_per_category?: number | null
          share_token?: string | null
          status?: Database["public"]["Enums"]["quiz_status"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "quizzes_league_id_fkey"
            columns: ["league_id"]
            isOneToOne: false
            referencedRelation: "leagues"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "quizzes_org_location_id_fkey"
            columns: ["org_location_id"]
            isOneToOne: false
            referencedRelation: "org_locations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "quizzes_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      scores: {
        Row: {
          bonus_points: number
          created_at: string
          id: string
          is_locked: boolean
          notes: string | null
          organization_id: string
          points: number
          quiz_category_id: string
          quiz_id: string
          quiz_team_id: string
          updated_at: string
        }
        Insert: {
          bonus_points?: number
          created_at?: string
          id?: string
          is_locked?: boolean
          notes?: string | null
          organization_id: string
          points?: number
          quiz_category_id: string
          quiz_id: string
          quiz_team_id: string
          updated_at?: string
        }
        Update: {
          bonus_points?: number
          created_at?: string
          id?: string
          is_locked?: boolean
          notes?: string | null
          organization_id?: string
          points?: number
          quiz_category_id?: string
          quiz_id?: string
          quiz_team_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "scores_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "scores_quiz_category_id_fkey"
            columns: ["quiz_category_id"]
            isOneToOne: false
            referencedRelation: "quiz_categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "scores_quiz_id_fkey"
            columns: ["quiz_id"]
            isOneToOne: false
            referencedRelation: "quizzes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "scores_quiz_team_id_fkey"
            columns: ["quiz_team_id"]
            isOneToOne: false
            referencedRelation: "quiz_teams"
            referencedColumns: ["id"]
          },
        ]
      }
      suppressed_emails: {
        Row: {
          created_at: string
          email: string
          id: string
          metadata: Json | null
          reason: string
        }
        Insert: {
          created_at?: string
          email: string
          id?: string
          metadata?: Json | null
          reason: string
        }
        Update: {
          created_at?: string
          email?: string
          id?: string
          metadata?: Json | null
          reason?: string
        }
        Relationships: []
      }
      team_aliases: {
        Row: {
          alias: string
          created_at: string
          id: string
          organization_id: string
          team_id: string
        }
        Insert: {
          alias: string
          created_at?: string
          id?: string
          organization_id: string
          team_id: string
        }
        Update: {
          alias?: string
          created_at?: string
          id?: string
          organization_id?: string
          team_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "team_aliases_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "team_aliases_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
        ]
      }
      teams: {
        Row: {
          created_at: string
          id: string
          is_deleted: boolean
          name: string
          organization_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          is_deleted?: boolean
          name: string
          organization_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          is_deleted?: boolean
          name?: string
          organization_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "teams_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      webhook_events: {
        Row: {
          event_id: string
          event_type: string
          id: string
          payload: Json | null
          processed_at: string
        }
        Insert: {
          event_id: string
          event_type: string
          id?: string
          payload?: Json | null
          processed_at?: string
        }
        Update: {
          event_id?: string
          event_type?: string
          id?: string
          payload?: Json | null
          processed_at?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      can_use_pro_features: { Args: { _org_id: string }; Returns: boolean }
      delete_email: {
        Args: { message_id: number; queue_name: string }
        Returns: boolean
      }
      enqueue_email: {
        Args: { payload: Json; queue_name: string }
        Returns: number
      }
      get_user_org_role: {
        Args: { _org_id: string; _user_id: string }
        Returns: Database["public"]["Enums"]["org_role"]
      }
      is_org_admin_or_owner: {
        Args: { _org_id: string; _user_id: string }
        Returns: boolean
      }
      is_org_member: {
        Args: { _org_id: string; _user_id: string }
        Returns: boolean
      }
      is_org_owner: {
        Args: { _org_id: string; _user_id: string }
        Returns: boolean
      }
      move_to_dlq: {
        Args: {
          dlq_name: string
          message_id: number
          payload: Json
          source_queue: string
        }
        Returns: number
      }
      next_question_id: { Args: never; Returns: number }
      read_email_batch: {
        Args: { batch_size: number; queue_name: string; vt: number }
        Returns: {
          message: Json
          msg_id: number
          read_ct: number
        }[]
      }
    }
    Enums: {
      media_role: "supplementary" | "key"
      media_type: "image" | "video" | "audio"
      org_role: "owner" | "admin" | "user"
      question_type: "text" | "multiple_choice" | "matching"
      quiz_status: "draft" | "live" | "finished"
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
      media_role: ["supplementary", "key"],
      media_type: ["image", "video", "audio"],
      org_role: ["owner", "admin", "user"],
      question_type: ["text", "multiple_choice", "matching"],
      quiz_status: ["draft", "live", "finished"],
    },
  },
} as const
