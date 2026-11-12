import type { Metadata } from "next"
import { LeavePeriodManager } from "@/components/leave-period-manager"

export const metadata: Metadata = {
  title: "Leave Periods",
  description: "Manage annual leave periods",
}

export default function LeavePeriodPage() {
  return <LeavePeriodManager />
}
