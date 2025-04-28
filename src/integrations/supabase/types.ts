export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  public: {
    Tables: {
      archived_leaves: {
        Row: {
          archived_at: string | null
          created_at: string | null
          created_by: string
          duration: number
          employee_id: string
          end_date: string
          id: string
          leave_type: string
          leave_year_id: string
          notes: string | null
          start_date: string
        }
        Insert: {
          archived_at?: string | null
          created_at?: string | null
          created_by: string
          duration: number
          employee_id: string
          end_date: string
          id?: string
          leave_type: string
          leave_year_id: string
          notes?: string | null
          start_date: string
        }
        Update: {
          archived_at?: string | null
          created_at?: string | null
          created_by?: string
          duration?: number
          employee_id?: string
          end_date?: string
          id?: string
          leave_type?: string
          leave_year_id?: string
          notes?: string | null
          start_date?: string
        }
        Relationships: [
          {
            foreignKeyName: "archived_leaves_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "archived_leaves_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "employee_leave_summary"
            referencedColumns: ["employee_id"]
          },
          {
            foreignKeyName: "archived_leaves_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "archived_leaves_leave_year_id_fkey"
            columns: ["leave_year_id"]
            isOneToOne: false
            referencedRelation: "leave_years"
            referencedColumns: ["id"]
          },
        ]
      }
      branches: {
        Row: {
          created_at: string | null
          id: string
          name: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          name: string
        }
        Update: {
          created_at?: string | null
          id?: string
          name?: string
        }
        Relationships: []
      }
      document_tracker: {
        Row: {
          branch: string | null
          brp_expiry: string | null
          check_interval_days: number | null
          country: string | null
          created_at: string | null
          employee_id: string
          employee_name: string
          id: string
          is_sponsored: boolean | null
          last_checked: string | null
          notes: string | null
          other_document_expiry: string | null
          other_document_type: string | null
          passport_expiry: string | null
          right_to_work_expiry: string | null
          status: string
          updated_at: string | null
        }
        Insert: {
          branch?: string | null
          brp_expiry?: string | null
          check_interval_days?: number | null
          country?: string | null
          created_at?: string | null
          employee_id: string
          employee_name: string
          id?: string
          is_sponsored?: boolean | null
          last_checked?: string | null
          notes?: string | null
          other_document_expiry?: string | null
          other_document_type?: string | null
          passport_expiry?: string | null
          right_to_work_expiry?: string | null
          status: string
          updated_at?: string | null
        }
        Update: {
          branch?: string | null
          brp_expiry?: string | null
          check_interval_days?: number | null
          country?: string | null
          created_at?: string | null
          employee_id?: string
          employee_name?: string
          id?: string
          is_sponsored?: boolean | null
          last_checked?: string | null
          notes?: string | null
          other_document_expiry?: string | null
          other_document_type?: string | null
          passport_expiry?: string | null
          right_to_work_expiry?: string | null
          status?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "document_tracker_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "employee_leave_summary"
            referencedColumns: ["employee_id"]
          },
          {
            foreignKeyName: "document_tracker_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
        ]
      }
      employees: {
        Row: {
          branch_id: string
          created_at: string | null
          days_remaining: number | null
          days_taken: number | null
          employee_code: string | null
          full_name: string
          id: string
          is_active: boolean
          job_title: string | null
        }
        Insert: {
          branch_id: string
          created_at?: string | null
          days_remaining?: number | null
          days_taken?: number | null
          employee_code?: string | null
          full_name: string
          id?: string
          is_active?: boolean
          job_title?: string | null
        }
        Update: {
          branch_id?: string
          created_at?: string | null
          days_remaining?: number | null
          days_taken?: number | null
          employee_code?: string | null
          full_name?: string
          id?: string
          is_active?: boolean
          job_title?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "employees_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "branches"
            referencedColumns: ["id"]
          },
        ]
      }
      leave_years: {
        Row: {
          created_at: string | null
          end_date: string
          id: string
          is_current: boolean
          start_date: string
        }
        Insert: {
          created_at?: string | null
          end_date: string
          id?: string
          is_current?: boolean
          start_date: string
        }
        Update: {
          created_at?: string | null
          end_date?: string
          id?: string
          is_current?: boolean
          start_date?: string
        }
        Relationships: []
      }
      leaves: {
        Row: {
          created_at: string | null
          created_by: string
          duration: number
          employee_id: string
          end_date: string
          id: string
          leave_type: string
          leave_year_id: string
          notes: string | null
          start_date: string
        }
        Insert: {
          created_at?: string | null
          created_by: string
          duration: number
          employee_id: string
          end_date: string
          id?: string
          leave_type: string
          leave_year_id: string
          notes?: string | null
          start_date: string
        }
        Update: {
          created_at?: string | null
          created_by?: string
          duration?: number
          employee_id?: string
          end_date?: string
          id?: string
          leave_type?: string
          leave_year_id?: string
          notes?: string | null
          start_date?: string
        }
        Relationships: [
          {
            foreignKeyName: "leaves_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "leaves_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "employee_leave_summary"
            referencedColumns: ["employee_id"]
          },
          {
            foreignKeyName: "leaves_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "leaves_leave_year_id_fkey"
            columns: ["leave_year_id"]
            isOneToOne: false
            referencedRelation: "leave_years"
            referencedColumns: ["id"]
          },
        ]
      }
      settings: {
        Row: {
          company_name: string
          created_at: string
          default_leave_allocation: number
          email_notifications: boolean
          fiscal_year_start: string
          id: string
          sick_leave_allocation: number
          updated_at: string
        }
        Insert: {
          company_name?: string
          created_at?: string
          default_leave_allocation?: number
          email_notifications?: boolean
          fiscal_year_start?: string
          id?: string
          sick_leave_allocation?: number
          updated_at?: string
        }
        Update: {
          company_name?: string
          created_at?: string
          default_leave_allocation?: number
          email_notifications?: boolean
          fiscal_year_start?: string
          id?: string
          sick_leave_allocation?: number
          updated_at?: string
        }
        Relationships: []
      }
      user_branches: {
        Row: {
          branch_id: string
          created_at: string
          id: string
          user_id: string
        }
        Insert: {
          branch_id: string
          created_at?: string
          id?: string
          user_id: string
        }
        Update: {
          branch_id?: string
          created_at?: string
          id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_branches_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "branches"
            referencedColumns: ["id"]
          },
        ]
      }
      users: {
        Row: {
          branch_id: string | null
          created_at: string | null
          email: string
          id: string
          inactive: boolean | null
          role: string
        }
        Insert: {
          branch_id?: string | null
          created_at?: string | null
          email: string
          id: string
          inactive?: boolean | null
          role: string
        }
        Update: {
          branch_id?: string | null
          created_at?: string | null
          email?: string
          id?: string
          inactive?: boolean | null
          role?: string
        }
        Relationships: [
          {
            foreignKeyName: "users_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "branches"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      employee_leave_summary: {
        Row: {
          branch_id: string | null
          employee_id: string | null
          total_annual_leave: number | null
          total_sick_leave: number | null
          total_unpaid_leave: number | null
          total_working_leave: number | null
        }
        Relationships: [
          {
            foreignKeyName: "employees_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "branches"
            referencedColumns: ["id"]
          },
        ]
      }
      sponsored_employees: {
        Row: {
          branch: string | null
          branch_name: string | null
          brp_expiry: string | null
          check_interval_days: number | null
          country: string | null
          created_at: string | null
          employee_code: string | null
          employee_id: string | null
          employee_name: string | null
          id: string | null
          is_sponsored: boolean | null
          job_title: string | null
          last_checked: string | null
          notes: string | null
          other_document_expiry: string | null
          other_document_type: string | null
          passport_expiry: string | null
          right_to_work_expiry: string | null
          status: string | null
          updated_at: string | null
        }
        Relationships: [
          {
            foreignKeyName: "document_tracker_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "employee_leave_summary"
            referencedColumns: ["employee_id"]
          },
          {
            foreignKeyName: "document_tracker_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Functions: {
      calculate_total_leave_days: {
        Args: {
          p_employee_id: string
          p_leave_year_id: string
          p_exclude_leave_id?: string
        }
        Returns: number
      }
      check_leave_in_current_year: {
        Args: { p_start_date: string; p_end_date: string }
        Returns: boolean
      }
      check_leave_overlap: {
        Args: {
          p_employee_id: string
          p_start_date: string
          p_end_date: string
          p_leave_id?: string
        }
        Returns: boolean
      }
      create_new_leave_year: {
        Args: { new_start_date: string; new_end_date: string }
        Returns: undefined
      }
      create_user_with_branches: {
        Args: {
          p_email: string
          p_password: string
          p_role: string
          p_branch_names: string[]
        }
        Returns: Json
      }
      get_employee_counts_by_branch: {
        Args: Record<PropertyKey, never>
        Returns: {
          branch_id: string
          count: number
        }[]
      }
      get_employee_leave_balances: {
        Args: { p_user_id: string }
        Returns: {
          employee_id: string
          full_name: string
          branch_id: string
          annual_leave_allocation: number
          sick_leave_allocation: number
          emergency_leave_allocation: number
          annual_leave_taken: number
          sick_leave_taken: number
          emergency_leave_taken: number
        }[]
      }
      get_overdue_sponsored_documents: {
        Args: { days_overdue?: number }
        Returns: {
          id: string
          employee_name: string
          branch: string
          last_checked: string
          check_interval_days: number
          days_since_check: number
        }[]
      }
      get_user_branch_id: {
        Args: Record<PropertyKey, never>
        Returns: string
      }
      gtrgm_compress: {
        Args: { "": unknown }
        Returns: unknown
      }
      gtrgm_decompress: {
        Args: { "": unknown }
        Returns: unknown
      }
      gtrgm_in: {
        Args: { "": unknown }
        Returns: unknown
      }
      gtrgm_options: {
        Args: { "": unknown }
        Returns: undefined
      }
      gtrgm_out: {
        Args: { "": unknown }
        Returns: unknown
      }
      is_admin: {
        Args: Record<PropertyKey, never>
        Returns: boolean
      }
      set_limit: {
        Args: { "": number }
        Returns: number
      }
      show_limit: {
        Args: Record<PropertyKey, never>
        Returns: number
      }
      show_trgm: {
        Args: { "": string }
        Returns: string[]
      }
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DefaultSchema = Database[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof Database },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof Database
  }
    ? keyof (Database[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        Database[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends { schema: keyof Database }
  ? (Database[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      Database[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
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
    | { schema: keyof Database },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof Database
  }
    ? keyof Database[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends { schema: keyof Database }
  ? Database[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
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
    | { schema: keyof Database },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof Database
  }
    ? keyof Database[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends { schema: keyof Database }
  ? Database[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
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
    | { schema: keyof Database },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof Database
  }
    ? keyof Database[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends { schema: keyof Database }
  ? Database[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof Database },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof Database
  }
    ? keyof Database[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends { schema: keyof Database }
  ? Database[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {},
  },
} as const
