import type { Metadata } from "next"
import { LeaveHistoryTable } from "@/components/leave-history-table"

export const metadata: Metadata = {
  title: "My Leaves - Annual Leave Management System",
  description: "View and manage your leave requests",
}

export default function MyLeavesPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">My Leaves</h1>
        <p className="text-muted-foreground">View and manage your leave requests</p>
      </div>
      <LeaveHistoryTable />
    </div>
  )
}
