import type { Metadata } from "next"
import { LeaveManagementTable } from "@/components/leave-management-table"

export const metadata: Metadata = {
  title: "Leave",
  description: "Leave entries for employees in your branches",
}

export default function LeaveManagementPage() {
  return <LeaveManagementTable />
}
