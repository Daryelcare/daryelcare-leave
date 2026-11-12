import type { Metadata } from "next"
import { ChangePasswordForm } from "@/components/change-password-form"
import { PageHeader } from "@/components/page-kit"

export const metadata: Metadata = {
  title: "Change Password",
  description: "Change your account password",
}

export default function ChangePasswordPage() {
  return (
    <div className="space-y-6 sm:space-y-8">
      <PageHeader title="Change Password" description="Choose a new password for signing in to DaryelCare." />
      <ChangePasswordForm />
    </div>
  )
}
