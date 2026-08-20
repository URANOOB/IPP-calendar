export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
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
      guardians: {
        Row: {
          access_token_hash: string | null
          active: boolean
          created_at: string
          full_name: string
          id: string
          phone: string
          updated_at: string
        }
        Insert: {
          access_token_hash?: string | null
          active?: boolean
          created_at?: string
          full_name: string
          id?: string
          phone: string
          updated_at?: string
        }
        Update: {
          access_token_hash?: string | null
          active?: boolean
          created_at?: string
          full_name?: string
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
      registrations: {
        Row: {
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
          created_at: string
          display_name: string
          id: string
          profile_id: string
          updated_at: string
        }
        Insert: {
          active?: boolean
          created_at?: string
          display_name: string
          id?: string
          profile_id: string
          updated_at?: string
        }
        Update: {
          active?: boolean
          created_at?: string
          display_name?: string
          id?: string
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
          created_at: string
          ends_at: string
          id: string
          name: string
          registration_closes_at: string
          registration_opens_at: string
          starts_at: string
          status: Database["public"]["Enums"]["weekly_cycle_status"]
          updated_at: string
        }
        Insert: {
          created_at?: string
          ends_at: string
          id?: string
          name: string
          registration_closes_at: string
          registration_opens_at: string
          starts_at: string
          status?: Database["public"]["Enums"]["weekly_cycle_status"]
          updated_at?: string
        }
        Update: {
          created_at?: string
          ends_at?: string
          id?: string
          name?: string
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
      current_teacher_id: { Args: never; Returns: string }
      current_user_role: {
        Args: never
        Returns: Database["public"]["Enums"]["app_role"]
      }
      is_admin: { Args: never; Returns: boolean }
      is_contact_manager: { Args: never; Returns: boolean }
      is_internal_user: { Args: never; Returns: boolean }
    }
    Enums: {
      app_role: "admin" | "teacher" | "contact_manager"
      class_status: "draft" | "published" | "cancelled" | "completed"
      contact_attendance_status: "not_recorded" | "attended" | "did_not_attend"
      contact_response_status:
        | "not_contacted"
        | "contacted"
        | "no_response"
        | "interested"
        | "declined"
        | "booked"
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
      app_role: ["admin", "teacher", "contact_manager"],
      class_status: ["draft", "published", "cancelled", "completed"],
      contact_attendance_status: ["not_recorded", "attended", "did_not_attend"],
      contact_response_status: [
        "not_contacted",
        "contacted",
        "no_response",
        "interested",
        "declined",
        "booked",
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

