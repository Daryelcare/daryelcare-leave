import { redirect } from "next/navigation"

// This page used to show placeholder data. Leave now lives on the Leave page.
export default function MyLeavesPage() {
  redirect("/dashboard/leave-management")
}
