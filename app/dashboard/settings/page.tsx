import type { Metadata } from "next"
import { SettingsForm } from "@/components/settings-form"
import { AdminSettings } from "@/components/admin-settings"

export const metadata: Metadata = {
  title: "Settings - Annual Leave Management System",
  description: "Manage your account settings",
}

export default function SettingsPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Settings</h1>
        <p className="text-muted-foreground">Manage your account settings and preferences</p>
      </div>
      <SettingsForm />
      <AdminSettings />
    </div>
  )
}
