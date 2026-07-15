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
    PostgrestVersion: "14.4"
  }
  public: {
    Tables: {
      appointments: {
        Row: {
          appointment_date: string
          appointment_time: string
          client_name: string
          client_phone: string
          created_at: string
          id: string
          service: Database["public"]["Enums"]["service_type"]
        }
        Insert: {
          appointment_date: string
          appointment_time: string
          client_name: string
          client_phone: string
          created_at?: string
          id?: string
          service: Database["public"]["Enums"]["service_type"]
        }
        Update: {
          appointment_date?: string
          appointment_time?: string
          client_name?: string
          client_phone?: string
          created_at?: string
          id?: string
          service?: Database["public"]["Enums"]["service_type"]
        }
        Relationships: []
      }
      booking_appointments: {
        Row: {
          appointment_date: string
          business_id: string
          checkin_at: string | null
          checkout_at: string | null
          client_id: string | null
          created_at: string
          end_time: string
          id: string
          notes: string | null
          professional_id: string
          professional_notes: string | null
          recurrence_parent_id: string | null
          recurrence_type: string | null
          service_id: string
          start_time: string
          status: Database["public"]["Enums"]["appointment_status"]
          unit_id: string | null
          updated_at: string
        }
        Insert: {
          appointment_date: string
          business_id: string
          checkin_at?: string | null
          checkout_at?: string | null
          client_id?: string | null
          created_at?: string
          end_time: string
          id?: string
          notes?: string | null
          professional_id: string
          professional_notes?: string | null
          recurrence_parent_id?: string | null
          recurrence_type?: string | null
          service_id: string
          start_time: string
          status?: Database["public"]["Enums"]["appointment_status"]
          unit_id?: string | null
          updated_at?: string
        }
        Update: {
          appointment_date?: string
          business_id?: string
          checkin_at?: string | null
          checkout_at?: string | null
          client_id?: string | null
          created_at?: string
          end_time?: string
          id?: string
          notes?: string | null
          professional_id?: string
          professional_notes?: string | null
          recurrence_parent_id?: string | null
          recurrence_type?: string | null
          service_id?: string
          start_time?: string
          status?: Database["public"]["Enums"]["appointment_status"]
          unit_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "booking_appointments_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "businesses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "booking_appointments_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "booking_appointments_professional_id_fkey"
            columns: ["professional_id"]
            isOneToOne: false
            referencedRelation: "professionals"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "booking_appointments_recurrence_parent_id_fkey"
            columns: ["recurrence_parent_id"]
            isOneToOne: false
            referencedRelation: "booking_appointments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "booking_appointments_service_id_fkey"
            columns: ["service_id"]
            isOneToOne: false
            referencedRelation: "services"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "booking_appointments_unit_id_fkey"
            columns: ["unit_id"]
            isOneToOne: false
            referencedRelation: "units"
            referencedColumns: ["id"]
          },
        ]
      }
      businesses: {
        Row: {
          accent_color: string | null
          background_color: string | null
          border_radius: string | null
          cover_image_url: string | null
          created_at: string
          cta_text: string | null
          custom_css: string | null
          description: string | null
          domain: string | null
          email: string | null
          font_body: string | null
          font_heading: string | null
          footer_text: string | null
          hero_image_url: string | null
          hero_subtitle: string | null
          hero_title: string | null
          id: string
          layout_style: string | null
          logo_url: string | null
          name: string
          owner_id: string | null
          phone: string | null
          primary_color: string | null
          secondary_color: string | null
          show_services_section: boolean | null
          show_stats_section: boolean | null
          show_team_section: boolean | null
          slug: string
          social_facebook: string | null
          social_instagram: string | null
          social_whatsapp: string | null
          stats_data: Json | null
          text_color: string | null
          updated_at: string
          welcome_message: string | null
        }
        Insert: {
          accent_color?: string | null
          background_color?: string | null
          border_radius?: string | null
          cover_image_url?: string | null
          created_at?: string
          cta_text?: string | null
          custom_css?: string | null
          description?: string | null
          domain?: string | null
          email?: string | null
          font_body?: string | null
          font_heading?: string | null
          footer_text?: string | null
          hero_image_url?: string | null
          hero_subtitle?: string | null
          hero_title?: string | null
          id?: string
          layout_style?: string | null
          logo_url?: string | null
          name: string
          owner_id?: string | null
          phone?: string | null
          primary_color?: string | null
          secondary_color?: string | null
          show_services_section?: boolean | null
          show_stats_section?: boolean | null
          show_team_section?: boolean | null
          slug: string
          social_facebook?: string | null
          social_instagram?: string | null
          social_whatsapp?: string | null
          stats_data?: Json | null
          text_color?: string | null
          updated_at?: string
          welcome_message?: string | null
        }
        Update: {
          accent_color?: string | null
          background_color?: string | null
          border_radius?: string | null
          cover_image_url?: string | null
          created_at?: string
          cta_text?: string | null
          custom_css?: string | null
          description?: string | null
          domain?: string | null
          email?: string | null
          font_body?: string | null
          font_heading?: string | null
          footer_text?: string | null
          hero_image_url?: string | null
          hero_subtitle?: string | null
          hero_title?: string | null
          id?: string
          layout_style?: string | null
          logo_url?: string | null
          name?: string
          owner_id?: string | null
          phone?: string | null
          primary_color?: string | null
          secondary_color?: string | null
          show_services_section?: boolean | null
          show_stats_section?: boolean | null
          show_team_section?: boolean | null
          slug?: string
          social_facebook?: string | null
          social_instagram?: string | null
          social_whatsapp?: string | null
          stats_data?: Json | null
          text_color?: string | null
          updated_at?: string
          welcome_message?: string | null
        }
        Relationships: []
      }
      client_style_history: {
        Row: {
          appointment_id: string | null
          business_id: string
          client_id: string
          created_at: string
          id: string
          image_url: string
          notes: string | null
        }
        Insert: {
          appointment_id?: string | null
          business_id: string
          client_id: string
          created_at?: string
          id?: string
          image_url: string
          notes?: string | null
        }
        Update: {
          appointment_id?: string | null
          business_id?: string
          client_id?: string
          created_at?: string
          id?: string
          image_url?: string
          notes?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "client_style_history_appointment_id_fkey"
            columns: ["appointment_id"]
            isOneToOne: false
            referencedRelation: "booking_appointments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "client_style_history_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "businesses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "client_style_history_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
        ]
      }
      clients: {
        Row: {
          avatar_url: string | null
          business_id: string
          created_at: string
          email: string | null
          id: string
          name: string
          notes: string | null
          phone: string | null
          preferences: Json | null
          user_id: string | null
        }
        Insert: {
          avatar_url?: string | null
          business_id: string
          created_at?: string
          email?: string | null
          id?: string
          name: string
          notes?: string | null
          phone?: string | null
          preferences?: Json | null
          user_id?: string | null
        }
        Update: {
          avatar_url?: string | null
          business_id?: string
          created_at?: string
          email?: string | null
          id?: string
          name?: string
          notes?: string | null
          phone?: string | null
          preferences?: Json | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "clients_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "businesses"
            referencedColumns: ["id"]
          },
        ]
      }
      fixed_client_slots: {
        Row: {
          business_id: string
          client_id: string | null
          client_name: string | null
          created_at: string
          day_of_week: Database["public"]["Enums"]["day_of_week"]
          end_time: string
          id: string
          is_active: boolean
          notes: string | null
          professional_id: string
          service_id: string | null
          start_time: string
        }
        Insert: {
          business_id: string
          client_id?: string | null
          client_name?: string | null
          created_at?: string
          day_of_week: Database["public"]["Enums"]["day_of_week"]
          end_time: string
          id?: string
          is_active?: boolean
          notes?: string | null
          professional_id: string
          service_id?: string | null
          start_time: string
        }
        Update: {
          business_id?: string
          client_id?: string | null
          client_name?: string | null
          created_at?: string
          day_of_week?: Database["public"]["Enums"]["day_of_week"]
          end_time?: string
          id?: string
          is_active?: boolean
          notes?: string | null
          professional_id?: string
          service_id?: string | null
          start_time?: string
        }
        Relationships: [
          {
            foreignKeyName: "fixed_client_slots_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "businesses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fixed_client_slots_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fixed_client_slots_professional_id_fkey"
            columns: ["professional_id"]
            isOneToOne: false
            referencedRelation: "professionals"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fixed_client_slots_service_id_fkey"
            columns: ["service_id"]
            isOneToOne: false
            referencedRelation: "services"
            referencedColumns: ["id"]
          },
        ]
      }
      loyalty_config: {
        Row: {
          business_id: string
          created_at: string
          currency_name: string
          id: string
          is_active: boolean
          points_per_appointment: number
          reward_description: string | null
          reward_threshold: number
        }
        Insert: {
          business_id: string
          created_at?: string
          currency_name?: string
          id?: string
          is_active?: boolean
          points_per_appointment?: number
          reward_description?: string | null
          reward_threshold?: number
        }
        Update: {
          business_id?: string
          created_at?: string
          currency_name?: string
          id?: string
          is_active?: boolean
          points_per_appointment?: number
          reward_description?: string | null
          reward_threshold?: number
        }
        Relationships: [
          {
            foreignKeyName: "loyalty_config_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: true
            referencedRelation: "businesses"
            referencedColumns: ["id"]
          },
        ]
      }
      loyalty_points: {
        Row: {
          balance: number
          business_id: string
          client_id: string
          created_at: string
          currency_name: string
          id: string
          total_earned: number
          updated_at: string
        }
        Insert: {
          balance?: number
          business_id: string
          client_id: string
          created_at?: string
          currency_name?: string
          id?: string
          total_earned?: number
          updated_at?: string
        }
        Update: {
          balance?: number
          business_id?: string
          client_id?: string
          created_at?: string
          currency_name?: string
          id?: string
          total_earned?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "loyalty_points_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "businesses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "loyalty_points_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
        ]
      }
      loyalty_rewards: {
        Row: {
          business_id: string
          created_at: string
          current_redemptions: number
          description: string | null
          id: string
          is_active: boolean
          max_redemptions: number
          name: string
          points_required: number
        }
        Insert: {
          business_id: string
          created_at?: string
          current_redemptions?: number
          description?: string | null
          id?: string
          is_active?: boolean
          max_redemptions?: number
          name: string
          points_required?: number
        }
        Update: {
          business_id?: string
          created_at?: string
          current_redemptions?: number
          description?: string | null
          id?: string
          is_active?: boolean
          max_redemptions?: number
          name?: string
          points_required?: number
        }
        Relationships: [
          {
            foreignKeyName: "loyalty_rewards_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "businesses"
            referencedColumns: ["id"]
          },
        ]
      }
      loyalty_transactions: {
        Row: {
          amount: number
          created_at: string
          description: string | null
          id: string
          loyalty_id: string
          type: string
        }
        Insert: {
          amount: number
          created_at?: string
          description?: string | null
          id?: string
          loyalty_id: string
          type?: string
        }
        Update: {
          amount?: number
          created_at?: string
          description?: string | null
          id?: string
          loyalty_id?: string
          type?: string
        }
        Relationships: [
          {
            foreignKeyName: "loyalty_transactions_loyalty_id_fkey"
            columns: ["loyalty_id"]
            isOneToOne: false
            referencedRelation: "loyalty_points"
            referencedColumns: ["id"]
          },
        ]
      }
      notifications: {
        Row: {
          appointment_id: string | null
          body: string | null
          business_id: string
          channel: string
          client_id: string | null
          created_at: string
          error_message: string | null
          id: string
          metadata: Json | null
          recipient_email: string | null
          recipient_phone: string | null
          scheduled_for: string | null
          sent_at: string | null
          status: string
          title: string
          type: string
          updated_at: string
        }
        Insert: {
          appointment_id?: string | null
          body?: string | null
          business_id: string
          channel?: string
          client_id?: string | null
          created_at?: string
          error_message?: string | null
          id?: string
          metadata?: Json | null
          recipient_email?: string | null
          recipient_phone?: string | null
          scheduled_for?: string | null
          sent_at?: string | null
          status?: string
          title: string
          type?: string
          updated_at?: string
        }
        Update: {
          appointment_id?: string | null
          body?: string | null
          business_id?: string
          channel?: string
          client_id?: string | null
          created_at?: string
          error_message?: string | null
          id?: string
          metadata?: Json | null
          recipient_email?: string | null
          recipient_phone?: string | null
          scheduled_for?: string | null
          sent_at?: string | null
          status?: string
          title?: string
          type?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "notifications_appointment_id_fkey"
            columns: ["appointment_id"]
            isOneToOne: false
            referencedRelation: "booking_appointments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "notifications_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "businesses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "notifications_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
        ]
      }
      professional_services: {
        Row: {
          professional_id: string
          service_id: string
        }
        Insert: {
          professional_id: string
          service_id: string
        }
        Update: {
          professional_id?: string
          service_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "professional_services_professional_id_fkey"
            columns: ["professional_id"]
            isOneToOne: false
            referencedRelation: "professionals"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "professional_services_service_id_fkey"
            columns: ["service_id"]
            isOneToOne: false
            referencedRelation: "services"
            referencedColumns: ["id"]
          },
        ]
      }
      professionals: {
        Row: {
          avatar_url: string | null
          business_id: string
          created_at: string
          id: string
          is_active: boolean
          name: string
          specialty: string | null
          unit_id: string | null
          user_id: string | null
        }
        Insert: {
          avatar_url?: string | null
          business_id: string
          created_at?: string
          id?: string
          is_active?: boolean
          name: string
          specialty?: string | null
          unit_id?: string | null
          user_id?: string | null
        }
        Update: {
          avatar_url?: string | null
          business_id?: string
          created_at?: string
          id?: string
          is_active?: boolean
          name?: string
          specialty?: string | null
          unit_id?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "professionals_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "businesses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "professionals_unit_id_fkey"
            columns: ["unit_id"]
            isOneToOne: false
            referencedRelation: "units"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          avatar_url: string | null
          business_id: string | null
          created_at: string
          full_name: string | null
          id: string
          phone: string | null
          role: string
          updated_at: string
        }
        Insert: {
          avatar_url?: string | null
          business_id?: string | null
          created_at?: string
          full_name?: string | null
          id: string
          phone?: string | null
          role?: string
          updated_at?: string
        }
        Update: {
          avatar_url?: string | null
          business_id?: string | null
          created_at?: string
          full_name?: string | null
          id?: string
          phone?: string | null
          role?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "profiles_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "businesses"
            referencedColumns: ["id"]
          },
        ]
      }
      reviews: {
        Row: {
          appointment_id: string | null
          business_id: string
          client_id: string | null
          comment: string | null
          created_at: string
          id: string
          rating: number
        }
        Insert: {
          appointment_id?: string | null
          business_id: string
          client_id?: string | null
          comment?: string | null
          created_at?: string
          id?: string
          rating: number
        }
        Update: {
          appointment_id?: string | null
          business_id?: string
          client_id?: string | null
          comment?: string | null
          created_at?: string
          id?: string
          rating?: number
        }
        Relationships: [
          {
            foreignKeyName: "reviews_appointment_id_fkey"
            columns: ["appointment_id"]
            isOneToOne: false
            referencedRelation: "booking_appointments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reviews_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "businesses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reviews_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
        ]
      }
      reward_redemptions: {
        Row: {
          business_id: string
          client_id: string
          code: string
          created_at: string
          id: string
          is_used: boolean
          points_spent: number
          reward_id: string
          used_at: string | null
        }
        Insert: {
          business_id: string
          client_id: string
          code: string
          created_at?: string
          id?: string
          is_used?: boolean
          points_spent: number
          reward_id: string
          used_at?: string | null
        }
        Update: {
          business_id?: string
          client_id?: string
          code?: string
          created_at?: string
          id?: string
          is_used?: boolean
          points_spent?: number
          reward_id?: string
          used_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "reward_redemptions_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "businesses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reward_redemptions_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reward_redemptions_reward_id_fkey"
            columns: ["reward_id"]
            isOneToOne: false
            referencedRelation: "loyalty_rewards"
            referencedColumns: ["id"]
          },
        ]
      }
      services: {
        Row: {
          business_id: string
          created_at: string
          description: string | null
          duration_minutes: number
          id: string
          image_url: string | null
          is_active: boolean
          name: string
          price: number
        }
        Insert: {
          business_id: string
          created_at?: string
          description?: string | null
          duration_minutes?: number
          id?: string
          image_url?: string | null
          is_active?: boolean
          name: string
          price?: number
        }
        Update: {
          business_id?: string
          created_at?: string
          description?: string | null
          duration_minutes?: number
          id?: string
          image_url?: string | null
          is_active?: boolean
          name?: string
          price?: number
        }
        Relationships: [
          {
            foreignKeyName: "services_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "businesses"
            referencedColumns: ["id"]
          },
        ]
      }
      style_gallery: {
        Row: {
          business_id: string
          category: string
          created_at: string
          description: string | null
          id: string
          image_url: string
          is_active: boolean
          tags: string[] | null
          title: string
        }
        Insert: {
          business_id: string
          category?: string
          created_at?: string
          description?: string | null
          id?: string
          image_url: string
          is_active?: boolean
          tags?: string[] | null
          title: string
        }
        Update: {
          business_id?: string
          category?: string
          created_at?: string
          description?: string | null
          id?: string
          image_url?: string
          is_active?: boolean
          tags?: string[] | null
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: "style_gallery_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "businesses"
            referencedColumns: ["id"]
          },
        ]
      }
      subscriptions: {
        Row: {
          business_id: string
          client_id: string
          created_at: string
          end_date: string | null
          id: string
          plan_name: string
          price: number
          start_date: string
          status: string
          updated_at: string
        }
        Insert: {
          business_id: string
          client_id: string
          created_at?: string
          end_date?: string | null
          id?: string
          plan_name: string
          price?: number
          start_date?: string
          status?: string
          updated_at?: string
        }
        Update: {
          business_id?: string
          client_id?: string
          created_at?: string
          end_date?: string | null
          id?: string
          plan_name?: string
          price?: number
          start_date?: string
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "subscriptions_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "businesses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "subscriptions_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
        ]
      }
      units: {
        Row: {
          address: string | null
          business_id: string
          city: string | null
          created_at: string
          id: string
          is_active: boolean
          name: string
          phone: string | null
          state: string | null
          zip_code: string | null
        }
        Insert: {
          address?: string | null
          business_id: string
          city?: string | null
          created_at?: string
          id?: string
          is_active?: boolean
          name: string
          phone?: string | null
          state?: string | null
          zip_code?: string | null
        }
        Update: {
          address?: string | null
          business_id?: string
          city?: string | null
          created_at?: string
          id?: string
          is_active?: boolean
          name?: string
          phone?: string | null
          state?: string | null
          zip_code?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "units_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "businesses"
            referencedColumns: ["id"]
          },
        ]
      }
      user_roles: {
        Row: {
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
      working_hours: {
        Row: {
          day_of_week: Database["public"]["Enums"]["day_of_week"]
          end_time: string
          id: string
          professional_id: string
          start_time: string
        }
        Insert: {
          day_of_week: Database["public"]["Enums"]["day_of_week"]
          end_time: string
          id?: string
          professional_id: string
          start_time: string
        }
        Update: {
          day_of_week?: Database["public"]["Enums"]["day_of_week"]
          end_time?: string
          id?: string
          professional_id?: string
          start_time?: string
        }
        Relationships: [
          {
            foreignKeyName: "working_hours_professional_id_fkey"
            columns: ["professional_id"]
            isOneToOne: false
            referencedRelation: "professionals"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
    }
    Enums: {
      app_role: "admin" | "client"
      appointment_status:
        | "scheduled"
        | "confirmed"
        | "in_progress"
        | "completed"
        | "cancelled"
        | "no_show"
      day_of_week:
        | "monday"
        | "tuesday"
        | "wednesday"
        | "thursday"
        | "friday"
        | "saturday"
        | "sunday"
      service_type: "cabelo" | "barba" | "sobrancelha"
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
      app_role: ["admin", "client"],
      appointment_status: [
        "scheduled",
        "confirmed",
        "in_progress",
        "completed",
        "cancelled",
        "no_show",
      ],
      day_of_week: [
        "monday",
        "tuesday",
        "wednesday",
        "thursday",
        "friday",
        "saturday",
        "sunday",
      ],
      service_type: ["cabelo", "barba", "sobrancelha"],
    },
  },
} as const
