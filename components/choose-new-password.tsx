"use client"

import { useState } from "react"
import Image from "next/image"
import { Eye, EyeOff, KeyRound, Loader2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { useToast } from "@/components/ui/use-toast"
import { fetchWithAuth, handleApiError } from "@/lib/api-utils"
import { useLogout } from "@/hooks/use-logout"
import { useApp } from "./app-provider"

const MIN = 6

/**
 * Shown instead of the app when someone must choose a new password: the
 * one-time change for everyone, or an account an admin created or reset.
 */
export function ChooseNewPassword() {
  const { user, setUser } = useApp()
  const { toast } = useToast()
  const logout = useLogout()
  const [password, setPassword] = useState("")
  const [confirm, setConfirm] = useState("")
  const [show, setShow] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    if (password.length < MIN) return setError(`Use at least ${MIN} characters.`)
    if (password !== confirm) return setError("The two passwords don't match.")
    setBusy(true)
    try {
      await fetchWithAuth("/api/users/me/password", {
        method: "POST",
        body: JSON.stringify({ password, confirm }),
      })
      toast({ title: "Password changed", description: "Use your new password next time you sign in." })
      if (user) setUser({ ...user, mustChangePassword: false })
    } catch (err) {
      console.error("Couldn't change password:", err)
      setError(handleApiError(err))
    } finally {
      setBusy(false)
    }
  }

  return (
    <main className="flex min-h-svh items-center justify-center bg-background px-4 py-10">
      <form onSubmit={submit} className="surface w-full max-w-[440px] space-y-5 p-7 sm:p-9" noValidate>
        <div className="space-y-3">
          <Image src="/images/daryelcare-mark.png" alt="" width={40} height={40} priority />
          <span className="flex h-11 w-11 items-center justify-center rounded-full bg-secondary text-secondary-foreground">
            <KeyRound className="h-5 w-5" />
          </span>
          <h1 className="text-2xl font-extrabold tracking-[-0.02em]">Choose a new password</h1>
          <p className="text-sm text-muted-foreground">
            {user?.name ? `Hi ${user.name.split(" ")[0]}. ` : ""}Before you carry on, please set a new password for your
            account. You&apos;ll use it from now on.
          </p>
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="new-password">New password</Label>
          <div className="relative">
            <Input
              id="new-password"
              type={show ? "text" : "password"}
              autoComplete="new-password"
              autoFocus
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="pr-11"
              aria-describedby="new-password-hint"
            />
            <button
              type="button"
              onClick={() => setShow((s) => !s)}
              aria-label={show ? "Hide passwords" : "Show passwords"}
              className="absolute right-1 top-1/2 flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-full text-muted-foreground hover:text-foreground"
            >
              {show ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
            </button>
          </div>
          <p id="new-password-hint" className="text-xs text-muted-foreground">
            At least {MIN} characters, and not the one you use now.
          </p>
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="confirm-password">Type it again</Label>
          <Input
            id="confirm-password"
            type={show ? "text" : "password"}
            autoComplete="new-password"
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
          />
        </div>

        {error && (
          <p role="alert" className="rounded-2xl bg-danger-soft px-3.5 py-2.5 text-sm text-destructive">
            {error}
          </p>
        )}

        <Button type="submit" className="w-full" disabled={busy}>
          {busy && <Loader2 className="animate-spin" />}
          Save new password
        </Button>
        <button
          type="button"
          onClick={logout}
          className="mx-auto block text-sm font-semibold text-muted-foreground hover:text-foreground"
        >
          Sign out instead
        </button>
      </form>
    </main>
  )
}
