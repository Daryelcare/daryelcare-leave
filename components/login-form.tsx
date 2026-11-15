"use client"

import type React from "react"
import { useState } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { AlertCircle, Eye, EyeOff, Loader2, Lock, Mail } from "lucide-react"
import { useApp } from "./app-provider"
import { signIn } from "@/lib/auth"
import { supabase } from "@/lib/supabase"
import Image from "next/image"

export function LoginForm() {
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState("")
  const [showPassword, setShowPassword] = useState(false)
  const [capsLock, setCapsLock] = useState(false)
  // "Forgotten password?": send a reset link instead of signing in
  const [resetMode, setResetMode] = useState(false)
  const [resetSent, setResetSent] = useState(false)
  const sendReset = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsLoading(true)
    setError("")
    try {
      const { error: resetError } = await supabase.auth.resetPasswordForEmail(email.trim(), {
        redirectTo: `${window.location.origin}/reset-password`,
      })
      if (resetError) throw resetError
      setResetSent(true)
    } catch (err) {
      console.error("Couldn't send a reset link:", err)
      const tooMany = /rate|too many|security purposes/i.test(String((err as Error)?.message))
      setError(
        tooMany
          ? "Too many reset requests. Wait a few minutes and try again."
          : "Couldn't send the reset link. Please try again.",
      )
    } finally {
      setIsLoading(false)
    }
  }
  const watchCaps = (e: React.KeyboardEvent) => setCapsLock(e.getModifierState?.("CapsLock") ?? false)
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
    } catch (caught) {
      const err = caught instanceof Error ? caught : new Error(String(caught))
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
    <div className="w-full max-w-[380px]">
      <div className="mb-8 space-y-2">
        <Image
          src="/images/daryelcare-wordmark.png"
          alt="DaryelCare"
          width={180}
          height={31}
          priority
          className="mb-10 h-[30px] w-auto lg:hidden"
        />
        <h1 className="text-[28px] font-semibold leading-tight tracking-[-0.03em]">Welcome back</h1>
        <p className="text-[15px] text-muted-foreground">Sign in to manage leave, staff and documents.</p>
      </div>

      {error && (
        <Alert variant="destructive" className="mb-5">
          <AlertCircle />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {resetMode ? (
        resetSent ? (
          <div className="space-y-4 rounded-xl bg-muted/60 p-4 text-sm">
            <p className="font-semibold">Check your email</p>
            <p className="text-muted-foreground">
              If {email.trim()} has an account, a link to choose a new password is on its way. It works once and expires
              after an hour.
            </p>
            <Button
              variant="outline"
              className="w-full"
              onClick={() => {
                setResetMode(false)
                setResetSent(false)
              }}
            >
              Back to sign in
            </Button>
          </div>
        ) : (
          <form onSubmit={sendReset} className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Enter the email you sign in with and we&apos;ll send you a link to choose a new password.
            </p>
            <div className="space-y-2">
              <Label htmlFor="reset-email">Email</Label>
              <div className="relative">
                <Mail className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  id="reset-email"
                  className="h-11 pl-10"
                  type="email"
                  autoComplete="email"
                  placeholder="you@company.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  disabled={isLoading}
                />
              </div>
            </div>
            <Button type="submit" size="lg" className="h-11 w-full" disabled={isLoading || !email.trim()}>
              {isLoading && <Loader2 className="animate-spin" />}
              Send reset link
            </Button>
            <Button
              type="button"
              variant="ghost"
              className="w-full"
              onClick={() => {
                setResetMode(false)
                setError("")
              }}
            >
              Back to sign in
            </Button>
          </form>
        )
      ) : (
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="email">Email</Label>
            <div className="relative">
              <Mail className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                id="email"
                className="h-11 pl-10"
                type="email"
                autoComplete="email"
                placeholder="you@company.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                disabled={isLoading}
              />
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="password">Password</Label>
            <div className="relative">
              <Lock className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                id="password"
                className="h-11 pl-10 pr-11"
                type={showPassword ? "text" : "password"}
                autoComplete="current-password"
                placeholder="Your password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                onKeyDown={watchCaps}
                onKeyUp={watchCaps}
                onBlur={() => setCapsLock(false)}
                aria-describedby={capsLock ? "caps-lock" : undefined}
                required
                disabled={isLoading}
              />
              <button
                type="button"
                onClick={() => setShowPassword((v) => !v)}
                className="absolute right-1.5 top-1/2 flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-ring/30"
                aria-label={showPassword ? "Hide password" : "Show password"}
              >
                {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
          </div>
          {capsLock && (
            <p id="caps-lock" className="-mt-2 text-xs font-medium text-warning" role="status">
              Caps Lock is on
            </p>
          )}
          <Button type="submit" size="lg" className="mt-2 h-11 w-full" disabled={isLoading}>
            {isLoading ? (
              <>
                <Loader2 className="animate-spin" />
                Signing in…
              </>
            ) : (
              "Sign in"
            )}
          </Button>
        </form>
      )}

      {!resetMode && (
        <p className="mt-8 text-center text-sm">
          <button
            type="button"
            onClick={() => {
              setResetMode(true)
              setError("")
            }}
            className="-my-2 inline-block py-2 font-semibold text-primary-text hover:underline"
          >
            Forgotten your password?
          </button>
        </p>
      )}
    </div>
  )
}
