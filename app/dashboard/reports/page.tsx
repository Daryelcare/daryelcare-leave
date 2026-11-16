import type { Metadata } from "next"
import { LeaveReportsForm } from "@/components/leave-reports-form"
import { PermissionGate } from "@/components/permission-gate"

export const metadata: Metadata = {
  title: "Reports",
  description: "Export leave reports",
}

export default function ReportsPage() {
  return (
    <PermissionGate permission="reports" title="Reports">
      <LeaveReportsForm />
    </PermissionGate>
  )
}
