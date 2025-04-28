import { LeaveManagementTable } from "@/components/leave-management-table"

export default function LeaveManagementPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Leave Management</h1>
        <p className="text-muted-foreground mt-2">Manage leave requests for employees in your assigned branches.</p>
      </div>
      <LeaveManagementTable />
    </div>
  )
}
