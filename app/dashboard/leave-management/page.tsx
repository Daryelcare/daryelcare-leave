import { Suspense } from "react"
import type { Metadata } from "next"
import { LeaveManagementTable } from "@/components/leave-management-table"

export const metadata: Metadata = {
  title: "Leave",
  description: "Leave entries and the team calendar for your branches",
}

export default function LeaveManagementPage() {
  // Suspense: the page reads ?view= from the address
  return (
    <Suspense fallback={null}>
      <LeaveManagementTable />
    </Suspense>
  )
}
