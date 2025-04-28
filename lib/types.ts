
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
  remaining: number
  submittedDate?: string
  addedBy: string
}
