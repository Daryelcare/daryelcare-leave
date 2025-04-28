"use client"

import type React from "react"
import { useState } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card, CardContent, CardHeader } from "@/components/ui/card"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Loader2, Mail, Lock } from "lucide-react"
import { useApp } from "./app-provider"
import { signIn } from "@/lib/auth"
import Image from "next/image"

export function LoginForm() {
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState("")
  const router = useRouter()
  const { setUser } = useApp()

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsLoading(true)
    setError("")

    try {
      // Sign in with Supabase
      const user = await signIn(email, password)

      if (user) {
        // Ensure we have proper values for all required fields to prevent "Not available" issues
        const userData = {
          id: user.id,
          email: user.email,
          name: user.name || email.split("@")[0], // Use email username as fallback if name is undefined
          role: user.role,
          branches: user.branches || [],
        }

        // Store the user in context and localStorage (AppProvider will handle the localStorage part)
        setUser(userData)

        // Navigate to dashboard
        router.push("/dashboard")
      } else {
        setError("Invalid email or password")
      }
    } catch (err: any) {
      console.error("Sign in error:", err)

      // Provide more user-friendly error messages based on the error
      if (err.message?.includes("Invalid login credentials")) {
        setError("Invalid email or password")
      } else if (err.message?.includes("Email not confirmed")) {
        setError("Please confirm your email address before logging in")
      } else if (err.message?.includes("User profile inconsistency")) {
        setError("There was an issue with your account. Please contact support.")
      } else if (err.message?.includes("Invalid API key")) {
        setError("Authentication service configuration error. Please contact support.")
      } else if (err.message?.includes("Network error")) {
        setError(
          "Unable to connect to the authentication service. Please check your internet connection and try again.",
        )
      } else {
        setError(err.message || "An error occurred during sign in. Please try again.")
      }
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <Card className="w-full max-w-lg overflow-hidden bg-white/95 shadow-xl">
      <CardHeader className="space-y-8 text-center pb-8">
        <div className="flex flex-col items-center">
          <div className="mx-auto w-48 mb-4">
            <Image
              src="/images/daryelcare-logo.jpeg"
              alt="Daryel Care Logo"
              width={200}
              height={200}
              priority
              className="w-full h-auto"
            />
          </div>
          <h2 className="text-3xl font-bold text-gray-800">Leave Management System</h2>
        </div>
      </CardHeader>
      <CardContent className="space-y-6 px-8 pb-8">
        {error && (
          <Alert variant="destructive">
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}
        <form onSubmit={handleSubmit} className="space-y-5">
          <div className="space-y-3">
            <div className="relative">
              <Mail className="absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-gray-500" />
              <Input
                className="pl-12 py-6 rounded-xl text-base"
                type="email"
                placeholder="Email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                disabled={isLoading}
                style={{ borderRadius: "1rem" }}
              />
            </div>
          </div>
          <div className="space-y-3">
            <div className="relative">
              <Lock className="absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-gray-500" />
              <Input
                className="pl-12 py-6 rounded-xl text-base"
                type="password"
                placeholder="Password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                disabled={isLoading}
                style={{ borderRadius: "1rem" }}
              />
            </div>
          </div>
          <Button
            type="submit"
            className="w-full bg-green-600 hover:bg-green-700 text-white font-semibold py-6 rounded-xl text-lg"
            disabled={isLoading}
          >
            {isLoading ? (
              <>
                <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                Signing in...
              </>
            ) : (
              "LOGIN"
            )}
          </Button>
        </form>
      </CardContent>
    </Card>
  )
}
