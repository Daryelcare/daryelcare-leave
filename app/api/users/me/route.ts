import { NextResponse } from "next/server"
import { supabase } from "@/lib/supabase"
import { requireUser } from "@/lib/server-auth"

// PUT /api/users/me { name }: anyone can change their own display name.
// Role and branches stay with administrators.
export async function PUT(request: Request) {
  try {
    const auth = await requireUser(request)
    if (auth.response) return auth.response
    const { name } = await request.json()
    const clean = typeof name === "string" ? name.trim().replace(/\s+/g, " ") : ""
    if (clean.length < 2 || clean.length > 80) {
      return NextResponse.json({ error: "Give a name between 2 and 80 characters" }, { status: 400 })
    }
    const { error } = await supabase.from("users").update({ name: clean }).eq("id", auth.user.id)
    if (error) throw error
    return NextResponse.json({ name: clean })
  } catch (error) {
    console.error("Error updating own name:", error)
    return NextResponse.json({ error: "Couldn't save your name. Please try again." }, { status: 500 })
  }
}
