import type { Metadata } from "next"
import { ChangePasswordForm } from "@/components/change-password-form"

export const metadata: Metadata = {
  title: "Change Password - Annual Leave Management System",
  description: "Change your account password",
}

export default function ChangePasswordPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Change Password</h1>
        <p className="text-muted-foreground">Update your account password</p>
      </div>
      <ChangePasswordForm />
    </div>
  )
}
