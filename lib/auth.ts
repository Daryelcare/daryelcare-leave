import { supabase } from "./supabase"
import type { User } from "./types"

/**
 * The signed-in person's profile (role, branches) from GET /api/users/me.
 * The users table is locked to the server, so the browser asks for it.
 */
async function fetchOwnProfile(token: string | undefined): Promise<User | null> {
  if (!token) return null
  const res = await fetch("/api/users/me", { headers: { Authorization: `Bearer ${token}` }, cache: "no-store" })
  if (!res.ok) return null
  const p = await res.json()
  return { id: p.id, email: p.email, name: p.name || undefined, role: p.role, branches: p.branches || [] }
}

// Sign in function that works with both Supabase Auth and custom users table
export async function signIn(email: string, password: string): Promise<User | null> {
  try {
    // 1. Authenticate with Supabase Auth
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    })

    if (error) {
      console.error("Authentication error:", error.message)
      throw new Error(error.message)
    }

    if (!data?.user) {
      console.error("No user returned from authentication")
      throw new Error("Authentication failed")
    }

    // 2. Their profile (role and branches) comes from the server, which can
    // read the locked users table; the browser can't
    const profile = await fetchOwnProfile(data.session?.access_token)
    if (!profile) throw new Error("Couldn't load your account. Please try again.")
    return profile
  } catch (error) {
    console.error("Sign in error:", error)
    throw error
  }
}

export async function signOut() {
  try {
    const { error } = await supabase.auth.signOut()
    if (error) {
      throw new Error(error.message)
    }
    return true
  } catch (error) {
    console.error("Error signing out:", error)
    throw error
  }
}

export async function getCurrentUser(): Promise<User | null> {
  try {
    // Get the current user from Supabase Auth
    const {
      data: { user: authUser },
      error: authError,
    } = await supabase.auth.getUser()

    if (authError || !authUser) {
      return null
    }

    // Their role and branches, from the server
    const { data: session } = await supabase.auth.getSession()
    return await fetchOwnProfile(session.session?.access_token)
  } catch (error) {
    console.error("Error getting current user:", error)
    return null
  }
}

// Change the logged-in user's own password. Runs in the browser, where the
// user's Supabase session lives. Checks the current password first.
export async function changeOwnPassword(currentPassword: string, newPassword: string): Promise<void> {
  const { data, error: sessionError } = await supabase.auth.getUser()
  const email = data?.user?.email
  if (sessionError || !email) {
    throw new Error("Your session has expired. Please log out and log in again.")
  }

  const { error: verifyError } = await supabase.auth.signInWithPassword({ email, password: currentPassword })
  if (verifyError) {
    throw new Error("Your current password is incorrect.")
  }

  const { error } = await supabase.auth.updateUser({ password: newPassword })
  if (error) {
    throw new Error(error.message)
  }
}
