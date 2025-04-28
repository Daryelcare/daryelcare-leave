import { createClient } from "@supabase/supabase-js"
import type { Database } from "./database.types"

// Use environment variables or fallback to the provided credentials
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "https://trmyximheyxypmftvkfe.supabase.co"
const supabaseAnonKey =
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InRybXl4aW1oZXl4eXBtZnR2a2ZlIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDU0MDY0MzQsImV4cCI6MjA2MDk4MjQzNH0.oV8kXGUpIh2dYyeaoBQJmwbsgcgfwM_CS7dWkzBqhfE"

// Create a single supabase client for the entire app
export const supabase = createClient<Database>(supabaseUrl, supabaseAnonKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
  },
})

// Export the URL and key for other parts of the application that might need them
export const SUPABASE_URL = supabaseUrl
export const SUPABASE_ANON_KEY = supabaseAnonKey
