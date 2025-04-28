import { LoginForm } from "@/components/login-form"
import type { Metadata } from "next"

export const metadata: Metadata = {
  title: "Login - Annual Leave Management System",
  description: "Login to the Annual Leave Management System",
}

export default function LoginPage() {
  return (
    <div className="flex min-h-screen items-center justify-center p-4 bg-gradient-to-br from-purple-600 to-pink-500">
      <LoginForm />
    </div>
  )
}
