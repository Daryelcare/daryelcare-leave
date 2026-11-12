import { createClient } from "@supabase/supabase-js"
import type { Database } from "./database.types"
import { SUPABASE_URL } from "./supabase"

// Supabase client with the service-role key. It bypasses row-level security
// and can manage login accounts, so it must ONLY be used in server-side code.
//
// Needs the SUPABASE_SERVICE_ROLE_KEY environment variable (Vercel → Project
// Settings → Environment Variables). Supabase dashboard → Project Settings →
// API → "service_role" key.
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || ""

export const hasServiceRoleKey = supabaseServiceKey.length > 0

if (!hasServiceRoleKey) {
  console.warn("⚠️ SUPABASE_SERVICE_ROLE_KEY is not set. Admin account operations will fail.")
}

export const SERVICE_KEY_MISSING_MESSAGE =
  "The server is missing the SUPABASE_SERVICE_ROLE_KEY setting, so it can't manage login accounts. Add it in Vercel → Settings → Environment Variables and redeploy."

export const supabaseAdmin = createClient<Database>(SUPABASE_URL, supabaseServiceKey || "missing-service-role-key", {
  auth: {
    autoRefreshToken: false,
    persistSession: false,
  },
})

// Find the Supabase login account for an app user. Tries the id first (the
// users table normally uses the login account's id) and falls back to
// searching by email, for older rows created with a different id.
export async function findAuthUserId(userId: string, email: string): Promise<string | null> {
  const byId = await supabaseAdmin.auth.admin.getUserById(userId)
  if (!byId.error && byId.data?.user) return byId.data.user.id

  const target = email.toLowerCase()
  for (let page = 1; page <= 50; page++) {
    const { data, error } = await supabaseAdmin.auth.admin.listUsers({ page, perPage: 200 })
    if (error) throw error
    const match = data.users.find((u) => u.email?.toLowerCase() === target)
    if (match) return match.id
    if (data.users.length < 200) break
  }
  return null
}
