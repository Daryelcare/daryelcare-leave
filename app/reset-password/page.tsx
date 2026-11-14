import type { Metadata } from "next"
import { ResetPasswordForm } from "@/components/reset-password-form"

export const metadata: Metadata = {
  title: "Choose a new password",
  description: "Set a new password for your DaryelCare account",
}

export default function ResetPasswordPage() {
  return (
    <main className="flex min-h-dvh items-center justify-center bg-background px-4 py-10">
      <ResetPasswordForm />
    </main>
  )
}
