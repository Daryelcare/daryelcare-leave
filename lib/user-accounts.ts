import { supabase as db } from "./db"
import { supabase as publicClient } from "./supabase"
import type { User } from "./types"
import { passwordFlagExists } from "./password-change"

const EMAIL_REGEX = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/

// Creates the login account (Supabase Auth) and the users-table profile.
// Server only: the users table is locked to the service role.
export async function signUpUserWithProfile(
  email: string,
  password: string,
  name: string,
  role: "admin" | "normal",
  branches: string[],
): Promise<User | null> {
  try {
    // Validate email format before proceeding
    if (!EMAIL_REGEX.test(email)) {
      throw new Error(`Email address "${email}" is invalid. Please use a valid email format.`)
    }

    // First check if a user with this email already exists in the users table
    const { data: existingUser, error: checkError } = await db
      .from("users")
      .select("id")
      .eq("email", email)
      .maybeSingle()

    if (checkError) {
      console.error("Error checking for existing user:", checkError.message)
      throw new Error("Error checking for existing user")
    }

    if (existingUser) {
      throw new Error("User with this email already exists")
    }

    // 1. Sign up in Supabase Auth
    const { data, error } = await publicClient.auth.signUp({
      email,
      password,
      options: {
        // Add data to user_metadata
        data: {
          name,
          role,
        },
      },
    })

    if (error) {
      console.error("Sign-up error:", error.message)

      // Handle specific Supabase error messages
      if (error.message.includes("invalid")) {
        throw new Error(`Email address "${email}" is invalid or not allowed. Please use a different email.`)
      }

      throw error
    }

    if (!data?.user) {
      throw new Error("User not returned from signup")
    }

    const user = data.user

    // 2. Prepare and insert profile data into "users" table
    const profile = {
      id: user.id,
      email: user.email!,
      name,
      role,
      branches,
      created_at: new Date().toISOString(),
    }

    // The admin set this password: the person chooses their own at first sign-in
    const withFlag = (await passwordFlagExists()) ? { ...profile, must_change_password: true } : profile
    const { error: insertError } = await db.from("users").insert([withFlag as typeof profile])

    if (insertError) {
      console.error("Insert into users table failed:", insertError.message)
      throw insertError
    }

    // 3. Return the user data
    return {
      id: user.id,
      email: user.email!,
      name,
      role,
      branches,
    }
  } catch (error) {
    console.error("Sign up error:", error)
    throw error
  }
}
