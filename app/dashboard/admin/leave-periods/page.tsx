import type { Metadata } from "next"
import { LeavePeriodManager } from "@/components/leave-period-manager"

export const metadata: Metadata = {
  title: "Leave Periods - Annual Leave Management System",
  description: "Manage annual leave allocation periods",
}

export default function LeavePeriodPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Leave Periods</h1>
        <p className="text-muted-foreground">Manage annual leave allocation periods and employee allocations</p>
      </div>
      <LeavePeriodManager />
    </div>
  )
}
