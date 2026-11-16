import { NextResponse } from "next/server"
import { supabase } from "./db"
import type { UserRole } from "./types"
import { columnsExist } from "./column-probe"
import { loadOrgPermissions } from "./permission-server"
import { deniedMessage, effectivePermissions, type PermissionKey, type PermissionSet } from "./permissions"

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
  /** What they may do (everything for admins) */
  permissions: PermissionSet
}

export async function getRequestUser(request: Request): Promise<RequestUser | null> {
  const header = request.headers.get("authorization") || ""
  const token = header.startsWith("Bearer ") ? header.slice(7).trim() : ""
  if (!token) return null

  const { data, error } = await supabase.auth.getUser(token)
  const email = data?.user?.email
  if (error || !email) return null

  // Per-person permission exceptions, once the database update adding them has been run
  const withOverrides = await columnsExist("users", ["permission_overrides"])
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: profile } = await (supabase.from("users") as any)
    .select(`id, email, name, role, branches${withOverrides ? ", permission_overrides" : ""}`)
    .eq("email", email)
    .maybeSingle()
  if (!profile) return null

  const role: UserRole = profile.role === "admin" ? "admin" : "normal"
  const org = role === "admin" ? null : await loadOrgPermissions()
  return {
    id: profile.id,
    email: profile.email,
    name: profile.name,
    role,
    branches: profile.branches || [],
    permissions: effectivePermissions(role, org?.saved, profile.permission_overrides),
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

/** Whether this person may do something (admins always may) */
export const can = (user: RequestUser, key: PermissionKey) => user.role === "admin" || user.permissions[key] === true

/** A 403 response saying an admin has turned this off */
export const denied = (key: PermissionKey) => NextResponse.json({ error: deniedMessage(key) }, { status: 403 })

// Use in a route as:
//   const auth = await requirePermission(request, "leave_approve")
//   if (auth.response) return auth.response
export async function requirePermission(request: Request, key: PermissionKey): Promise<AuthResult> {
  const auth = await requireUser(request)
  if (auth.response) return auth
  if (!can(auth.user, key)) return { response: denied(key) }
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
