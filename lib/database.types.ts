export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[]

export interface Database {
  public: {
    Tables: {
      branches: {
        Row: {
          id: string
          name: string
          created_at: string
        }
        Insert: {
          id?: string
          name: string
          created_at?: string
        }
        Update: {
          id?: string
          name?: string
          created_at?: string
        }
      }
      employees: {
        Row: {
          id: string
          name: string
          employee_code: string
          job_title: string
          branch: string
          days_taken: number
          days_remaining: number
          hours: number | null
          email: string | null
          phone: string | null
          status: string
          created_at: string
        }
        Insert: {
          id?: string
          name: string
          employee_code: string
          job_title: string
          branch: string
          days_taken?: number
          days_remaining?: number
          hours?: number | null
          email?: string | null
          phone?: string | null
          status?: string
          created_at?: string
        }
        Update: {
          id?: string
          name?: string
          employee_code?: string
          job_title?: string
          branch?: string
          days_taken?: number
          days_remaining?: number
          hours?: number | null
          email?: string | null
          phone?: string | null
          status?: string
          created_at?: string
        }
      }
      leave_requests: {
        Row: {
          id: string
          employee_id: string
          employee_name: string
          branch: string
          type: string
          start_date: string
          end_date: string
          duration: number
          remaining: number
          status: string
          reason: string | null
          submitted_date: string
          created_at: string
        }
        Insert: {
          id?: string
          employee_id: string
          employee_name: string
          branch: string
          type: string
          start_date: string
          end_date: string
          duration: number
          remaining: number
          status?: string
          reason?: string | null
          submitted_date?: string
          created_at?: string
        }
        Update: {
          id?: string
          employee_id?: string
          employee_name?: string
          branch?: string
          type?: string
          start_date?: string
          end_date?: string
          duration?: number
          remaining?: number
          status?: string
          reason?: string | null
          submitted_date?: string
          created_at?: string
        }
      }
      documents: {
        Row: {
          id: string
          employee_id: string
          employee_name: string
          branch: string
          status: string
          country: string
          passport_expiry: string
          passport_days_left: number
          right_to_work_expiry: string
          right_to_work_days_left: number
          document_type: string
          created_at: string
        }
        Insert: {
          id?: string
          employee_id: string
          employee_name: string
          branch: string
          status: string
          country: string
          passport_expiry: string
          passport_days_left: number
          right_to_work_expiry: string
          right_to_work_days_left: number
          document_type: string
          created_at?: string
        }
        Update: {
          id?: string
          employee_id?: string
          employee_name?: string
          branch?: string
          status?: string
          country?: string
          passport_expiry?: string
          passport_days_left?: number
          right_to_work_expiry?: string
          right_to_work_days_left?: number
          document_type?: string
          created_at?: string
        }
      }
      users: {
        Row: {
          id: string
          email: string
          name: string | null
          role: string
          branches: string[]
          created_at: string
        }
        Insert: {
          id?: string
          email: string
          name?: string | null
          role?: string
          branches?: string[]
          created_at?: string
        }
        Update: {
          id?: string
          email?: string
          name?: string | null
          role?: string
          branches?: string[]
          created_at?: string
        }
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      [_ in never]: never
    }
    Enums: {
      [_ in never]: never
    }
  }
}
