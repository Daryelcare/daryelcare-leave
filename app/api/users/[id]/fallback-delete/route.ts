import { NextResponse } from "next/server"
import { supabase } from "@/lib/supabase"

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

    // Delete only from the users table (fallback approach)
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

    return NextResponse.json({
      success: true,
      message: "User deleted from database only. Auth record may still exist.",
    })
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
