import { NextResponse } from "next/server"
import { supabase } from "@/lib/supabase"
import { supabaseAdmin } from "@/lib/supabase-admin"

export async function PUT(request: Request, { params }: { params: { id: string } }) {
  try {
    const id = params.id
    const { role, branches } = await request.json()

    // First update auth user role using admin API
    const { error: authError } = await supabaseAdmin.auth.admin.updateUserById(id, {
      app_metadata: { role },
    })

    if (authError) {
      console.error("Failed to update auth user role:", authError)
      return NextResponse.json({ error: "Failed to update user role in auth system" }, { status: 500 })
    }

    // Then update users table
    const { error: dbError } = await supabase.from("users").update({ role, branches }).eq("id", id)

    if (dbError) {
      console.error("Failed to update user in database:", dbError)
      return NextResponse.json({ error: "Failed to update user in database" }, { status: 500 })
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("Error updating user role:", error)
    return NextResponse.json({ error: "Failed to update user role" }, { status: 500 })
  }
}
