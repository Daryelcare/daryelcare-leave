import { createClient } from "@supabase/supabase-js"
import type { Database } from "./database.types"

// These should be environment variables in production
const supabaseUrl = "https://trmyximheyxypmftvkfe.supabase.co"
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || "your-service-role-key"

// Check if service key is properly configured
if (!supabaseServiceKey || supabaseServiceKey === "your-service-role-key") {
  console.warn("⚠️ Supabase service role key is not properly configured. Admin operations will fail.")
}

// Create a Supabase client with the service role key
// IMPORTANT: This client has admin privileges and should ONLY be used in server-side code
export const supabaseAdmin = createClient<Database>(supabaseUrl, supabaseServiceKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false,
  },
})

// Test function to check if admin client is working
export async function testAdminClient() {
  try {
    const { data, error } = await supabaseAdmin.auth.admin.listUsers()
    if (error) {
      console.error("Admin client test failed:", error)
      return false
    }
    console.log("Admin client test successful, found users:", data.users.length)
    return true
  } catch (err) {
    console.error("Admin client test exception:", err)
    return false
  }
}
