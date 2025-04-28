import type { Metadata } from "next"
import { DashboardOverview } from "@/components/dashboard-overview"
import { LeaveRequestForm } from "@/components/leave-request-form"
import { UpcomingLeaves } from "@/components/upcoming-leaves"
import { LeaveAllocationCard } from "@/components/leave-allocation-card"

export const metadata: Metadata = {
  title: "Dashboard - Annual Leave Management System",
  description: "Overview of your leave balances and requests",
}

export default function DashboardPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Dashboard</h1>
        <p className="text-muted-foreground">Overview of your leave balances and upcoming requests</p>
      </div>
      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
        <LeaveAllocationCard />
        <DashboardOverview />
      </div>
      <div className="grid gap-6 md:grid-cols-2">
        <LeaveRequestForm />
        <UpcomingLeaves />
      </div>
    </div>
  )
}
