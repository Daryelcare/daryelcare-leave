// Types for the Supabase database, in the shape supabase-js v2 expects
// (Tables / Views / Functions / Enums / CompositeTypes, each table with
// Row / Insert / Update / Relationships).
//
// These are written by hand from the columns the app reads and writes. If you
// change the schema, regenerate with:
//   npx supabase gen types typescript --project-id <project-ref> > lib/database.types.ts

export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[]

// Build a table definition from its row type and the columns that must be
// supplied on insert (everything else is optional on insert).
type TableDef<Row, Required extends keyof Row> = {
  Row: Row
  Insert: Pick<Row, Required> & Partial<Omit<Row, Required>>
  Update: Partial<Row>
  Relationships: []
}

export type BranchRow = {
  id: string
  name: string
  created_at: string
}

export type EmployeeRow = {
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

export type LeaveRequestRow = {
  id: string
  employee_id: string
  employee_name: string
  branch: string
  type: string
  // Dates are stored as DD/MM/YYYY text
  start_date: string
  end_date: string
  duration: number
  remaining: number | null
  status: string
  reason: string | null
  submitted_date: string
  added_by: string | null
  created_at: string
  // Added by 20261113_add_leave_decision_fields.sql (may be missing until it's run)
  admin_notes?: string | null
  decided_by?: string | null
  decided_at?: string | null
}

export type DocumentRow = {
  id: string
  employee_id: string
  employee_name: string
  branch: string
  status: string
  country: string | null
  // Expiry dates are stored as DD/MM/YYYY text
  passport_expiry: string | null
  passport_days_left: number | null
  right_to_work_expiry: string | null
  right_to_work_days_left: number | null
  brp_expiry: string | null
  brp_days_left: number | null
  other_document_type: string | null
  other_document_expiry: string | null
  other_document_days_left: number | null
  is_sponsored: boolean | null
  is_20_hours: boolean | null
  created_at: string
}

export type UserRow = {
  id: string
  email: string
  name: string | null
  role: "admin" | "normal"
  branches: string[] | null
  created_at: string
}

export type LeaveTypeRow = {
  id: string
  name: string
  description: string | null
  color: string | null
  default_days: number | null
  is_paid: boolean | null
  requires_approval: boolean | null
  allow_negative_balance: boolean | null
  is_active: boolean | null
  created_at: string
}

export type LeavePeriodRow = {
  id: string
  start_date: string
  end_date: string
  is_active: boolean | null
  created_at: string
}

export type Database = {
  public: {
    Tables: {
      branches: TableDef<BranchRow, "name">
      employees: TableDef<EmployeeRow, "name" | "employee_code" | "job_title" | "branch">
      leave_requests: TableDef<
        LeaveRequestRow,
        "employee_id" | "employee_name" | "branch" | "type" | "start_date" | "end_date" | "duration" | "status"
      >
      documents: TableDef<DocumentRow, "employee_id" | "employee_name" | "branch" | "status">
      users: TableDef<UserRow, "id" | "email">
      leave_types: TableDef<LeaveTypeRow, "name">
      leave_periods: TableDef<LeavePeriodRow, "start_date" | "end_date">
    }
    Views: { [_ in never]: never }
    Functions: {
      create_new_leave_period: {
        Args: { start_date: string; end_date: string }
        Returns: string
      }
    }
    Enums: { [_ in never]: never }
    CompositeTypes: { [_ in never]: never }
  }
}
