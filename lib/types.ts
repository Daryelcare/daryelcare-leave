import type { RtwBasis } from "./rtw"
import type { PermissionOverrides, PermissionSet } from "./permissions"
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
  /** When they last signed in; null = never, undefined = unknown */
  lastSignInAt?: string | null
  /** When they last opened the app; null = not since this was added */
  lastSeenAt?: string | null
  /** What they may do (null until the server has said; everything for admins) */
  permissions?: PermissionSet | null
  /** Admin view of one person's exceptions to the manager settings */
  permissionOverrides?: PermissionOverrides
  /** Must choose a new password before using the app */
  mustChangePassword?: boolean
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
  /** True once the automatic leave year update has been run */
  allowanceTracking?: boolean
  /** Their yearly allowance in days (28 unless set) */
  annualAllowance?: number
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
  /** How their right to work is held (null if not recorded yet) */
  rtwBasis: RtwBasis | null
  /** When right to work was last checked, DD/MM/YYYY */
  rtwCheckedOn: string | null
}

/**
 * One row of the Documents page: every current employee, with their documents
 * record if they have one. `id` is the record's id, or "none:<employeeId>" for
 * someone with nothing on file (then `recordId` is null and `noRecord` true).
 */
export interface TrackerDocument extends EmployeeDocument {
  recordId: string | null
  employeeCode: string | null
  noRecord: boolean
}
