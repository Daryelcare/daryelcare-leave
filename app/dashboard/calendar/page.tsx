import { redirect } from "next/navigation"

// The team calendar is now a view of the Leave page
export default function CalendarPage() {
  redirect("/dashboard/leave-management?view=calendar")
}
