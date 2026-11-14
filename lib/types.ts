
export interface Branch {
  id: string
  name: string
  created_at?: string
}

export interface LeaveType {
  id: string
  name: string
  description?: string
  color?: string
  defaultDays?: number
  isPaid?: boolean
  requiresApproval?: boolean
  allowNegativeBalance?: boolean
  isActive?: boolean
}

export interface LeaveRequest {
  id: string
  employeeId: string
  employee: string
  employeeCode?: string
  branch: string
  type: string
  startDate: string
  endDate: string
  duration: number
  reason?: string
  status: string
  remaining: number | null
  submittedDate?: string
  addedBy: string
  /** The admin's note on the last decision (approve / reject) */
  adminNotes?: string | null
  decidedBy?: string | null
  decidedAt?: string | null
}

export type UserRole = "admin" | "normal"

// A person who can log in (row in the `users` table)
export interface User {
  id: string
  email: string
  name?: string
  role: UserRole
  branches: string[]
  createdAt?: string
}

// A member of staff (row in the `employees` table)
export interface Employee {
  id: string
  name: string
  employeeCode: string
  jobTitle: string
  branch: string
  daysTaken: number
  daysRemaining: number
  hours?: number | null
  email?: string
  phone?: string
  status: string
}

// One employee's document record (row in the `documents` table).
// Dates are DD/MM/YYYY strings; days-left values are calculated from them.
export interface EmployeeDocument {
  id: string
  employeeId: string
  employeeName: string
  branch: string
  status: string
  country: string | null
  passportExpiry: string | null
  passportDaysLeft: number | null
  rightToWorkExpiry: string | null
  rightToWorkDaysLeft: number | null
  brpExpiry: string | null
  brpDaysLeft: number | null
  otherDocumentType: string | null
  otherDocumentExpiry: string | null
  otherDocumentDaysLeft: number | null
  isSponsored: boolean
  is20Hours: boolean
}
