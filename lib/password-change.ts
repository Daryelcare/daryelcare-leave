// "Choose a new password" before using the app: a one-time change for
// everyone, and for accounts an admin creates or resets. Server only.

import { createClient } from "@supabase/supabase-js"
import { supabase } from "./db"
import { columnsExist } from "./column-probe"
import { SUPABASE_ANON_KEY, SUPABASE_URL } from "./supabase"

export const MIN_PASSWORD = 6
export const MAX_PASSWORD = 72 // Supabase's limit

export const passwordFlagExists = () => columnsExist("users", ["must_change_password"])

/** Whether this person must choose a new password (false until the update has been run) */
export async function mustChangePassword(email: string): Promise<boolean> {
  if (!(await passwordFlagExists())) return false
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (supabase.from("users") as any)
    .select("must_change_password")
    .eq("email", email)
    .maybeSingle()
  if (error) {
    console.error("Couldn't read the password-change flag:", error)
    return false
  }
  return data?.must_change_password === true
}

/** Turns the flag on or off for one account (no-op before the update has been run) */
export async function setMustChangePassword(match: { id?: string; email?: string }, value: boolean) {
  if (!(await passwordFlagExists())) return
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let q = (supabase.from("users") as any).update({ must_change_password: value })
  q = match.id ? q.eq("id", match.id) : q.eq("email", match.email)
  const { error } = await q
  if (error) throw error
}

/** A plain-words problem with a new password, or null */
export function passwordProblem(password: unknown, confirm?: unknown): string | null {
  if (typeof password !== "string" || password.length < MIN_PASSWORD) return `Use at least ${MIN_PASSWORD} characters.`
  if (password.length > MAX_PASSWORD) return `Use at most ${MAX_PASSWORD} characters.`
  if (confirm !== undefined && confirm !== password) return "The two passwords don't match."
  return null
}

/**
 * True when this is already their password. Checked by signing in with it on
 * a throwaway client, so no session is kept anywhere.
 */
export async function isCurrentPassword(email: string, password: string): Promise<boolean> {
  const probe = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  })
  const { data, error } = await probe.auth.signInWithPassword({ email, password })
  if (!error && data.session) {
    // Don't leave the probe's session open
    await probe.auth.signOut({ scope: "local" }).catch(() => {})
    return true
  }
  return false
}
