import { NextResponse } from "next/server"
import { supabase } from "@/lib/supabase"
import { findAuthUserId, hasServiceRoleKey, SERVICE_KEY_MISSING_MESSAGE, supabaseAdmin } from "@/lib/supabase-admin"
import { requireAdmin } from "@/lib/server-auth"

// Admin sets a new password for another user's login account.
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const auth = await requireAdmin(request)
    if (auth.response) return auth.response

    if (!hasServiceRoleKey) {
      return NextResponse.json({ error: SERVICE_KEY_MISSING_MESSAGE }, { status: 500 })
    }

    const { id } = await params
    const { password } = await request.json()

    if (!password || typeof password !== "string" || password.length < 6) {
      return NextResponse.json({ error: "Password must be at least 6 characters" }, { status: 400 })
    }

    const { data: target, error: userError } = await supabase.from("users").select("id, email").eq("id", id).maybeSingle()
    if (userError || !target) {
      return NextResponse.json({ error: "User not found" }, { status: 404 })
    }

    const authUserId = await findAuthUserId(target.id, target.email)
    if (!authUserId) {
      return NextResponse.json({ error: `No login account found for ${target.email}` }, { status: 404 })
    }

    const { error } = await supabaseAdmin.auth.admin.updateUserById(authUserId, { password })
    if (error) {
      return NextResponse.json({ error: `Failed to reset password: ${error.message}` }, { status: 500 })
    }

    console.log(`${auth.user.email} reset the password for ${target.email}`)
    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("Error resetting password:", error)
    return NextResponse.json(
      { error: `Failed to reset password: ${error instanceof Error ? error.message : "unknown error"}` },
      { status: 500 },
    )
  }
}
