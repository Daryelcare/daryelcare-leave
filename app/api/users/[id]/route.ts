import { NextResponse } from "next/server"
import { supabase } from "@/lib/supabase"
import { supabaseAdmin } from "@/lib/supabase-admin"

export async function GET(request: Request, { params }: { params: { id: string } }) {
  try {
    const id = params.id

    // Fetch the user from Supabase
    const { data, error } = await supabase.from("users").select("*").eq("id", id).single()

    if (error) {
      throw error
    }

    if (!data) {
      return NextResponse.json({ error: "User not found" }, { status: 404 })
    }

    // Transform the data to match our frontend types
    const user = {
      id: data.id,
      email: data.email,
      name: data.name || undefined,
      role: data.role,
      branches: data.branches,
      createdAt: data.created_at,
    }

    return NextResponse.json(user)
  } catch (error) {
    console.error("Error fetching user:", error)
    return NextResponse.json({ error: "Failed to fetch user" }, { status: 500 })
  }
}

export async function DELETE(request: Request, { params }: { params: { id: string } }) {
  try {
    const id = params.id

    // Get the current user's session
    const { data: sessionData, error: sessionError } = await supabase.auth.getSession()

    if (sessionError) {
      throw sessionError
    }

    // If there's a session, check if the user is trying to delete their own account
    if (sessionData.session) {
      const { data: currentUser, error: currentUserError } = await supabase
        .from("users")
        .select("id")
        .eq("email", sessionData.session.user.email)
        .single()

      if (!currentUserError && currentUser && currentUser.id === id) {
        return NextResponse.json({ error: "You cannot delete your own account" }, { status: 403 })
      }
    }

    // 1. First, try to delete the user from auth.users using the admin API
    try {
      const { error: authError } = await supabaseAdmin.auth.admin.deleteUser(id)

      if (authError) {
        console.error("Failed to delete user from auth:", authError)
        // Don't return here, still try to delete from users table
      } else {
        console.log("Successfully deleted user from auth system")
      }
    } catch (authDeleteError) {
      console.error("Exception when deleting from auth:", authDeleteError)
      // Continue with deleting from users table
    }

    // 2. Then delete the user from the users table
    const { error } = await supabase.from("users").delete().eq("id", id)

    if (error) {
      console.error("Failed to delete from users table:", error)
      return NextResponse.json(
        {
          error: `Failed to delete user from database: ${error.message}`,
        },
        { status: 500 },
      )
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("Error deleting user:", error)
    const errorMessage = error instanceof Error ? error.message : "Unknown error"
    return NextResponse.json(
      {
        error: `Failed to delete user: ${errorMessage}`,
      },
      { status: 500 },
    )
  }
}
