import { NextResponse } from "next/server"
import { supabase } from "@/lib/db"
import { requireAdmin } from "@/lib/server-auth"
import { columnsExist } from "@/lib/column-probe"
import { cleanOverrides } from "@/lib/permissions"

// PUT { overrides: { key: true/false } }: one person's exceptions to the
// organisation's manager settings (admins only). Empty clears them.
export async function PUT(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireAdmin(request)
  if (auth.response) return auth.response
  try {
    const { id } = await params
    if (!(await columnsExist("users", ["permission_overrides"]))) {
      return NextResponse.json(
        { error: "Per-person permissions need a one-off database update before they can be changed." },
        { status: 409 },
      )
    }
    const body = await request.json().catch(() => ({}))
    const overrides = cleanOverrides(body?.overrides)
    const value = Object.keys(overrides).length ? overrides : null
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data, error } = await (supabase.from("users") as any)
      .update({ permission_overrides: value })
      .eq("id", id)
      .select("id, email, role")
      .maybeSingle()
    if (error) throw error
    if (!data) return NextResponse.json({ error: "User not found" }, { status: 404 })
    console.log(`${auth.user.email} set permission exceptions for ${data.email}: ${JSON.stringify(overrides)}`)
    return NextResponse.json({ id: data.id, permissionOverrides: overrides })
  } catch (error) {
    console.error("Error saving a user's permissions:", error)
    return NextResponse.json({ error: "Couldn't save the permissions. Please try again." }, { status: 500 })
  }
}
