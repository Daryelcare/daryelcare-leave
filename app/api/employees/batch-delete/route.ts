import { NextResponse } from "next/server"
import { supabase } from "@/lib/supabase"
import { canAccessBranch, requireUser } from "@/lib/server-auth"

export async function POST(request: Request) {
  try {
    const auth = await requireUser(request)
    if (auth.response) return auth.response
    const { ids } = await request.json()

    if (!ids || !Array.isArray(ids) || ids.length === 0) {
      return NextResponse.json({ error: "No employee IDs provided" }, { status: 400 })
    }
    const { data: found, error: findError } = await supabase.from("employees").select("id, branch").in("id", ids)
    if (findError) throw findError
    if ((found || []).some((e) => !canAccessBranch(auth.user, e.branch))) {
      return NextResponse.json({ error: "You can only delete employees in your own branches" }, { status: 403 })
    }

    // Delete employees in a single batch operation
    const { error, count } = await supabase.from("employees").delete().in("id", ids)

    if (error) {
      console.error("Error deleting employees:", error)
      return NextResponse.json({ error: "Couldn't delete those employees. Please try again." }, { status: 500 })
    }

    return NextResponse.json({
      success: true,
      deleted: count || ids.length,
      message: `Successfully deleted ${count || ids.length} employees`,
    })
  } catch (error) {
    console.error("Error in batch delete:", error)
    return NextResponse.json({ error: "Couldn't delete those employees. Please try again." }, { status: 500 })
  }
}
