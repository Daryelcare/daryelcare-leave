"use client"

// Arrived from a "Forgotten your password?" email: choose a new password.
// Supabase reads the one-time link from the address and starts a short
// recovery session; we set the password, then sign out so the person signs in
// fresh with it.

import { useEffect, useState } from "react"
import Link from "next/link"
import { CheckCircle2, Loader2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { supabase } from "@/lib/supabase"

const MIN = 10

export function ResetPasswordForm() {
  const [ready, setReady] = useState<"checking" | "yes" | "no">("checking")
  const [password, setPassword] = useState("")
  const [confirm, setConfirm] = useState("")
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState("")
  const [done, setDone] = useState(false)

  useEffect(() => {
    const { data } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === "PASSWORD_RECOVERY" || (event === "SIGNED_IN" && session)) setReady("yes")
    })
    // The link may already have been read before this listener was added
    supabase.auth.getSession().then(({ data: s }) => {
      if (s.session) setReady("yes")
    })
    const timer = setTimeout(() => setReady((r) => (r === "checking" ? "no" : r)), 4000)
    return () => {
      data.subscription.unsubscribe()
      clearTimeout(timer)
    }
  }, [])

  const save = async (e: React.FormEvent) => {
    e.preventDefault()
    setError("")
    if (password.length < MIN) return setError(`Use at least ${MIN} characters.`)
    if (password !== confirm) return setError("The two passwords don't match.")
    setSaving(true)
    try {
      const { error: updateError } = await supabase.auth.updateUser({ password })
      if (updateError) throw updateError
      await supabase.auth.signOut()
      setDone(true)
    } catch (err) {
      console.error("Couldn't set the new password:", err)
      setError("Couldn't set your new password. The link may have expired: ask for a new one.")
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="surface w-full max-w-[420px] space-y-5 p-6 sm:p-8">
      <div className="space-y-1">
        <h1 className="font-display text-2xl font-semibold tracking-[-0.02em]">Choose a new password</h1>
        <p className="text-sm text-muted-foreground">
          At least {MIN} characters. A short sentence is easy to remember.
        </p>
      </div>
      {done ? (
        <div className="space-y-4">
          <p className="flex items-center gap-2 text-sm font-semibold text-success">
            <CheckCircle2 className="h-4 w-4" />
            Password changed
          </p>
          <Button asChild className="w-full">
            <Link href="/login">Sign in</Link>
          </Button>
        </div>
      ) : ready === "checking" ? (
        <p className="flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" />
          Checking your link…
        </p>
      ) : ready === "no" ? (
        <div className="space-y-4">
          <p className="text-sm text-muted-foreground">
            This link has expired or was already used. Ask for a new one from the sign-in page.
          </p>
          <Button asChild variant="outline" className="w-full">
            <Link href="/login">Back to sign in</Link>
          </Button>
        </div>
      ) : (
        <form onSubmit={save} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="new-password">New password</Label>
            <Input
              id="new-password"
              type="password"
              autoComplete="new-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="confirm-password">Confirm new password</Label>
            <Input
              id="confirm-password"
              type="password"
              autoComplete="new-password"
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              required
            />
          </div>
          {error && (
            <p className="text-sm font-medium text-destructive" role="alert">
              {error}
            </p>
          )}
          <Button type="submit" className="w-full" disabled={saving}>
            {saving && <Loader2 className="animate-spin" />}
            Set new password
          </Button>
        </form>
      )}
    </div>
  )
}
