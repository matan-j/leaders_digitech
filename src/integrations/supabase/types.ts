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
    PostgrestVersion: "12.2.3 (519615d)"
  }
  public: {
    Tables: {
      academic_year_order_audit: {
        Row: {
          action: string
          created_at: string
          group_id: string | null
          id: string
          new_value: Json | null
          old_value: Json | null
          order_id: string
          user_id: string | null
        }
        Insert: {
          action: string
          created_at?: string
          group_id?: string | null
          id?: string
          new_value?: Json | null
          old_value?: Json | null
          order_id: string
          user_id?: string | null
        }
        Update: {
          action?: string
          created_at?: string
          group_id?: string | null
          id?: string
          new_value?: Json | null
          old_value?: Json | null
          order_id?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "academic_year_order_audit_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "academic_year_order_groups"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "academic_year_order_audit_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "academic_year_orders"
            referencedColumns: ["id"]
          },
        ]
      }
      academic_year_order_group_instances: {
        Row: {
          course_instance_id: string
          created_at: string
          created_by: string | null
          group_id: string
          id: string
          notes: string | null
        }
        Insert: {
          course_instance_id: string
          created_at?: string
          created_by?: string | null
          group_id: string
          id?: string
          notes?: string | null
        }
        Update: {
          course_instance_id?: string
          created_at?: string
          created_by?: string | null
          group_id?: string
          id?: string
          notes?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "academic_year_order_group_instances_course_instance_id_fkey"
            columns: ["course_instance_id"]
            isOneToOne: false
            referencedRelation: "course_instances"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "academic_year_order_group_instances_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "academic_year_order_groups"
            referencedColumns: ["id"]
          },
        ]
      }
      academic_year_order_groups: {
        Row: {
          age_group: string | null
          course_id: string | null
          created_at: string
          grade_label: string | null
          groups_count: number
          hours_per_meeting: number | null
          id: string
          meetings_count: number | null
          notes: string | null
          order_id: string
          requested_days_of_week: number[] | null
          requested_time_window: Json | null
          scheduling_status: string
          sort_order: number
          updated_at: string
        }
        Insert: {
          age_group?: string | null
          course_id?: string | null
          created_at?: string
          grade_label?: string | null
          groups_count?: number
          hours_per_meeting?: number | null
          id?: string
          meetings_count?: number | null
          notes?: string | null
          order_id: string
          requested_days_of_week?: number[] | null
          requested_time_window?: Json | null
          scheduling_status?: string
          sort_order?: number
          updated_at?: string
        }
        Update: {
          age_group?: string | null
          course_id?: string | null
          created_at?: string
          grade_label?: string | null
          groups_count?: number
          hours_per_meeting?: number | null
          id?: string
          meetings_count?: number | null
          notes?: string | null
          order_id?: string
          requested_days_of_week?: number[] | null
          requested_time_window?: Json | null
          scheduling_status?: string
          sort_order?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "academic_year_order_groups_course_id_fkey"
            columns: ["course_id"]
            isOneToOne: false
            referencedRelation: "courses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "academic_year_order_groups_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "academic_year_orders"
            referencedColumns: ["id"]
          },
        ]
      }
      academic_year_orders: {
        Row: {
          academic_year: string
          city: string | null
          created_at: string
          created_by: string | null
          groups_count_planned: number | null
          hours_per_meeting: number | null
          id: string
          institution_id: string
          notes: string | null
          preferred_instructor_id: string | null
          region: string | null
          requested_end_date: string | null
          requested_start_date: string | null
          scheduling_status: string
          source_opportunity_id: string | null
          source_quote_id: string | null
          status: string
          total_meetings_planned: number | null
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          academic_year: string
          city?: string | null
          created_at?: string
          created_by?: string | null
          groups_count_planned?: number | null
          hours_per_meeting?: number | null
          id?: string
          institution_id: string
          notes?: string | null
          preferred_instructor_id?: string | null
          region?: string | null
          requested_end_date?: string | null
          requested_start_date?: string | null
          scheduling_status?: string
          source_opportunity_id?: string | null
          source_quote_id?: string | null
          status?: string
          total_meetings_planned?: number | null
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          academic_year?: string
          city?: string | null
          created_at?: string
          created_by?: string | null
          groups_count_planned?: number | null
          hours_per_meeting?: number | null
          id?: string
          institution_id?: string
          notes?: string | null
          preferred_instructor_id?: string | null
          region?: string | null
          requested_end_date?: string | null
          requested_start_date?: string | null
          scheduling_status?: string
          source_opportunity_id?: string | null
          source_quote_id?: string | null
          status?: string
          total_meetings_planned?: number | null
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "academic_year_orders_institution_id_fkey"
            columns: ["institution_id"]
            isOneToOne: false
            referencedRelation: "educational_institutions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "academic_year_orders_preferred_instructor_id_fkey"
            columns: ["preferred_instructor_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "academic_year_orders_preferred_instructor_id_fkey"
            columns: ["preferred_instructor_id"]
            isOneToOne: false
            referencedRelation: "profiles_public"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "academic_year_orders_source_opportunity_id_fkey"
            columns: ["source_opportunity_id"]
            isOneToOne: false
            referencedRelation: "crm_opportunities"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "academic_year_orders_source_quote_id_fkey"
            columns: ["source_quote_id"]
            isOneToOne: false
            referencedRelation: "quotes"
            referencedColumns: ["id"]
          },
        ]
      }
      blocked_dates: {
        Row: {
          created_at: string | null
          created_by: string | null
          date: string | null
          end_date: string | null
          id: string
          reason: string | null
          start_date: string | null
        }
        Insert: {
          created_at?: string | null
          created_by?: string | null
          date?: string | null
          end_date?: string | null
          id?: string
          reason?: string | null
          start_date?: string | null
        }
        Update: {
          created_at?: string | null
          created_by?: string | null
          date?: string | null
          end_date?: string | null
          id?: string
          reason?: string | null
          start_date?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "blocked_dates_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "blocked_dates_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles_public"
            referencedColumns: ["id"]
          },
        ]
      }
      course_instance_schedules: {
        Row: {
          course_instance_id: string | null
          created_at: string | null
          days_of_week: number[]
          id: string
          lesson_duration_minutes: number | null
          time_slots: Json
          total_lessons: number | null
          updated_at: string | null
        }
        Insert: {
          course_instance_id?: string | null
          created_at?: string | null
          days_of_week: number[]
          id?: string
          lesson_duration_minutes?: number | null
          time_slots: Json
          total_lessons?: number | null
          updated_at?: string | null
        }
        Update: {
          course_instance_id?: string | null
          created_at?: string | null
          days_of_week?: number[]
          id?: string
          lesson_duration_minutes?: number | null
          time_slots?: Json
          total_lessons?: number | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "course_instance_schedules_course_instance_id_fkey"
            columns: ["course_instance_id"]
            isOneToOne: true
            referencedRelation: "course_instances"
            referencedColumns: ["id"]
          },
        ]
      }
      course_instances: {
        Row: {
          course_id: string | null
          created_at: string | null
          days_of_week: number[] | null
          end_date: string | null
          grade_level: string | null
          id: string
          institution_id: string | null
          instructor_id: string | null
          is_double_lesson: boolean | null
          is_visible: boolean | null
          lesson_mode: string | null
          max_participants: number | null
          price_for_customer: number | null
          price_for_instructor: number | null
          schedule_pattern: Json | null
          start_date: string | null
        }
        Insert: {
          course_id?: string | null
          created_at?: string | null
          days_of_week?: number[] | null
          end_date?: string | null
          grade_level?: string | null
          id?: string
          institution_id?: string | null
          instructor_id?: string | null
          is_double_lesson?: boolean | null
          is_visible?: boolean | null
          lesson_mode?: string | null
          max_participants?: number | null
          price_for_customer?: number | null
          price_for_instructor?: number | null
          schedule_pattern?: Json | null
          start_date?: string | null
        }
        Update: {
          course_id?: string | null
          created_at?: string | null
          days_of_week?: number[] | null
          end_date?: string | null
          grade_level?: string | null
          id?: string
          institution_id?: string | null
          instructor_id?: string | null
          is_double_lesson?: boolean | null
          is_visible?: boolean | null
          lesson_mode?: string | null
          max_participants?: number | null
          price_for_customer?: number | null
          price_for_instructor?: number | null
          schedule_pattern?: Json | null
          start_date?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "course_instances_course_id_fkey"
            columns: ["course_id"]
            isOneToOne: false
            referencedRelation: "courses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "course_instances_institution_id_fkey"
            columns: ["institution_id"]
            isOneToOne: false
            referencedRelation: "educational_institutions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "course_instances_instructor_id_fkey"
            columns: ["instructor_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "course_instances_instructor_id_fkey"
            columns: ["instructor_id"]
            isOneToOne: false
            referencedRelation: "profiles_public"
            referencedColumns: ["id"]
          },
        ]
      }
      courses: {
        Row: {
          color: string | null
          created_at: string | null
          id: string
          is_visible: boolean | null
          name: string
          presentation_link: string | null
          program_link: string | null
          school_type: string | null
        }
        Insert: {
          color?: string | null
          created_at?: string | null
          id?: string
          is_visible?: boolean | null
          name: string
          presentation_link?: string | null
          program_link?: string | null
          school_type?: string | null
        }
        Update: {
          color?: string | null
          created_at?: string | null
          id?: string
          is_visible?: boolean | null
          name?: string
          presentation_link?: string | null
          program_link?: string | null
          school_type?: string | null
        }
        Relationships: []
      }
      crm_activities: {
        Row: {
          contact_id: string | null
          created_at: string
          id: string
          institution_id: string
          next_step: string | null
          next_step_date: string | null
          occurred_at: string
          opportunity_id: string | null
          outcome: string | null
          status: string
          summary: string | null
          type: string
          user_id: string
        }
        Insert: {
          contact_id?: string | null
          created_at?: string
          id?: string
          institution_id: string
          next_step?: string | null
          next_step_date?: string | null
          occurred_at?: string
          opportunity_id?: string | null
          outcome?: string | null
          status?: string
          summary?: string | null
          type: string
          user_id: string
        }
        Update: {
          contact_id?: string | null
          created_at?: string
          id?: string
          institution_id?: string
          next_step?: string | null
          next_step_date?: string | null
          occurred_at?: string
          opportunity_id?: string | null
          outcome?: string | null
          status?: string
          summary?: string | null
          type?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "crm_activities_contact_id_fkey"
            columns: ["contact_id"]
            isOneToOne: false
            referencedRelation: "crm_contacts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "crm_activities_institution_id_fkey"
            columns: ["institution_id"]
            isOneToOne: false
            referencedRelation: "educational_institutions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "crm_activities_opportunity_id_fkey"
            columns: ["opportunity_id"]
            isOneToOne: false
            referencedRelation: "crm_opportunities"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "crm_activities_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "crm_activities_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles_public"
            referencedColumns: ["id"]
          },
        ]
      }
      crm_automation_rules: {
        Row: {
          channel: string
          created_at: string
          created_by: string | null
          delay_minutes: number
          id: string
          is_active: boolean
          template_id: string | null
          trigger_type: string
          trigger_value: string | null
          updated_at: string
        }
        Insert: {
          channel: string
          created_at?: string
          created_by?: string | null
          delay_minutes?: number
          id?: string
          is_active?: boolean
          template_id?: string | null
          trigger_type: string
          trigger_value?: string | null
          updated_at?: string
        }
        Update: {
          channel?: string
          created_at?: string
          created_by?: string | null
          delay_minutes?: number
          id?: string
          is_active?: boolean
          template_id?: string | null
          trigger_type?: string
          trigger_value?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "crm_automation_rules_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "crm_automation_rules_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles_public"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "crm_automation_rules_template_id_fkey"
            columns: ["template_id"]
            isOneToOne: false
            referencedRelation: "crm_message_templates"
            referencedColumns: ["id"]
          },
        ]
      }
      crm_broadcasts: {
        Row: {
          audience_filter: Json | null
          audience_type: string
          channel: string
          created_at: string
          created_by: string | null
          id: string
          name: string
          recipient_count: number | null
          sent_at: string | null
          status: string
          template_id: string | null
        }
        Insert: {
          audience_filter?: Json | null
          audience_type: string
          channel: string
          created_at?: string
          created_by?: string | null
          id?: string
          name: string
          recipient_count?: number | null
          sent_at?: string | null
          status?: string
          template_id?: string | null
        }
        Update: {
          audience_filter?: Json | null
          audience_type?: string
          channel?: string
          created_at?: string
          created_by?: string | null
          id?: string
          name?: string
          recipient_count?: number | null
          sent_at?: string | null
          status?: string
          template_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "crm_broadcasts_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "crm_broadcasts_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles_public"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "crm_broadcasts_template_id_fkey"
            columns: ["template_id"]
            isOneToOne: false
            referencedRelation: "crm_message_templates"
            referencedColumns: ["id"]
          },
        ]
      }
      crm_communications: {
        Row: {
          activity_id: string | null
          attachments: Json
          automation_rule_id: string | null
          body_html: string | null
          body_text: string
          broadcast_id: string | null
          channel: string
          contact_id: string | null
          created_at: string
          created_by: string | null
          direction: string
          id: string
          institution_id: string
          occurred_at: string
          provider: string | null
          provider_message_id: string | null
          provider_payload: Json
          provider_status: string | null
          provider_thread_id: string | null
          received_at: string | null
          recipient_address: string | null
          recipient_name: string | null
          sender_address: string | null
          sender_name: string | null
          sent_at: string | null
          status: string
          subject: string | null
          template_id: string | null
        }
        Insert: {
          activity_id?: string | null
          attachments?: Json
          automation_rule_id?: string | null
          body_html?: string | null
          body_text: string
          broadcast_id?: string | null
          channel: string
          contact_id?: string | null
          created_at?: string
          created_by?: string | null
          direction: string
          id?: string
          institution_id: string
          occurred_at?: string
          provider?: string | null
          provider_message_id?: string | null
          provider_payload?: Json
          provider_status?: string | null
          provider_thread_id?: string | null
          received_at?: string | null
          recipient_address?: string | null
          recipient_name?: string | null
          sender_address?: string | null
          sender_name?: string | null
          sent_at?: string | null
          status?: string
          subject?: string | null
          template_id?: string | null
        }
        Update: {
          activity_id?: string | null
          attachments?: Json
          automation_rule_id?: string | null
          body_html?: string | null
          body_text?: string
          broadcast_id?: string | null
          channel?: string
          contact_id?: string | null
          created_at?: string
          created_by?: string | null
          direction?: string
          id?: string
          institution_id?: string
          occurred_at?: string
          provider?: string | null
          provider_message_id?: string | null
          provider_payload?: Json
          provider_status?: string | null
          provider_thread_id?: string | null
          received_at?: string | null
          recipient_address?: string | null
          recipient_name?: string | null
          sender_address?: string | null
          sender_name?: string | null
          sent_at?: string | null
          status?: string
          subject?: string | null
          template_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "crm_communications_activity_id_fkey"
            columns: ["activity_id"]
            isOneToOne: false
            referencedRelation: "crm_activities"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "crm_communications_automation_rule_id_fkey"
            columns: ["automation_rule_id"]
            isOneToOne: false
            referencedRelation: "crm_automation_rules"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "crm_communications_broadcast_id_fkey"
            columns: ["broadcast_id"]
            isOneToOne: false
            referencedRelation: "crm_broadcasts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "crm_communications_contact_id_fkey"
            columns: ["contact_id"]
            isOneToOne: false
            referencedRelation: "crm_contacts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "crm_communications_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "crm_communications_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles_public"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "crm_communications_institution_id_fkey"
            columns: ["institution_id"]
            isOneToOne: false
            referencedRelation: "educational_institutions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "crm_communications_template_id_fkey"
            columns: ["template_id"]
            isOneToOne: false
            referencedRelation: "crm_message_templates"
            referencedColumns: ["id"]
          },
        ]
      }
      crm_contact_statuses: {
        Row: {
          color: string
          created_at: string
          id: string
          is_active: boolean
          is_default: boolean
          key: string
          label: string
          legacy_crm_risk: string | null
          order_index: number
          updated_at: string
        }
        Insert: {
          color?: string
          created_at?: string
          id?: string
          is_active?: boolean
          is_default?: boolean
          key: string
          label: string
          legacy_crm_risk?: string | null
          order_index?: number
          updated_at?: string
        }
        Update: {
          color?: string
          created_at?: string
          id?: string
          is_active?: boolean
          is_default?: boolean
          key?: string
          label?: string
          legacy_crm_risk?: string | null
          order_index?: number
          updated_at?: string
        }
        Relationships: []
      }
      crm_contacts: {
        Row: {
          contact_type: string | null
          created_at: string
          email: string | null
          id: string
          institution_id: string
          is_primary: boolean | null
          name: string
          notes: string | null
          phone: string | null
          role: string | null
          updated_at: string
        }
        Insert: {
          contact_type?: string | null
          created_at?: string
          email?: string | null
          id?: string
          institution_id: string
          is_primary?: boolean | null
          name: string
          notes?: string | null
          phone?: string | null
          role?: string | null
          updated_at?: string
        }
        Update: {
          contact_type?: string | null
          created_at?: string
          email?: string | null
          id?: string
          institution_id?: string
          is_primary?: boolean | null
          name?: string
          notes?: string | null
          phone?: string | null
          role?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "crm_contacts_institution_id_fkey"
            columns: ["institution_id"]
            isOneToOne: false
            referencedRelation: "educational_institutions"
            referencedColumns: ["id"]
          },
        ]
      }
      crm_followups: {
        Row: {
          assigned_to: string
          contact_id: string | null
          created_at: string
          due_date: string
          id: string
          institution_id: string
          next_step: string | null
          opportunity_id: string | null
          status: string
          task: string
        }
        Insert: {
          assigned_to: string
          contact_id?: string | null
          created_at?: string
          due_date: string
          id?: string
          institution_id: string
          next_step?: string | null
          opportunity_id?: string | null
          status?: string
          task: string
        }
        Update: {
          assigned_to?: string
          contact_id?: string | null
          created_at?: string
          due_date?: string
          id?: string
          institution_id?: string
          next_step?: string | null
          opportunity_id?: string | null
          status?: string
          task?: string
        }
        Relationships: [
          {
            foreignKeyName: "crm_followups_assigned_to_fkey"
            columns: ["assigned_to"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "crm_followups_assigned_to_fkey"
            columns: ["assigned_to"]
            isOneToOne: false
            referencedRelation: "profiles_public"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "crm_followups_contact_id_fkey"
            columns: ["contact_id"]
            isOneToOne: false
            referencedRelation: "crm_contacts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "crm_followups_institution_id_fkey"
            columns: ["institution_id"]
            isOneToOne: false
            referencedRelation: "educational_institutions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "crm_followups_opportunity_id_fkey"
            columns: ["opportunity_id"]
            isOneToOne: false
            referencedRelation: "crm_opportunities"
            referencedColumns: ["id"]
          },
        ]
      }
      crm_ghl_sync: {
        Row: {
          created_at: string
          error_message: string | null
          ghl_contact_id: string | null
          id: string
          institution_id: string
          last_synced_at: string | null
          sync_status: string
        }
        Insert: {
          created_at?: string
          error_message?: string | null
          ghl_contact_id?: string | null
          id?: string
          institution_id: string
          last_synced_at?: string | null
          sync_status?: string
        }
        Update: {
          created_at?: string
          error_message?: string | null
          ghl_contact_id?: string | null
          id?: string
          institution_id?: string
          last_synced_at?: string | null
          sync_status?: string
        }
        Relationships: [
          {
            foreignKeyName: "crm_ghl_sync_institution_id_fkey"
            columns: ["institution_id"]
            isOneToOne: false
            referencedRelation: "educational_institutions"
            referencedColumns: ["id"]
          },
        ]
      }
      crm_list_members: {
        Row: {
          added_at: string | null
          added_by: string | null
          id: string
          institution_id: string | null
          list_id: string | null
        }
        Insert: {
          added_at?: string | null
          added_by?: string | null
          id?: string
          institution_id?: string | null
          list_id?: string | null
        }
        Update: {
          added_at?: string | null
          added_by?: string | null
          id?: string
          institution_id?: string | null
          list_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "crm_list_members_added_by_fkey"
            columns: ["added_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "crm_list_members_added_by_fkey"
            columns: ["added_by"]
            isOneToOne: false
            referencedRelation: "profiles_public"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "crm_list_members_institution_id_fkey"
            columns: ["institution_id"]
            isOneToOne: false
            referencedRelation: "educational_institutions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "crm_list_members_list_id_fkey"
            columns: ["list_id"]
            isOneToOne: false
            referencedRelation: "crm_lists"
            referencedColumns: ["id"]
          },
        ]
      }
      crm_lists: {
        Row: {
          created_at: string | null
          created_by: string | null
          description: string | null
          filter_config: Json | null
          id: string
          name: string
          type: string | null
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          created_by?: string | null
          description?: string | null
          filter_config?: Json | null
          id?: string
          name: string
          type?: string | null
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          created_by?: string | null
          description?: string | null
          filter_config?: Json | null
          id?: string
          name?: string
          type?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "crm_lists_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "crm_lists_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles_public"
            referencedColumns: ["id"]
          },
        ]
      }
      crm_message_templates: {
        Row: {
          attachments: Json
          body: string
          channel: string
          created_at: string
          created_by: string | null
          id: string
          is_default: boolean | null
          name: string
          stage: string | null
          subject: string | null
          updated_at: string
          variables: string[] | null
        }
        Insert: {
          attachments?: Json
          body: string
          channel: string
          created_at?: string
          created_by?: string | null
          id?: string
          is_default?: boolean | null
          name: string
          stage?: string | null
          subject?: string | null
          updated_at?: string
          variables?: string[] | null
        }
        Update: {
          attachments?: Json
          body?: string
          channel?: string
          created_at?: string
          created_by?: string | null
          id?: string
          is_default?: boolean | null
          name?: string
          stage?: string | null
          subject?: string | null
          updated_at?: string
          variables?: string[] | null
        }
        Relationships: [
          {
            foreignKeyName: "crm_message_templates_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "crm_message_templates_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles_public"
            referencedColumns: ["id"]
          },
        ]
      }
      crm_notifications: {
        Row: {
          body: string | null
          created_at: string
          id: string
          institution_id: string | null
          is_read: boolean
          title: string
          user_id: string
        }
        Insert: {
          body?: string | null
          created_at?: string
          id?: string
          institution_id?: string | null
          is_read?: boolean
          title: string
          user_id: string
        }
        Update: {
          body?: string | null
          created_at?: string
          id?: string
          institution_id?: string | null
          is_read?: boolean
          title?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "crm_notifications_institution_id_fkey"
            columns: ["institution_id"]
            isOneToOne: false
            referencedRelation: "educational_institutions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "crm_notifications_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "crm_notifications_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles_public"
            referencedColumns: ["id"]
          },
        ]
      }
      crm_opportunities: {
        Row: {
          contact_id: string | null
          course_id: string | null
          created_at: string
          created_by: string | null
          decision_date: string | null
          ghl_opportunity_id: string | null
          groups: number | null
          id: string
          institution_id: string
          loss_reason: string | null
          name: string
          next_step: string | null
          next_step_date: string | null
          probability: number | null
          proposal_link: string | null
          proposal_sent: boolean | null
          sessions: number | null
          stage: string
          status: string
          updated_at: string
          value: number | null
        }
        Insert: {
          contact_id?: string | null
          course_id?: string | null
          created_at?: string
          created_by?: string | null
          decision_date?: string | null
          ghl_opportunity_id?: string | null
          groups?: number | null
          id?: string
          institution_id: string
          loss_reason?: string | null
          name: string
          next_step?: string | null
          next_step_date?: string | null
          probability?: number | null
          proposal_link?: string | null
          proposal_sent?: boolean | null
          sessions?: number | null
          stage?: string
          status?: string
          updated_at?: string
          value?: number | null
        }
        Update: {
          contact_id?: string | null
          course_id?: string | null
          created_at?: string
          created_by?: string | null
          decision_date?: string | null
          ghl_opportunity_id?: string | null
          groups?: number | null
          id?: string
          institution_id?: string
          loss_reason?: string | null
          name?: string
          next_step?: string | null
          next_step_date?: string | null
          probability?: number | null
          proposal_link?: string | null
          proposal_sent?: boolean | null
          sessions?: number | null
          stage?: string
          status?: string
          updated_at?: string
          value?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "crm_opportunities_contact_id_fkey"
            columns: ["contact_id"]
            isOneToOne: false
            referencedRelation: "crm_contacts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "crm_opportunities_course_id_fkey"
            columns: ["course_id"]
            isOneToOne: false
            referencedRelation: "courses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "crm_opportunities_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "crm_opportunities_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles_public"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "crm_opportunities_institution_id_fkey"
            columns: ["institution_id"]
            isOneToOne: false
            referencedRelation: "educational_institutions"
            referencedColumns: ["id"]
          },
        ]
      }
      crm_pipeline_stages: {
        Row: {
          color: string
          created_at: string
          id: string
          is_active: boolean
          is_lost: boolean
          is_won: boolean
          name: string
          order_index: number
        }
        Insert: {
          color?: string
          created_at?: string
          id?: string
          is_active?: boolean
          is_lost?: boolean
          is_won?: boolean
          name: string
          order_index?: number
        }
        Update: {
          color?: string
          created_at?: string
          id?: string
          is_active?: boolean
          is_lost?: boolean
          is_won?: boolean
          name?: string
          order_index?: number
        }
        Relationships: []
      }
      crm_settings: {
        Row: {
          id: string
          key: string
          updated_at: string | null
          updated_by: string | null
          value: string | null
        }
        Insert: {
          id?: string
          key: string
          updated_at?: string | null
          updated_by?: string | null
          value?: string | null
        }
        Update: {
          id?: string
          key?: string
          updated_at?: string | null
          updated_by?: string | null
          value?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "crm_settings_updated_by_fkey"
            columns: ["updated_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "crm_settings_updated_by_fkey"
            columns: ["updated_by"]
            isOneToOne: false
            referencedRelation: "profiles_public"
            referencedColumns: ["id"]
          },
        ]
      }
      crm_unmatched_communications: {
        Row: {
          body_text: string
          channel: string
          created_at: string
          direction: string
          id: string
          occurred_at: string
          provider: string | null
          provider_message_id: string | null
          provider_payload: Json
          provider_status: string | null
          recipient_address: string | null
          recipient_name: string | null
          sender_address: string | null
          sender_name: string | null
          status: string
        }
        Insert: {
          body_text: string
          channel: string
          created_at?: string
          direction?: string
          id?: string
          occurred_at?: string
          provider?: string | null
          provider_message_id?: string | null
          provider_payload?: Json
          provider_status?: string | null
          recipient_address?: string | null
          recipient_name?: string | null
          sender_address?: string | null
          sender_name?: string | null
          status?: string
        }
        Update: {
          body_text?: string
          channel?: string
          created_at?: string
          direction?: string
          id?: string
          occurred_at?: string
          provider?: string | null
          provider_message_id?: string | null
          provider_payload?: Json
          provider_status?: string | null
          recipient_address?: string | null
          recipient_name?: string | null
          sender_address?: string | null
          sender_name?: string | null
          status?: string
        }
        Relationships: []
      }
      educational_institutions: {
        Row: {
          address: string | null
          city: string | null
          contact_email: string | null
          contact_person: string | null
          contact_phone: string | null
          contacts: Json | null
          created_at: string | null
          crm_ai_score: number | null
          crm_assigned_instructor_id: string | null
          crm_budget: string | null
          crm_class: string | null
          crm_class_updated_at: string | null
          crm_contact_status_id: string | null
          crm_contact_status_updated_at: string | null
          crm_interests: string[] | null
          crm_last_contact_at: string | null
          crm_lead_source: string | null
          crm_network: string | null
          crm_next_step: string | null
          crm_next_step_date: string | null
          crm_notes: string | null
          crm_owner_id: string | null
          crm_pain_points: string | null
          crm_potential: number | null
          crm_risk: string | null
          crm_risk_updated_at: string | null
          crm_stage: string | null
          crm_stage_updated_at: string | null
          has_files: boolean
          id: string
          is_deleted: boolean
          name: string
          notes: string | null
          phone: string | null
          school_level: string | null
        }
        Insert: {
          address?: string | null
          city?: string | null
          contact_email?: string | null
          contact_person?: string | null
          contact_phone?: string | null
          contacts?: Json | null
          created_at?: string | null
          crm_ai_score?: number | null
          crm_assigned_instructor_id?: string | null
          crm_budget?: string | null
          crm_class?: string | null
          crm_class_updated_at?: string | null
          crm_contact_status_id?: string | null
          crm_contact_status_updated_at?: string | null
          crm_interests?: string[] | null
          crm_last_contact_at?: string | null
          crm_lead_source?: string | null
          crm_network?: string | null
          crm_next_step?: string | null
          crm_next_step_date?: string | null
          crm_notes?: string | null
          crm_owner_id?: string | null
          crm_pain_points?: string | null
          crm_potential?: number | null
          crm_risk?: string | null
          crm_risk_updated_at?: string | null
          crm_stage?: string | null
          crm_stage_updated_at?: string | null
          has_files?: boolean
          id?: string
          is_deleted?: boolean
          name: string
          notes?: string | null
          phone?: string | null
          school_level?: string | null
        }
        Update: {
          address?: string | null
          city?: string | null
          contact_email?: string | null
          contact_person?: string | null
          contact_phone?: string | null
          contacts?: Json | null
          created_at?: string | null
          crm_ai_score?: number | null
          crm_assigned_instructor_id?: string | null
          crm_budget?: string | null
          crm_class?: string | null
          crm_class_updated_at?: string | null
          crm_contact_status_id?: string | null
          crm_contact_status_updated_at?: string | null
          crm_interests?: string[] | null
          crm_last_contact_at?: string | null
          crm_lead_source?: string | null
          crm_network?: string | null
          crm_next_step?: string | null
          crm_next_step_date?: string | null
          crm_notes?: string | null
          crm_owner_id?: string | null
          crm_pain_points?: string | null
          crm_potential?: number | null
          crm_risk?: string | null
          crm_risk_updated_at?: string | null
          crm_stage?: string | null
          crm_stage_updated_at?: string | null
          has_files?: boolean
          id?: string
          is_deleted?: boolean
          name?: string
          notes?: string | null
          phone?: string | null
          school_level?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "educational_institutions_crm_assigned_instructor_id_fkey"
            columns: ["crm_assigned_instructor_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "educational_institutions_crm_assigned_instructor_id_fkey"
            columns: ["crm_assigned_instructor_id"]
            isOneToOne: false
            referencedRelation: "profiles_public"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "educational_institutions_crm_contact_status_id_fkey"
            columns: ["crm_contact_status_id"]
            isOneToOne: false
            referencedRelation: "crm_contact_statuses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "educational_institutions_crm_owner_id_fkey"
            columns: ["crm_owner_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "educational_institutions_crm_owner_id_fkey"
            columns: ["crm_owner_id"]
            isOneToOne: false
            referencedRelation: "profiles_public"
            referencedColumns: ["id"]
          },
        ]
      }
      instructor_assignments: {
        Row: {
          course_id: string | null
          created_at: string
          created_by: string | null
          day_of_week: number | null
          end_time: string | null
          group_id: string | null
          id: string
          institution_id: string | null
          instructor_id: string
          notes: string | null
          school_year: string | null
          start_time: string | null
          status: string
          updated_at: string
        }
        Insert: {
          course_id?: string | null
          created_at?: string
          created_by?: string | null
          day_of_week?: number | null
          end_time?: string | null
          group_id?: string | null
          id?: string
          institution_id?: string | null
          instructor_id: string
          notes?: string | null
          school_year?: string | null
          start_time?: string | null
          status?: string
          updated_at?: string
        }
        Update: {
          course_id?: string | null
          created_at?: string
          created_by?: string | null
          day_of_week?: number | null
          end_time?: string | null
          group_id?: string | null
          id?: string
          institution_id?: string | null
          instructor_id?: string
          notes?: string | null
          school_year?: string | null
          start_time?: string | null
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "instructor_assignments_course_id_fkey"
            columns: ["course_id"]
            isOneToOne: false
            referencedRelation: "courses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "instructor_assignments_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "academic_year_order_groups"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "instructor_assignments_institution_id_fkey"
            columns: ["institution_id"]
            isOneToOne: false
            referencedRelation: "educational_institutions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "instructor_assignments_instructor_id_fkey"
            columns: ["instructor_id"]
            isOneToOne: false
            referencedRelation: "instructors"
            referencedColumns: ["id"]
          },
        ]
      }
      instructors: {
        Row: {
          address: string | null
          audiences: string[]
          availability_days: number[]
          availability_hours: Json | null
          city: string
          created_at: string
          created_by: string | null
          email: string | null
          employment_type: string | null
          full_name: string
          hourly_rate: number | null
          hourly_rate_notes: string | null
          id: string
          languages: string[]
          notes: string | null
          phone: string | null
          profile_id: string | null
          quality_tags: string[]
          rating_notes: string | null
          rating_score: number | null
          region: string | null
          role_type: string | null
          status: string
          subjects: string[]
          travel_radius_km: number | null
          updated_at: string
        }
        Insert: {
          address?: string | null
          audiences?: string[]
          availability_days?: number[]
          availability_hours?: Json | null
          city: string
          created_at?: string
          created_by?: string | null
          email?: string | null
          employment_type?: string | null
          full_name: string
          hourly_rate?: number | null
          hourly_rate_notes?: string | null
          id?: string
          languages?: string[]
          notes?: string | null
          phone?: string | null
          profile_id?: string | null
          quality_tags?: string[]
          rating_notes?: string | null
          rating_score?: number | null
          region?: string | null
          role_type?: string | null
          status?: string
          subjects?: string[]
          travel_radius_km?: number | null
          updated_at?: string
        }
        Update: {
          address?: string | null
          audiences?: string[]
          availability_days?: number[]
          availability_hours?: Json | null
          city?: string
          created_at?: string
          created_by?: string | null
          email?: string | null
          employment_type?: string | null
          full_name?: string
          hourly_rate?: number | null
          hourly_rate_notes?: string | null
          id?: string
          languages?: string[]
          notes?: string | null
          phone?: string | null
          profile_id?: string | null
          quality_tags?: string[]
          rating_notes?: string | null
          rating_score?: number | null
          region?: string | null
          role_type?: string | null
          status?: string
          subjects?: string[]
          travel_radius_km?: number | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "instructors_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "instructors_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "profiles_public"
            referencedColumns: ["id"]
          },
        ]
      }
      lesson_attendance: {
        Row: {
          attended: boolean | null
          created_at: string | null
          id: string
          lesson_report_id: string | null
          student_id: string | null
        }
        Insert: {
          attended?: boolean | null
          created_at?: string | null
          id?: string
          lesson_report_id?: string | null
          student_id?: string | null
        }
        Update: {
          attended?: boolean | null
          created_at?: string | null
          id?: string
          lesson_report_id?: string | null
          student_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "lesson_attendance_lesson_report_id_fkey"
            columns: ["lesson_report_id"]
            isOneToOne: false
            referencedRelation: "lesson_reports"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lesson_attendance_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "students"
            referencedColumns: ["id"]
          },
        ]
      }
      lesson_cancellations: {
        Row: {
          cancellation_reason: string | null
          cancelled_at: string | null
          cancelled_by: string | null
          course_instance_id: string
          created_at: string | null
          id: string
          is_rescheduled: boolean | null
          lesson_id: string
          original_scheduled_date: string
          rescheduled_to_date: string | null
          updated_at: string | null
        }
        Insert: {
          cancellation_reason?: string | null
          cancelled_at?: string | null
          cancelled_by?: string | null
          course_instance_id: string
          created_at?: string | null
          id?: string
          is_rescheduled?: boolean | null
          lesson_id: string
          original_scheduled_date: string
          rescheduled_to_date?: string | null
          updated_at?: string | null
        }
        Update: {
          cancellation_reason?: string | null
          cancelled_at?: string | null
          cancelled_by?: string | null
          course_instance_id?: string
          created_at?: string | null
          id?: string
          is_rescheduled?: boolean | null
          lesson_id?: string
          original_scheduled_date?: string
          rescheduled_to_date?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "lesson_cancellations_cancelled_by_fkey"
            columns: ["cancelled_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lesson_cancellations_cancelled_by_fkey"
            columns: ["cancelled_by"]
            isOneToOne: false
            referencedRelation: "profiles_public"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lesson_cancellations_course_instance_id_fkey"
            columns: ["course_instance_id"]
            isOneToOne: false
            referencedRelation: "course_instances"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lesson_cancellations_lesson_id_fkey"
            columns: ["lesson_id"]
            isOneToOne: false
            referencedRelation: "lessons"
            referencedColumns: ["id"]
          },
        ]
      }
      lesson_files: {
        Row: {
          file_name: string
          file_path: string
          file_size: number | null
          file_type: string | null
          id: string
          is_for_marketing: boolean | null
          lesson_id: string | null
          lesson_report_id: string | null
          uploaded_at: string | null
        }
        Insert: {
          file_name: string
          file_path: string
          file_size?: number | null
          file_type?: string | null
          id?: string
          is_for_marketing?: boolean | null
          lesson_id?: string | null
          lesson_report_id?: string | null
          uploaded_at?: string | null
        }
        Update: {
          file_name?: string
          file_path?: string
          file_size?: number | null
          file_type?: string | null
          id?: string
          is_for_marketing?: boolean | null
          lesson_id?: string | null
          lesson_report_id?: string | null
          uploaded_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "lesson_files_lesson_report_id_fkey"
            columns: ["lesson_report_id"]
            isOneToOne: false
            referencedRelation: "lesson_reports"
            referencedColumns: ["id"]
          },
        ]
      }
      lesson_reports: {
        Row: {
          cancellation_reason: string | null
          completed_task_ids: string[] | null
          course_instance_id: string | null
          created_at: string
          feedback: string | null
          id: string
          instructor_id: string | null
          is_cancelled: boolean | null
          is_completed: boolean | null
          is_lesson_ok: boolean | null
          lesson_id: string | null
          lesson_schedule_id: string | null
          lesson_title: string
          lessons_count: number | null
          marketing_consent: boolean | null
          notes: string | null
          participants_count: number | null
          reported_by: string | null
          updated_at: string
        }
        Insert: {
          cancellation_reason?: string | null
          completed_task_ids?: string[] | null
          course_instance_id?: string | null
          created_at?: string
          feedback?: string | null
          id?: string
          instructor_id?: string | null
          is_cancelled?: boolean | null
          is_completed?: boolean | null
          is_lesson_ok?: boolean | null
          lesson_id?: string | null
          lesson_schedule_id?: string | null
          lesson_title: string
          lessons_count?: number | null
          marketing_consent?: boolean | null
          notes?: string | null
          participants_count?: number | null
          reported_by?: string | null
          updated_at?: string
        }
        Update: {
          cancellation_reason?: string | null
          completed_task_ids?: string[] | null
          course_instance_id?: string | null
          created_at?: string
          feedback?: string | null
          id?: string
          instructor_id?: string | null
          is_cancelled?: boolean | null
          is_completed?: boolean | null
          is_lesson_ok?: boolean | null
          lesson_id?: string | null
          lesson_schedule_id?: string | null
          lesson_title?: string
          lessons_count?: number | null
          marketing_consent?: boolean | null
          notes?: string | null
          participants_count?: number | null
          reported_by?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "lesson_reports_course_instance_id_fkey"
            columns: ["course_instance_id"]
            isOneToOne: false
            referencedRelation: "course_instances"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lesson_reports_instructor_id_fkey"
            columns: ["instructor_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lesson_reports_instructor_id_fkey"
            columns: ["instructor_id"]
            isOneToOne: false
            referencedRelation: "profiles_public"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lesson_reports_lesson_id_fkey"
            columns: ["lesson_id"]
            isOneToOne: false
            referencedRelation: "lessons"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lesson_reports_lesson_schedule_id_fkey"
            columns: ["lesson_schedule_id"]
            isOneToOne: false
            referencedRelation: "lesson_schedules"
            referencedColumns: ["id"]
          },
        ]
      }
      lesson_schedules: {
        Row: {
          admin_notified_at: string | null
          course_instance_id: string | null
          created_at: string | null
          id: string
          instance_number: number | null
          is_generated: boolean | null
          lesson_id: string | null
          lesson_number: number | null
          original_scheduled_end: string | null
          original_scheduled_start: string | null
          scheduled_end: string | null
          scheduled_start: string | null
          updated_at: string | null
        }
        Insert: {
          admin_notified_at?: string | null
          course_instance_id?: string | null
          created_at?: string | null
          id?: string
          instance_number?: number | null
          is_generated?: boolean | null
          lesson_id?: string | null
          lesson_number?: number | null
          original_scheduled_end?: string | null
          original_scheduled_start?: string | null
          scheduled_end?: string | null
          scheduled_start?: string | null
          updated_at?: string | null
        }
        Update: {
          admin_notified_at?: string | null
          course_instance_id?: string | null
          created_at?: string | null
          id?: string
          instance_number?: number | null
          is_generated?: boolean | null
          lesson_id?: string | null
          lesson_number?: number | null
          original_scheduled_end?: string | null
          original_scheduled_start?: string | null
          scheduled_end?: string | null
          scheduled_start?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "lesson_schedules_course_instance_id_fkey"
            columns: ["course_instance_id"]
            isOneToOne: false
            referencedRelation: "course_instances"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lesson_schedules_lesson_id_fkey"
            columns: ["lesson_id"]
            isOneToOne: false
            referencedRelation: "lessons"
            referencedColumns: ["id"]
          },
        ]
      }
      lesson_task_completions: {
        Row: {
          completed_at: string | null
          created_at: string | null
          curriculum_task_id: string | null
          id: string
          instructor_notes: string | null
          lesson_id: string | null
          status: Database["public"]["Enums"]["task_status"] | null
        }
        Insert: {
          completed_at?: string | null
          created_at?: string | null
          curriculum_task_id?: string | null
          id?: string
          instructor_notes?: string | null
          lesson_id?: string | null
          status?: Database["public"]["Enums"]["task_status"] | null
        }
        Update: {
          completed_at?: string | null
          created_at?: string | null
          curriculum_task_id?: string | null
          id?: string
          instructor_notes?: string | null
          lesson_id?: string | null
          status?: Database["public"]["Enums"]["task_status"] | null
        }
        Relationships: []
      }
      lesson_tasks: {
        Row: {
          created_at: string | null
          description: string | null
          estimated_duration: number | null
          id: string
          is_mandatory: boolean | null
          lesson_id: string
          lesson_number: number | null
          order_index: number
          title: string
        }
        Insert: {
          created_at?: string | null
          description?: string | null
          estimated_duration?: number | null
          id?: string
          is_mandatory?: boolean | null
          lesson_id: string
          lesson_number?: number | null
          order_index: number
          title: string
        }
        Update: {
          created_at?: string | null
          description?: string | null
          estimated_duration?: number | null
          id?: string
          is_mandatory?: boolean | null
          lesson_id?: string
          lesson_number?: number | null
          order_index?: number
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: "lesson_tasks_lesson_id_fkey"
            columns: ["lesson_id"]
            isOneToOne: false
            referencedRelation: "lessons"
            referencedColumns: ["id"]
          },
        ]
      }
      lessons: {
        Row: {
          actual_end: string | null
          actual_start: string | null
          course_id: string
          course_instance_id: string | null
          created_at: string | null
          description: string | null
          feedback: string | null
          id: string
          instructor_id: string | null
          notes: string | null
          order_index: number | null
          participants_count: number | null
          scheduled_end: string
          scheduled_start: string
          status: string | null
          title: string
        }
        Insert: {
          actual_end?: string | null
          actual_start?: string | null
          course_id: string
          course_instance_id?: string | null
          created_at?: string | null
          description?: string | null
          feedback?: string | null
          id?: string
          instructor_id?: string | null
          notes?: string | null
          order_index?: number | null
          participants_count?: number | null
          scheduled_end: string
          scheduled_start: string
          status?: string | null
          title: string
        }
        Update: {
          actual_end?: string | null
          actual_start?: string | null
          course_id?: string
          course_instance_id?: string | null
          created_at?: string | null
          description?: string | null
          feedback?: string | null
          id?: string
          instructor_id?: string | null
          notes?: string | null
          order_index?: number | null
          participants_count?: number | null
          scheduled_end?: string
          scheduled_start?: string
          status?: string | null
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: "lessons_course_id_fkey"
            columns: ["course_id"]
            isOneToOne: false
            referencedRelation: "courses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lessons_course_instance_id_fkey"
            columns: ["course_instance_id"]
            isOneToOne: false
            referencedRelation: "course_instances"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lessons_instructor_id_fkey"
            columns: ["instructor_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lessons_instructor_id_fkey"
            columns: ["instructor_id"]
            isOneToOne: false
            referencedRelation: "profiles_public"
            referencedColumns: ["id"]
          },
        ]
      }
      products: {
        Row: {
          created_at: string
          created_by: string | null
          id: string
          internal_notes: string | null
          name: string
          price_excl_vat: number
          price_incl_vat: number
          short_description: string | null
          sort_order: number
          status: string
          syllabus_url: string | null
          updated_at: string
          updated_by: string | null
          vat_rate: number
          website_url: string | null
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          id?: string
          internal_notes?: string | null
          name: string
          price_excl_vat?: number
          price_incl_vat?: number
          short_description?: string | null
          sort_order?: number
          status?: string
          syllabus_url?: string | null
          updated_at?: string
          updated_by?: string | null
          vat_rate?: number
          website_url?: string | null
        }
        Update: {
          created_at?: string
          created_by?: string | null
          id?: string
          internal_notes?: string | null
          name?: string
          price_excl_vat?: number
          price_incl_vat?: number
          short_description?: string | null
          sort_order?: number
          status?: string
          syllabus_url?: string | null
          updated_at?: string
          updated_by?: string | null
          vat_rate?: number
          website_url?: string | null
        }
        Relationships: []
      }
      profiles: {
        Row: {
          benefits: string | null
          birthdate: string | null
          created_at: string | null
          current_work_hours: number | null
          email: string | null
          full_name: string
          hourly_rate: number | null
          id: string
          img: string | null
          phone: string | null
          role: Database["public"]["Enums"]["user_role"]
          updated_at: string | null
        }
        Insert: {
          benefits?: string | null
          birthdate?: string | null
          created_at?: string | null
          current_work_hours?: number | null
          email?: string | null
          full_name: string
          hourly_rate?: number | null
          id: string
          img?: string | null
          phone?: string | null
          role?: Database["public"]["Enums"]["user_role"]
          updated_at?: string | null
        }
        Update: {
          benefits?: string | null
          birthdate?: string | null
          created_at?: string | null
          current_work_hours?: number | null
          email?: string | null
          full_name?: string
          hourly_rate?: number | null
          id?: string
          img?: string | null
          phone?: string | null
          role?: Database["public"]["Enums"]["user_role"]
          updated_at?: string | null
        }
        Relationships: []
      }
      project_links: {
        Row: {
          created_at: string
          id: string
          label: string
          project_id: string
          url: string
        }
        Insert: {
          created_at?: string
          id?: string
          label: string
          project_id: string
          url: string
        }
        Update: {
          created_at?: string
          id?: string
          label?: string
          project_id?: string
          url?: string
        }
        Relationships: [
          {
            foreignKeyName: "project_links_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      project_members: {
        Row: {
          added_at: string
          project_id: string
          user_id: string
        }
        Insert: {
          added_at?: string
          project_id: string
          user_id: string
        }
        Update: {
          added_at?: string
          project_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "project_members_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "project_members_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "project_members_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles_public"
            referencedColumns: ["id"]
          },
        ]
      }
      projects: {
        Row: {
          color: string
          created_at: string
          deadline: string | null
          description: string | null
          id: string
          info_md: string | null
          name: string
          owner_id: string | null
          project_type: string
          status: string
          updated_at: string
        }
        Insert: {
          color?: string
          created_at?: string
          deadline?: string | null
          description?: string | null
          id?: string
          info_md?: string | null
          name: string
          owner_id?: string | null
          project_type?: string
          status?: string
          updated_at?: string
        }
        Update: {
          color?: string
          created_at?: string
          deadline?: string | null
          description?: string | null
          id?: string
          info_md?: string | null
          name?: string
          owner_id?: string | null
          project_type?: string
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "projects_owner_id_fkey"
            columns: ["owner_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "projects_owner_id_fkey"
            columns: ["owner_id"]
            isOneToOne: false
            referencedRelation: "profiles_public"
            referencedColumns: ["id"]
          },
        ]
      }
      quote_counters: {
        Row: {
          next_number: number
          year: number
        }
        Insert: {
          next_number?: number
          year: number
        }
        Update: {
          next_number?: number
          year?: number
        }
        Relationships: []
      }
      quote_lines: {
        Row: {
          class_label: string | null
          created_at: string
          description_text: string | null
          external_description: string | null
          external_price: number | null
          external_product_name: string | null
          external_quantity: number | null
          grade_label: string | null
          groups_count: number
          hourly_rate_incl_vat: number
          hours_per_meeting: number
          id: string
          internal_notes: string | null
          line_total_incl_vat: number
          meetings_count: number
          product_id: string | null
          product_name_snapshot: string
          quote_id: string
          sort_order: number
          total_hours: number
          updated_at: string
        }
        Insert: {
          class_label?: string | null
          created_at?: string
          description_text?: string | null
          external_description?: string | null
          external_price?: number | null
          external_product_name?: string | null
          external_quantity?: number | null
          grade_label?: string | null
          groups_count?: number
          hourly_rate_incl_vat?: number
          hours_per_meeting?: number
          id?: string
          internal_notes?: string | null
          line_total_incl_vat?: number
          meetings_count?: number
          product_id?: string | null
          product_name_snapshot: string
          quote_id: string
          sort_order?: number
          total_hours?: number
          updated_at?: string
        }
        Update: {
          class_label?: string | null
          created_at?: string
          description_text?: string | null
          external_description?: string | null
          external_price?: number | null
          external_product_name?: string | null
          external_quantity?: number | null
          grade_label?: string | null
          groups_count?: number
          hourly_rate_incl_vat?: number
          hours_per_meeting?: number
          id?: string
          internal_notes?: string | null
          line_total_incl_vat?: number
          meetings_count?: number
          product_id?: string | null
          product_name_snapshot?: string
          quote_id?: string
          sort_order?: number
          total_hours?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "quote_lines_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "quote_lines_quote_id_fkey"
            columns: ["quote_id"]
            isOneToOne: false
            referencedRelation: "quotes"
            referencedColumns: ["id"]
          },
        ]
      }
      quotes: {
        Row: {
          contact_snapshot_email: string | null
          contact_snapshot_name: string | null
          contact_snapshot_phone: string | null
          created_at: string
          created_by: string | null
          customer_snapshot_name: string
          discount_amount: number
          id: string
          institution_id: string
          issue_date: string
          notes: string | null
          quote_number: string
          rounding_amount: number
          status: string
          subtotal_incl_vat: number
          summit_export_reference: string | null
          summit_export_status: string | null
          terms_text: string | null
          total_incl_vat: number
          updated_at: string
          updated_by: string | null
          valid_until: string | null
        }
        Insert: {
          contact_snapshot_email?: string | null
          contact_snapshot_name?: string | null
          contact_snapshot_phone?: string | null
          created_at?: string
          created_by?: string | null
          customer_snapshot_name: string
          discount_amount?: number
          id?: string
          institution_id: string
          issue_date?: string
          notes?: string | null
          quote_number: string
          rounding_amount?: number
          status?: string
          subtotal_incl_vat?: number
          summit_export_reference?: string | null
          summit_export_status?: string | null
          terms_text?: string | null
          total_incl_vat?: number
          updated_at?: string
          updated_by?: string | null
          valid_until?: string | null
        }
        Update: {
          contact_snapshot_email?: string | null
          contact_snapshot_name?: string | null
          contact_snapshot_phone?: string | null
          created_at?: string
          created_by?: string | null
          customer_snapshot_name?: string
          discount_amount?: number
          id?: string
          institution_id?: string
          issue_date?: string
          notes?: string | null
          quote_number?: string
          rounding_amount?: number
          status?: string
          subtotal_incl_vat?: number
          summit_export_reference?: string | null
          summit_export_status?: string | null
          terms_text?: string | null
          total_incl_vat?: number
          updated_at?: string
          updated_by?: string | null
          valid_until?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "quotes_institution_id_fkey"
            columns: ["institution_id"]
            isOneToOne: false
            referencedRelation: "educational_institutions"
            referencedColumns: ["id"]
          },
        ]
      }
      reported_lesson_instances: {
        Row: {
          course_instance_id: string | null
          created_at: string | null
          id: string
          lesson_id: string | null
          lesson_number: number | null
          lesson_report_id: string | null
          lesson_schedule_id: string | null
          scheduled_date: string | null
        }
        Insert: {
          course_instance_id?: string | null
          created_at?: string | null
          id?: string
          lesson_id?: string | null
          lesson_number?: number | null
          lesson_report_id?: string | null
          lesson_schedule_id?: string | null
          scheduled_date?: string | null
        }
        Update: {
          course_instance_id?: string | null
          created_at?: string | null
          id?: string
          lesson_id?: string | null
          lesson_number?: number | null
          lesson_report_id?: string | null
          lesson_schedule_id?: string | null
          scheduled_date?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "reported_lesson_instances_course_instance_id_fkey"
            columns: ["course_instance_id"]
            isOneToOne: false
            referencedRelation: "course_instances"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reported_lesson_instances_lesson_id_fkey"
            columns: ["lesson_id"]
            isOneToOne: false
            referencedRelation: "lessons"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reported_lesson_instances_lesson_report_id_fkey"
            columns: ["lesson_report_id"]
            isOneToOne: false
            referencedRelation: "lesson_reports"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reported_lesson_instances_lesson_schedule_id_fkey"
            columns: ["lesson_schedule_id"]
            isOneToOne: false
            referencedRelation: "lesson_schedules"
            referencedColumns: ["id"]
          },
        ]
      }
      sales_leads: {
        Row: {
          closed_at: string | null
          commission_percentage: number | null
          contact_email: string | null
          contact_person: string | null
          contact_phone: string | null
          created_at: string | null
          id: string
          institution_name: string
          instructor_id: string | null
          notes: string | null
          potential_value: number | null
          status: string | null
        }
        Insert: {
          closed_at?: string | null
          commission_percentage?: number | null
          contact_email?: string | null
          contact_person?: string | null
          contact_phone?: string | null
          created_at?: string | null
          id?: string
          institution_name: string
          instructor_id?: string | null
          notes?: string | null
          potential_value?: number | null
          status?: string | null
        }
        Update: {
          closed_at?: string | null
          commission_percentage?: number | null
          contact_email?: string | null
          contact_person?: string | null
          contact_phone?: string | null
          created_at?: string | null
          id?: string
          institution_name?: string
          instructor_id?: string | null
          notes?: string | null
          potential_value?: number | null
          status?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "sales_leads_instructor_id_fkey"
            columns: ["instructor_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sales_leads_instructor_id_fkey"
            columns: ["instructor_id"]
            isOneToOne: false
            referencedRelation: "profiles_public"
            referencedColumns: ["id"]
          },
        ]
      }
      schedule_adjustments: {
        Row: {
          adjustment_type: string
          course_instance_id: string
          created_at: string | null
          created_by: string | null
          id: string
          lesson_number: number | null
          new_scheduled_date: string | null
          original_scheduled_date: string
        }
        Insert: {
          adjustment_type?: string
          course_instance_id: string
          created_at?: string | null
          created_by?: string | null
          id?: string
          lesson_number?: number | null
          new_scheduled_date?: string | null
          original_scheduled_date: string
        }
        Update: {
          adjustment_type?: string
          course_instance_id?: string
          created_at?: string | null
          created_by?: string | null
          id?: string
          lesson_number?: number | null
          new_scheduled_date?: string | null
          original_scheduled_date?: string
        }
        Relationships: [
          {
            foreignKeyName: "schedule_adjustments_course_instance_id_fkey"
            columns: ["course_instance_id"]
            isOneToOne: false
            referencedRelation: "course_instances"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "schedule_adjustments_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "schedule_adjustments_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles_public"
            referencedColumns: ["id"]
          },
        ]
      }
      students: {
        Row: {
          course_instance_id: string | null
          created_at: string | null
          full_name: string
          id: string
        }
        Insert: {
          course_instance_id?: string | null
          created_at?: string | null
          full_name: string
          id?: string
        }
        Update: {
          course_instance_id?: string | null
          created_at?: string | null
          full_name?: string
          id?: string
        }
        Relationships: [
          {
            foreignKeyName: "students_course_instance_id_fkey"
            columns: ["course_instance_id"]
            isOneToOne: false
            referencedRelation: "course_instances"
            referencedColumns: ["id"]
          },
        ]
      }
      system_defaults: {
        Row: {
          created_at: string | null
          default_lesson_duration: number
          default_task_duration: number
          id: string
          rewards_page_enabled: boolean
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          default_lesson_duration?: number
          default_task_duration?: number
          id?: string
          rewards_page_enabled?: boolean
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          default_lesson_duration?: number
          default_task_duration?: number
          id?: string
          rewards_page_enabled?: boolean
          updated_at?: string | null
        }
        Relationships: []
      }
      task_comments: {
        Row: {
          author_id: string | null
          body: string
          created_at: string
          id: string
          task_id: string
        }
        Insert: {
          author_id?: string | null
          body: string
          created_at?: string
          id?: string
          task_id: string
        }
        Update: {
          author_id?: string | null
          body?: string
          created_at?: string
          id?: string
          task_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "task_comments_author_id_fkey"
            columns: ["author_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "task_comments_author_id_fkey"
            columns: ["author_id"]
            isOneToOne: false
            referencedRelation: "profiles_public"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "task_comments_task_id_fkey"
            columns: ["task_id"]
            isOneToOne: false
            referencedRelation: "tasks"
            referencedColumns: ["id"]
          },
        ]
      }
      tasks: {
        Row: {
          assignee_id: string | null
          block_reason: string | null
          created_at: string
          description: string | null
          due_date: string | null
          id: string
          is_blocked: boolean
          order_index: number
          project_id: string | null
          reporter_id: string | null
          status: string
          task_type: string | null
          title: string
          updated_at: string
        }
        Insert: {
          assignee_id?: string | null
          block_reason?: string | null
          created_at?: string
          description?: string | null
          due_date?: string | null
          id?: string
          is_blocked?: boolean
          order_index?: number
          project_id?: string | null
          reporter_id?: string | null
          status?: string
          task_type?: string | null
          title: string
          updated_at?: string
        }
        Update: {
          assignee_id?: string | null
          block_reason?: string | null
          created_at?: string
          description?: string | null
          due_date?: string | null
          id?: string
          is_blocked?: boolean
          order_index?: number
          project_id?: string | null
          reporter_id?: string | null
          status?: string
          task_type?: string | null
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "tasks_assignee_id_fkey"
            columns: ["assignee_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tasks_assignee_id_fkey"
            columns: ["assignee_id"]
            isOneToOne: false
            referencedRelation: "profiles_public"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tasks_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tasks_reporter_id_fkey"
            columns: ["reporter_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tasks_reporter_id_fkey"
            columns: ["reporter_id"]
            isOneToOne: false
            referencedRelation: "profiles_public"
            referencedColumns: ["id"]
          },
        ]
      }
      user_roles: {
        Row: {
          created_at: string | null
          id: string
          role: string
          user_id: string | null
        }
        Insert: {
          created_at?: string | null
          id?: string
          role: string
          user_id?: string | null
        }
        Update: {
          created_at?: string | null
          id?: string
          role?: string
          user_id?: string | null
        }
        Relationships: []
      }
    }
    Views: {
      profiles_public: {
        Row: {
          benefits: string | null
          birthdate: string | null
          created_at: string | null
          current_work_hours: number | null
          email: string | null
          full_name: string | null
          hourly_rate: number | null
          id: string | null
          phone: string | null
          role: Database["public"]["Enums"]["user_role"] | null
          updated_at: string | null
        }
        Insert: {
          benefits?: string | null
          birthdate?: string | null
          created_at?: string | null
          current_work_hours?: number | null
          email?: string | null
          full_name?: string | null
          hourly_rate?: number | null
          id?: string | null
          phone?: string | null
          role?: Database["public"]["Enums"]["user_role"] | null
          updated_at?: string | null
        }
        Update: {
          benefits?: string | null
          birthdate?: string | null
          created_at?: string | null
          current_work_hours?: number | null
          email?: string | null
          full_name?: string | null
          hourly_rate?: number | null
          id?: string | null
          phone?: string | null
          role?: Database["public"]["Enums"]["user_role"] | null
          updated_at?: string | null
        }
        Relationships: []
      }
    }
    Functions: {
      allocate_quote_number: { Args: never; Returns: string }
      cancel_lesson_and_reschedule: {
        Args: {
          p_cancellation_reason?: string
          p_cancelled_by?: string
          p_course_instance_id: string
          p_lesson_id: string
          p_original_date: string
        }
        Returns: Json
      }
      delete_by_course_instance_id: {
        Args: { p_uuid: string }
        Returns: number
      }
      delete_course_template: {
        Args: { p_course_id: string }
        Returns: undefined
      }
      delete_crm_pipeline_stage: {
        Args: { p_stage_id: string }
        Returns: {
          automation_rules_count: number
          deleted_count: number
          institutions_count: number
          message_templates_count: number
          opportunities_count: number
          stage_id: string
          stage_name: string
        }[]
      }
      generate_and_insert_schedules: {
        Args: {
          p_course_instance_id: string
          p_days_of_week: number[]
          p_lesson_mode?: string
          p_pattern_id: string
          p_start_date: string
          p_time_slots: Json
          p_total_lessons: number
        }
        Returns: number
      }
      generate_and_insert_schedules_for_range: {
        Args: {
          p_instance_id: string
          p_range_end: string
          p_range_start: string
        }
        Returns: {
          admin_notified_at: string | null
          course_instance_id: string | null
          created_at: string | null
          id: string
          instance_number: number | null
          is_generated: boolean | null
          lesson_id: string | null
          lesson_number: number | null
          original_scheduled_end: string | null
          original_scheduled_start: string | null
          scheduled_end: string | null
          scheduled_start: string | null
          updated_at: string | null
        }[]
        SetofOptions: {
          from: "*"
          to: "lesson_schedules"
          isOneToOne: false
          isSetofReturn: true
        }
      }
      generate_schedules_for_instance: {
        Args: { p_instance_id: string }
        Returns: undefined
      }
      get_admin_emails: {
        Args: never
        Returns: {
          email: string
        }[]
      }
      get_cancellation_history: {
        Args: { p_course_instance_id: string }
        Returns: {
          cancellation_id: string
          cancellation_reason: string
          cancelled_at: string
          cancelled_by_name: string
          is_rescheduled: boolean
          lesson_title: string
          original_date: string
          rescheduled_to_date: string
        }[]
      }
      get_current_user_role: {
        Args: never
        Returns: Database["public"]["Enums"]["user_role"]
      }
      get_lessons_by_courses: {
        Args: { course_ids: string[] }
        Returns: {
          actual_end: string | null
          actual_start: string | null
          course_id: string
          course_instance_id: string | null
          created_at: string | null
          description: string | null
          feedback: string | null
          id: string
          instructor_id: string | null
          notes: string | null
          order_index: number | null
          participants_count: number | null
          scheduled_end: string
          scheduled_start: string
          status: string | null
          title: string
        }[]
        SetofOptions: {
          from: "*"
          to: "lessons"
          isOneToOne: false
          isSetofReturn: true
        }
      }
      get_schedules_for_user_in_range_cached: {
        Args: {
          end_date_param: string
          start_date_param: string
          user_id_param: string
        }
        Returns: {
          course_instance_id: string
          course_name: string
          grade_level: string
          id: string
          institution_name: string
          instructor_id: string
          instructor_name: string
          is_generated: boolean
          lesson_id: string
          lesson_number: number
          scheduled_end: string
          scheduled_start: string
          title: string
        }[]
      }
      get_user_role_text: { Args: never; Returns: string }
      is_admin_or_manager: { Args: never; Returns: boolean }
      is_project_member: { Args: { p_id: string }; Returns: boolean }
      is_project_owner: { Args: { p_id: string }; Returns: boolean }
      rename_crm_pipeline_stage: {
        Args: { p_new_name: string; p_stage_id: string }
        Returns: {
          automation_rules_updated: number
          institutions_updated: number
          message_templates_updated: number
          new_name: string
          old_name: string
          opportunities_updated: number
          pipeline_stages_updated: number
          stage_id: string
        }[]
      }
      report_work_hour: {
        Args: { p_lessons_count?: number }
        Returns: undefined
      }
      save_academic_year_order: { Args: { payload: Json }; Returns: Json }
      update_user_auth_data: {
        Args: {
          new_email?: string
          new_metadata?: Json
          target_user_id: string
        }
        Returns: undefined
      }
    }
    Enums: {
      lesson_status: "scheduled" | "in_progress" | "completed" | "cancelled"
      task_status: "pending" | "completed" | "delayed"
      user_role: "instructor" | "pedagogical_manager" | "admin" | "sales_rep"
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
      lesson_status: ["scheduled", "in_progress", "completed", "cancelled"],
      task_status: ["pending", "completed", "delayed"],
      user_role: ["instructor", "pedagogical_manager", "admin", "sales_rep"],
    },
  },
} as const
