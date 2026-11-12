import { redirect } from "next/navigation"

// Managed in Settings now
export default function RedirectToSettings() {
  redirect("/dashboard/settings?section=leave-periods")
}
