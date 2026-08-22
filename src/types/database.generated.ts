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
    PostgrestVersion: "14.15"
  }
  graphql_public: {
    Tables: {
      [_ in never]: never
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      graphql: {
        Args: {
          extensions?: Json
          operationName?: string
          query?: string
          variables?: Json
        }
        Returns: Json
      }
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
  public: {
    Tables: {
      class_reminders: {
        Row: {
          attempts: number
          class_id: string
          created_at: string
          id: string
          last_error: string | null
          lead_minutes: number
          recipient_profile_id: string
          reminder_type: Database["public"]["Enums"]["class_reminder_type"]
          resend_email_id: string | null
          scheduled_for: string
          sent_at: string | null
          status: Database["public"]["Enums"]["class_reminder_status"]
          updated_at: string
        }
        Insert: {
          attempts?: number
          class_id: string
          created_at?: string
          id?: string
          last_error?: string | null
          lead_minutes?: number
          recipient_profile_id: string
          reminder_type: Database["public"]["Enums"]["class_reminder_type"]
          resend_email_id?: string | null
          scheduled_for: string
          sent_at?: string | null
          status?: Database["public"]["Enums"]["class_reminder_status"]
          updated_at?: string
        }
        Update: {
          attempts?: number
          class_id?: string
          created_at?: string
          id?: string
          last_error?: string | null
          lead_minutes?: number
          recipient_profile_id?: string
          reminder_type?: Database["public"]["Enums"]["class_reminder_type"]
          resend_email_id?: string | null
          scheduled_for?: string
          sent_at?: string | null
          status?: Database["public"]["Enums"]["class_reminder_status"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "class_reminders_class_id_fkey"
            columns: ["class_id"]
            isOneToOne: false
            referencedRelation: "classes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "class_reminders_recipient_profile_id_fkey"
            columns: ["recipient_profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      class_reminder_settings: {
        Row: {
          first_enabled: boolean
          first_lead_minutes: number
          second_enabled: boolean
          second_lead_minutes: number
          singleton: boolean
          updated_at: string
        }
        Insert: {
          first_enabled?: boolean
          first_lead_minutes?: number
          second_enabled?: boolean
          second_lead_minutes?: number
          singleton?: boolean
          updated_at?: string
        }
        Update: {
          first_enabled?: boolean
          first_lead_minutes?: number
          second_enabled?: boolean
          second_lead_minutes?: number
          singleton?: boolean
          updated_at?: string
        }
        Relationships: []
      }
      classes: {
        Row: {
          capacity: number
          created_at: string
          cycle_id: string
          description: string | null
          ends_at: string
          id: string
          meeting_url: string | null
          starts_at: string
          status: Database["public"]["Enums"]["class_status"]
          teacher_id: string
          title: string
          updated_at: string
        }
        Insert: {
          capacity: number
          created_at?: string
          cycle_id: string
          description?: string | null
          ends_at: string
          id?: string
          meeting_url?: string | null
          starts_at: string
          status?: Database["public"]["Enums"]["class_status"]
          teacher_id: string
          title: string
          updated_at?: string
        }
        Update: {
          capacity?: number
          created_at?: string
          cycle_id?: string
          description?: string | null
          ends_at?: string
          id?: string
          meeting_url?: string | null
          starts_at?: string
          status?: Database["public"]["Enums"]["class_status"]
          teacher_id?: string
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "classes_cycle_id_fkey"
            columns: ["cycle_id"]
            isOneToOne: false
            referencedRelation: "weekly_cycles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "classes_teacher_id_fkey"
            columns: ["teacher_id"]
            isOneToOne: false
            referencedRelation: "teachers"
            referencedColumns: ["id"]
          },
        ]
      }
      contact_events: {
        Row: {
          actor_profile_id: string | null
          created_at: string
          event_type: Database["public"]["Enums"]["contact_event_type"]
          guardian_id: string
          id: string
          metadata: Json
        }
        Insert: {
          actor_profile_id?: string | null
          created_at?: string
          event_type: Database["public"]["Enums"]["contact_event_type"]
          guardian_id: string
          id?: string
          metadata?: Json
        }
        Update: {
          actor_profile_id?: string | null
          created_at?: string
          event_type?: Database["public"]["Enums"]["contact_event_type"]
          guardian_id?: string
          id?: string
          metadata?: Json
        }
        Relationships: [
          {
            foreignKeyName: "contact_events_actor_profile_id_fkey"
            columns: ["actor_profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "contact_events_guardian_id_fkey"
            columns: ["guardian_id"]
            isOneToOne: false
            referencedRelation: "guardians"
            referencedColumns: ["id"]
          },
        ]
      }
      contact_tracking: {
        Row: {
          assigned_to: string | null
          attendance_status: Database["public"]["Enums"]["contact_attendance_status"]
          booked_at: string | null
          created_at: string
          first_contact_at: string | null
          guardian_id: string
          id: string
          invitation_sent_at: string | null
          notes: string | null
          registered_from_public_at: string | null
          response_status: Database["public"]["Enums"]["contact_response_status"]
          updated_at: string
        }
        Insert: {
          assigned_to?: string | null
          attendance_status?: Database["public"]["Enums"]["contact_attendance_status"]
          booked_at?: string | null
          created_at?: string
          first_contact_at?: string | null
          guardian_id: string
          id?: string
          invitation_sent_at?: string | null
          notes?: string | null
          registered_from_public_at?: string | null
          response_status?: Database["public"]["Enums"]["contact_response_status"]
          updated_at?: string
        }
        Update: {
          assigned_to?: string | null
          attendance_status?: Database["public"]["Enums"]["contact_attendance_status"]
          booked_at?: string | null
          created_at?: string
          first_contact_at?: string | null
          guardian_id?: string
          id?: string
          invitation_sent_at?: string | null
          notes?: string | null
          registered_from_public_at?: string | null
          response_status?: Database["public"]["Enums"]["contact_response_status"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "contact_tracking_assigned_to_fkey"
            columns: ["assigned_to"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "contact_tracking_guardian_id_fkey"
            columns: ["guardian_id"]
            isOneToOne: true
            referencedRelation: "guardians"
            referencedColumns: ["id"]
          },
        ]
      }
      guardian_cycle_invitations: {
        Row: {
          access_token: string | null
          active: boolean
          activated_at: string | null
          created_at: string
          created_by: string | null
          cycle_id: string
          expires_at: string | null
          guardian_id: string
          id: string
          token_hash: string
        }
        Insert: {
          active?: boolean
          created_at?: string
          created_by?: string | null
          cycle_id: string
          expires_at?: string | null
          guardian_id: string
          id?: string
          token_hash: string
        }
        Update: {
          active?: boolean
          created_at?: string
          created_by?: string | null
          cycle_id?: string
          expires_at?: string | null
          guardian_id?: string
          id?: string
          token_hash?: string
        }
        Relationships: [
          {
            foreignKeyName: "guardian_cycle_invitations_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "guardian_cycle_invitations_cycle_id_fkey"
            columns: ["cycle_id"]
            isOneToOne: false
            referencedRelation: "weekly_cycles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "guardian_cycle_invitations_guardian_id_fkey"
            columns: ["guardian_id"]
            isOneToOne: false
            referencedRelation: "guardians"
            referencedColumns: ["id"]
          },
        ]
      }
      guardians: {
        Row: {
          active: boolean
          created_at: string
          full_name: string | null
          id: string
          phone: string
          updated_at: string
        }
        Insert: {
          access_token?: string | null
          active?: boolean
          activated_at?: string | null
          created_at?: string
          full_name?: string | null
          id?: string
          phone: string
          updated_at?: string
        }
        Update: {
          access_token?: string | null
          active?: boolean
          activated_at?: string | null
          created_at?: string
          full_name?: string | null
          id?: string
          phone?: string
          updated_at?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          active: boolean
          created_at: string
          full_name: string
          id: string
          role: Database["public"]["Enums"]["app_role"]
          updated_at: string
        }
        Insert: {
          active?: boolean
          created_at?: string
          full_name: string
          id: string
          role: Database["public"]["Enums"]["app_role"]
          updated_at?: string
        }
        Update: {
          active?: boolean
          created_at?: string
          full_name?: string
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          updated_at?: string
        }
        Relationships: []
      }
      platform_activity: {
        Row: {
          action: "created" | "updated" | "deleted"
          actor_profile_id: string | null
          created_at: string
          entity_id: string | null
          entity_type: string
          id: string
          metadata: Json
          subject: string
        }
        Insert: {
          action: "created" | "updated" | "deleted"
          actor_profile_id?: string | null
          created_at?: string
          entity_id?: string | null
          entity_type: string
          id?: string
          metadata?: Json
          subject: string
        }
        Update: {
          action?: "created" | "updated" | "deleted"
          actor_profile_id?: string | null
          created_at?: string
          entity_id?: string | null
          entity_type?: string
          id?: string
          metadata?: Json
          subject?: string
        }
        Relationships: [
          {
            foreignKeyName: "platform_activity_actor_profile_id_fkey"
            columns: ["actor_profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      registrations: {
        Row: {
          attendance_marked_at: string | null
          attendance_marked_by: string | null
          class_id: string
          confirmed_at: string | null
          created_at: string
          cycle_id: string
          id: string
          status: Database["public"]["Enums"]["registration_status"]
          student_id: string
          updated_at: string
        }
        Insert: {
          attendance_marked_at?: string | null
          attendance_marked_by?: string | null
          class_id: string
          confirmed_at?: string | null
          created_at?: string
          cycle_id: string
          id?: string
          status?: Database["public"]["Enums"]["registration_status"]
          student_id: string
          updated_at?: string
        }
        Update: {
          attendance_marked_at?: string | null
          attendance_marked_by?: string | null
          class_id?: string
          confirmed_at?: string | null
          created_at?: string
          cycle_id?: string
          id?: string
          status?: Database["public"]["Enums"]["registration_status"]
          student_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "registrations_attendance_marked_by_fkey"
            columns: ["attendance_marked_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "registrations_class_matches_cycle_fkey"
            columns: ["class_id", "cycle_id"]
            isOneToOne: false
            referencedRelation: "classes"
            referencedColumns: ["id", "cycle_id"]
          },
          {
            foreignKeyName: "registrations_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "students"
            referencedColumns: ["id"]
          },
        ]
      }
      students: {
        Row: {
          active: boolean
          created_at: string
          full_name: string
          guardian_id: string
          id: string
          updated_at: string
        }
        Insert: {
          active?: boolean
          created_at?: string
          full_name: string
          guardian_id: string
          id?: string
          updated_at?: string
        }
        Update: {
          active?: boolean
          created_at?: string
          full_name?: string
          guardian_id?: string
          id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "students_guardian_id_fkey"
            columns: ["guardian_id"]
            isOneToOne: false
            referencedRelation: "guardians"
            referencedColumns: ["id"]
          },
        ]
      }
      teachers: {
        Row: {
          active: boolean
          available_days: number[]
          available_from: string | null
          available_until: string | null
          avatar_path: string | null
          created_at: string
          display_name: string
          id: string
          notification_email: string | null
          profile_id: string
          updated_at: string
        }
        Insert: {
          active?: boolean
          available_days?: number[]
          available_from?: string | null
          available_until?: string | null
          avatar_path?: string | null
          created_at?: string
          display_name: string
          id?: string
          notification_email?: string | null
          profile_id: string
          updated_at?: string
        }
        Update: {
          active?: boolean
          available_days?: number[]
          available_from?: string | null
          available_until?: string | null
          avatar_path?: string | null
          created_at?: string
          display_name?: string
          id?: string
          notification_email?: string | null
          profile_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "teachers_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: true
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      weekly_cycles: {
        Row: {
          closed_at: string | null
          created_at: string
          ends_at: string
          id: string
          name: string
          opened_at: string | null
          registration_closes_at: string
          registration_opens_at: string
          starts_at: string
          status: Database["public"]["Enums"]["weekly_cycle_status"]
          updated_at: string
        }
        Insert: {
          closed_at?: string | null
          created_at?: string
          ends_at: string
          id?: string
          name: string
          opened_at?: string | null
          registration_closes_at: string
          registration_opens_at: string
          starts_at: string
          status?: Database["public"]["Enums"]["weekly_cycle_status"]
          updated_at?: string
        }
        Update: {
          closed_at?: string | null
          created_at?: string
          ends_at?: string
          id?: string
          name?: string
          opened_at?: string | null
          registration_closes_at?: string
          registration_opens_at?: string
          starts_at?: string
          status?: Database["public"]["Enums"]["weekly_cycle_status"]
          updated_at?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      admin_teacher_candidates: {
        Args: never
        Returns: {
          email: string
          full_name: string
          profile_id: string
        }[]
      }
      admin_teacher_directory: {
        Args: never
        Returns: {
          active: boolean
          available_days: number[]
          available_from: string | null
          available_until: string | null
          avatar_path: string | null
          display_name: string
          email: string
          full_name: string
          notification_email: string | null
          profile_id: string
          teacher_id: string
        }[]
      }
      activate_guardian_cycle_access: {
        Args: {
          p_access_token: string
          p_full_name: string
          p_phone: string
          p_student_names: Json
          p_token_hash: string
        }
        Returns: {
          access_token: string
        }[]
      }
      book_guardian_classes: {
        Args: { p_guardian_name?: string | null; selections: Json; token_hash: string }
        Returns: undefined
      }
      claim_due_class_reminders: {
        Args: { p_now?: string }
        Returns: {
          class_ends_at: string
          class_id: string
          class_starts_at: string
          class_title: string
          guardian_count: number
          lead_minutes: number
          recipient_email: string
          recipient_name: string
          reminder_id: string
          reminder_type: Database["public"]["Enums"]["class_reminder_type"]
          student_count: number
          teacher_name: string
        }[]
      }
      complete_class_reminder: {
        Args: { reminder_id: string; resend_email_id: string }
        Returns: undefined
      }
      create_guardian_cycle_invitation: {
        Args: {
          p_cycle_id: string
          p_guardian_id: string
          p_token_hash: string
        }
        Returns: undefined
      }
      create_guardian_with_students: {
        Args: {
          p_full_name: string
          p_phone: string
          p_student_names: Json
        }
        Returns: string
      }
      create_pending_guardian: {
        Args: { p_phone: string }
        Returns: string
      }
      current_teacher_id: { Args: never; Returns: string }
      current_user_role: {
        Args: never
        Returns: Database["public"]["Enums"]["app_role"]
      }
      delete_class: { Args: { p_class_id: string }; Returns: undefined }
      delete_cycle: { Args: { p_cycle_id: string }; Returns: undefined }
      delete_guardian: { Args: { p_guardian_id: string }; Returns: undefined }
      delete_student: { Args: { p_student_id: string }; Returns: undefined }
      delete_teacher: { Args: { p_teacher_id: string }; Returns: undefined }
      fail_class_reminder: {
        Args: { error_message: string; reminder_id: string }
        Returns: undefined
      }
      get_guardian_meeting_access: {
        Args: {
          requested_class_id: string
          requested_student_id: string
          token_hash: string
        }
        Returns: string
      }
      get_general_registration_welcome: {
        Args: never
        Returns: {
          cycle_name: string
          registration_open: boolean
        }[]
      }
      get_guardian_registration_context: {
        Args: { token_hash: string }
        Returns: {
          classes: Json
          cycle_id: string
          cycle_name: string
          cycle_status: Database["public"]["Enums"]["weekly_cycle_status"]
          guardian_name: string | null
          registration_open: boolean
          students: Json
        }[]
      }
      get_guardian_waiting_room: {
        Args: { token_hash: string }
        Returns: {
          classes: Json
          guardian_name: string | null
        }[]
      }
      invoke_class_reminder_function: { Args: never; Returns: undefined }
      is_admin: { Args: never; Returns: boolean }
      is_assigned_student: { Args: { p_student_id: string }; Returns: boolean }
      is_contact_manager: { Args: never; Returns: boolean }
      is_internal_user: { Args: never; Returns: boolean }
      list_contact_guardians: {
        Args: {
          p_active?: boolean | null
          p_limit?: number
          p_offset?: number
          p_search?: string | null
        }
        Returns: {
          access_token: string | null
          active: boolean
          full_name: string | null
          id: string
          phone: string
          student_count: number
          total_count: number
        }[]
      }
      record_class_attendance: {
        Args: { p_class_id: string; p_entries: Json }
        Returns: undefined
      }
      registration_consumes_capacity: {
        Args: { p_status: Database["public"]["Enums"]["registration_status"] }
        Returns: boolean
      }
      update_class_reminder_settings: {
        Args: {
          p_first_enabled: boolean
          p_first_lead_minutes: number
          p_second_enabled: boolean
          p_second_lead_minutes: number
        }
        Returns: undefined
      }
    }
    Enums: {
      app_role: "admin"
      class_reminder_status:
        | "pending"
        | "processing"
        | "sent"
        | "failed"
        | "cancelled"
      class_reminder_type:
        | "teacher_24h"
        | "teacher_3h"
        | "manager_24h"
        | "manager_3h"
      class_status: "draft" | "published" | "cancelled" | "completed"
      contact_attendance_status: "not_recorded" | "attended" | "did_not_attend"
      contact_event_type:
        | "contacted"
        | "invitation_sent"
        | "response_updated"
        | "booking_created"
        | "whatsapp_opened"
        | "attendance_updated"
        | "note_added"
        | "manager_assigned"
        | "registered_from_form"
      contact_response_status:
        | "not_contacted"
        | "contacted"
        | "no_response"
        | "interested"
        | "declined"
        | "booked"
        | "registered"
      registration_status:
        | "pending"
        | "confirmed"
        | "cancelled"
        | "attended"
        | "absent"
      weekly_cycle_status: "draft" | "open" | "closed" | "archived"
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
  graphql_public: {
    Enums: {},
  },
  public: {
    Enums: {
      app_role: ["admin"],
      class_reminder_status: [
        "pending",
        "processing",
        "sent",
        "failed",
        "cancelled",
      ],
      class_reminder_type: [
        "teacher_24h",
        "teacher_3h",
        "manager_24h",
        "manager_3h",
      ],
      class_status: ["draft", "published", "cancelled", "completed"],
      contact_attendance_status: ["not_recorded", "attended", "did_not_attend"],
      contact_event_type: [
        "contacted",
        "invitation_sent",
        "response_updated",
        "booking_created",
        "whatsapp_opened",
        "attendance_updated",
        "note_added",
        "manager_assigned",
        "registered_from_form",
      ],
      contact_response_status: [
        "not_contacted",
        "contacted",
        "no_response",
        "interested",
        "declined",
        "booked",
        "registered",
      ],
      registration_status: [
        "pending",
        "confirmed",
        "cancelled",
        "attended",
        "absent",
      ],
      weekly_cycle_status: ["draft", "open", "closed", "archived"],
    },
  },
} as const
