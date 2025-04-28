/**
 * Shared types for the application
 */

// User types
export type UserRole = "admin" | "normal"

export interface User {
  id: string
  email: string
  name?: string
  role: UserRole
  branches: string[]
  createdAt: string
}

// Employee types
export interface Employee {
  id: string
  name: string
  employeeCode: string
  jobTitle: string
  branch: string
  daysTaken: number
  daysRemaining: number
  hours?: number
  email?: string
  phone?: string
  status: "active" | "inactive"
}

// Leave types
export type LeaveStatus = "Approved" | "Pending" | "Rejected"
export type LeaveType = "Annual" | "Sick" | "Personal" | "Other"

export interface LeaveRequest {
  id: string
  employeeId: string
  employeeCode: string
  employee: string
  branch: string
  type: LeaveType
  startDate: string
  endDate: string
  duration: number
  remaining: number
  status: LeaveStatus
  reason?: string
  submittedDate: string
  addedBy?: string
}

// Document types
export type DocumentStatus = "BRITISH" | "EU" | "NON-EU"

export interface EmployeeDocument {
  id: string
  employeeId: string
  employeeName: string
  branch: string
  status: DocumentStatus
  country: string

  // Document expiry dates
  passportExpiry?: string | null
  passportDaysLeft?: number | null

  rightToWorkExpiry?: string | null
  rightToWorkDaysLeft?: number | null

  brpExpiry?: string | null
  brpDaysLeft?: number | null

  otherDocumentType?: string | null
  otherDocumentExpiry?: string | null
  otherDocumentDaysLeft?: number | null

  isSponsored: boolean
  is20Hours: boolean
}

// Branch types
export interface Branch {
  id: string
  name: string
  createdAt?: string
}

// Leave Type
export interface LeaveType {
  id: string
  name: string
  description: string
  color: string
  defaultDays: number
  isPaid: boolean
  requiresApproval: boolean
  allowNegativeBalance: boolean
  isActive: boolean
  createdAt: string
}
