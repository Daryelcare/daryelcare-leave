// The database client for server code (API routes and server helpers).
//
// It uses the service-role key, so the tables can be locked with row-level
// security and the public (anon) key that ships to every browser can't read
// or change them. Never import this from a "use client" file: the key only
// exists on the server (it isn't a NEXT_PUBLIC_ variable), and the browser
// talks to the database only through these API routes.
//
// If the key isn't configured it falls back to the public client, so the app
// keeps working until the tables are locked, and says so in the logs.

import { supabase as publicClient } from "./supabase"
import { hasServiceRoleKey, supabaseAdmin } from "./supabase-admin"

if (!hasServiceRoleKey) {
  console.warn(
    "⚠️ Using the public database key on the server. Set SUPABASE_SERVICE_ROLE_KEY before locking the tables with RLS.",
  )
}

export const supabase = hasServiceRoleKey ? supabaseAdmin : publicClient
export const usingServiceRole = hasServiceRoleKey
