import { NextResponse } from "next/server"
import { supabase } from "@/lib/db"
import { canAccessBranch, requireUser } from "@/lib/server-auth"

const MAX = 500

// POST /api/employees/bulk { ids, action: "leaver" | "current" | "branch", branch? }
// Marks people as leavers (or current again), or moves them to another branch.
// Every person, and the new branch, must be in the user's branches.
export async function POST(request: Request) {
  try {
    const auth = await requireUser(request)
    if (auth.response) return auth.response
    const { ids, action, branch } = await request.json()

    if (!Array.isArray(ids) || ids.length === 0 || ids.length > MAX || !ids.every((id) => typeof id === "string")) {
      return NextResponse.json({ error: `Choose between 1 and ${MAX} people` }, { status: 400 })
    }
    if (!["leaver", "current", "branch"].includes(action)) {
      return NextResponse.json({ error: "Unknown action" }, { status: 400 })
    }
    if (action === "branch") {
      if (typeof branch !== "string" || !branch.trim()) {
        return NextResponse.json({ error: "Choose a branch" }, { status: 400 })
      }
      const { data: known } = await supabase.from("branches").select("name").eq("name", branch).maybeSingle()
      if (!known) return NextResponse.json({ error: "That branch doesn't exist" }, { status: 400 })
      if (!canAccessBranch(auth.user, branch)) {
        return NextResponse.json({ error: "You can only move people to your own branches" }, { status: 403 })
      }
    }

    const { data: found, error: findError } = await supabase.from("employees").select("id, branch").in("id", ids)
    if (findError) throw findError
    if ((found || []).length !== ids.length) {
      return NextResponse.json({ error: "Some of those people no longer exist" }, { status: 404 })
    }
    if ((found || []).some((e) => !canAccessBranch(auth.user, e.branch))) {
      return NextResponse.json({ error: "You can only change people in your own branches" }, { status: 403 })
    }

    const update = action === "branch" ? { branch } : { status: action === "leaver" ? "inactive" : "active" }
    const { error } = await supabase.from("employees").update(update).in("id", ids)
    if (error) throw error
    // Their documents record follows them, so it shows under the right branch
    if (action === "branch") {
      const { error: docError } = await supabase.from("documents").update({ branch }).in("employee_id", ids)
      if (docError) console.error("Couldn't move documents records with their employees:", docError)
    }

    console.log(
      `${auth.user.email} ${action === "branch" ? `moved ${ids.length} people to ${branch}` : `marked ${ids.length} people as ${action}`}`,
    )
    return NextResponse.json({ updated: ids.length })
  } catch (error) {
    console.error("Error updating employees:", error)
    return NextResponse.json({ error: "Couldn't update those people. Please try again." }, { status: 500 })
  }
}
