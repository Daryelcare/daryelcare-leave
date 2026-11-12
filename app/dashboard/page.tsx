import type { Metadata } from "next"
import { DashboardHome } from "@/components/dashboard-home"

export const metadata: Metadata = {
  title: "Dashboard - DARYELCARE Leave Management",
  description: "Who's off, documents to renew and leave balances to watch",
}

export default function DashboardPage() {
  return <DashboardHome />
}
