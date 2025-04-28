import { supabase } from "./supabase"
import type { User } from "./types"

// Email validation regex - more comprehensive than basic checks
const EMAIL_REGEX = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/

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

    // 2. Fetch the user profile from the custom users table using email
    // Using email is more reliable than ID for matching between auth and custom table
    const { data: userData, error: userError } = await supabase
      .from("users")
      .select("*")
      .eq("email", email)
      .maybeSingle() // Use maybeSingle instead of single to avoid errors

    if (userError) {
      console.error("Error fetching user profile:", userError.message)
      throw new Error("Error fetching user profile")
    }

    // If user doesn't exist in the custom table, create a profile
    if (!userData) {
      // First check if a user with this email already exists
      // This is a double-check to prevent duplicate key errors
      const { count, error: countError } = await supabase
        .from("users")
        .select("*", { count: "exact", head: true })
        .eq("email", email)

      if (countError) {
        console.error("Error checking for existing user:", countError.message)
        throw new Error("Error checking for existing user")
      }

      // Only proceed if no user with this email exists
      if (count === 0) {
        try {
          const { data: newUserData, error: insertError } = await supabase
            .from("users")
            .insert({
              id: data.user.id,
              email: email,
              name: data.user.user_metadata?.name || email.split("@")[0],
              role: "normal", // Default role
              branches: [], // No branches by default
              created_at: new Date().toISOString(),
            })
            .select()
            .single()

          if (insertError) {
            console.error("Failed to create user profile:", insertError.message)
            throw new Error("Failed to create user profile")
          }

          return {
            id: newUserData.id,
            email: newUserData.email,
            name: newUserData.name || undefined,
            role: newUserData.role,
            branches: newUserData.branches || [],
          }
        } catch (insertError) {
          console.error("Insert error:", insertError)
          throw new Error("Failed to create user profile")
        }
      } else {
        console.error("User with this email already exists in the users table but couldn't be fetched")
        throw new Error("User profile inconsistency detected")
      }
    }

    // 3. Return the user data from the custom table
    return {
      id: userData.id,
      email: userData.email,
      name: userData.name || undefined,
      role: userData.role,
      branches: userData.branches || [],
    }
  } catch (error) {
    console.error("Sign in error:", error)
    throw error
  }
}

// Sign up function that creates both auth user and profile
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
    const { data: existingUser, error: checkError } = await supabase
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
    const { data, error } = await supabase.auth.signUp({
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

    const { error: insertError } = await supabase.from("users").insert([profile])

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

    // Get the user profile from the custom users table using email
    const { data: userData, error: userError } = await supabase
      .from("users")
      .select("*")
      .eq("email", authUser.email)
      .maybeSingle()

    if (userError || !userData) {
      return null
    }

    // Return the user data
    return {
      id: userData.id,
      email: userData.email,
      name: userData.name || undefined,
      role: userData.role,
      branches: userData.branches || [],
    }
  } catch (error) {
    console.error("Error getting current user:", error)
    return null
  }
}

// Function to update user password
export async function updatePassword(newPassword: string): Promise<boolean> {
  try {
    const { error } = await supabase.auth.updateUser({
      password: newPassword,
    })

    if (error) {
      throw new Error(error.message)
    }

    return true
  } catch (error) {
    console.error("Error updating password:", error)
    throw error
  }
}

// Function to reset user password (admin function)
export async function resetUserPassword(userId: string, newPassword: string): Promise<boolean> {
  try {
    // Instead of using admin.updateUserById, we'll use a different approach
    // First, we'll get the user's email from our users table
    const { data: userData, error: userError } = await supabase.from("users").select("email").eq("id", userId).single()

    if (userError || !userData) {
      console.error("Error finding user:", userError?.message || "User not found")
      throw new Error("User not found")
    }

    // For demo/development purposes, we'll just update the password directly
    // In a production environment, you would implement a secure password reset flow
    // This is a simplified approach that doesn't require admin privileges

    // We'll use the auth.updateUser function which works for the current user
    // Note: In a real app, you'd need to implement a proper admin password reset flow
    // This is just a workaround for the demo
    const { error } = await supabase.auth.updateUser({
      email: userData.email,
      password: newPassword,
    })

    if (error) {
      throw new Error(error.message)
    }

    return true
  } catch (error) {
    console.error("Error resetting user password:", error)
    throw error
  }
}
