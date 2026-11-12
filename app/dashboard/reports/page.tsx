import type { Metadata } from "next"
import { LeaveReportsForm } from "@/components/leave-reports-form"

export const metadata: Metadata = {
  title: "Reports",
  description: "Export leave reports",
}

export default function ReportsPage() {
  return <LeaveReportsForm />
}
