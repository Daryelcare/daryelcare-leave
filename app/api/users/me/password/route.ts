import { NextResponse } from "next/server"
import { supabase } from "@/lib/db"
import { hasServiceRoleKey, SERVICE_KEY_MISSING_MESSAGE, supabaseAdmin } from "@/lib/supabase-admin"
import { isCurrentPassword, passwordProblem, setMustChangePassword } from "@/lib/password-change"

// POST /api/users/me/password { password, confirm }: the signed-in person
// chooses a new password (the "Choose a new password" screen). It must be at
// least 6 characters and not their current one. Clears the must-change flag.
export async function POST(request: Request) {
  try {
    const header = request.headers.get("authorization") || ""
    const token = header.startsWith("Bearer ") ? header.slice(7).trim() : ""
    if (!token) return NextResponse.json({ error: "Not signed in" }, { status: 401 })
    const { data: who, error: authError } = await supabase.auth.getUser(token)
    const authUser = who?.user
    if (authError || !authUser?.email) return NextResponse.json({ error: "Not signed in" }, { status: 401 })
    if (!hasServiceRoleKey) return NextResponse.json({ error: SERVICE_KEY_MISSING_MESSAGE }, { status: 500 })

    const body = await request.json().catch(() => ({}))
    const problem = passwordProblem(body?.password, body?.confirm)
    if (problem) return NextResponse.json({ error: problem }, { status: 400 })
    if (await isCurrentPassword(authUser.email, body.password)) {
      return NextResponse.json({ error: "Choose a password that's different from your current one." }, { status: 400 })
    }

    const { error } = await supabaseAdmin.auth.admin.updateUserById(authUser.id, { password: body.password })
    if (error) {
      console.error("Couldn't change own password:", error)
      return NextResponse.json({ error: "Couldn't save your new password. Please try again." }, { status: 500 })
    }
    await setMustChangePassword({ email: authUser.email }, false)
    console.log(`${authUser.email} chose a new password`)
    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("Error changing own password:", error)
    return NextResponse.json({ error: "Couldn't save your new password. Please try again." }, { status: 500 })
  }
}
