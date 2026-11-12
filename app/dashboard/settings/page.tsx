import { Suspense } from "react"
import type { Metadata } from "next"
import { SettingsForm } from "@/components/settings-form"

export const metadata: Metadata = {
  title: "Settings",
  description: "Your account, users, branches, leave types and leave periods",
}

export default function SettingsPage() {
  // Suspense: the page reads ?section= from the address
  return (
    <Suspense fallback={null}>
      <SettingsForm />
    </Suspense>
  )
}
