import { NextResponse } from "next/server"
import { supabase } from "./supabase"
import type { UserRole } from "./types"

// Server-side check of who is calling an API route.
//
// The browser sends the user's Supabase access token as
// `Authorization: Bearer <token>` (see authHeaders() in lib/api-utils.ts).
// We ask Supabase who the token belongs to, then load their role and branches
// from the `users` table (matched by email, as the rest of the app does).

export type RequestUser = {
  id: string
  email: string
  name: string | null
  role: UserRole
  branches: string[]
}

export async function getRequestUser(request: Request): Promise<RequestUser | null> {
  const header = request.headers.get("authorization") || ""
  const token = header.startsWith("Bearer ") ? header.slice(7).trim() : ""
  if (!token) return null

  const { data, error } = await supabase.auth.getUser(token)
  const email = data?.user?.email
  if (error || !email) return null

  const { data: profile } = await supabase
    .from("users")
    .select("id, email, name, role, branches")
    .eq("email", email)
    .maybeSingle()
  if (!profile) return null

  return {
    id: profile.id,
    email: profile.email,
    name: profile.name,
    role: profile.role === "admin" ? "admin" : "normal",
    branches: profile.branches || [],
  }
}

type AuthResult = { user: RequestUser; response?: undefined } | { user?: undefined; response: NextResponse }

// Use in a route as:
//   const auth = await requireUser(request)
//   if (auth.response) return auth.response
export async function requireUser(request: Request): Promise<AuthResult> {
  const user = await getRequestUser(request)
  if (!user) {
    return {
      response: NextResponse.json(
        { error: "Your session has expired. Please log out and log in again." },
        { status: 401 },
      ),
    }
  }
  return { user }
}

export async function requireAdmin(request: Request): Promise<AuthResult> {
  const auth = await requireUser(request)
  if (auth.response) return auth
  if (auth.user.role !== "admin") {
    return { response: NextResponse.json({ error: "Only admins can do this." }, { status: 403 }) }
  }
  return auth
}

// Which branches this user may see. Admins see everything (returns null).
export function allowedBranches(user: RequestUser): string[] | null {
  if (user.role === "admin") return null
  return user.branches
}

export function canAccessBranch(user: RequestUser, branch: string): boolean {
  const allowed = allowedBranches(user)
  return allowed === null || allowed.includes(branch)
}
