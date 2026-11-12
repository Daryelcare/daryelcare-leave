import type { Metadata } from "next"
import { TeamCalendar } from "@/components/team-calendar"

export const metadata: Metadata = {
  title: "Team Calendar - DARYELCARE Leave Management",
  description: "Who is off, by branch",
}

export default function CalendarPage() {
  return <TeamCalendar />
}
