import { NextResponse } from "next/server"
import { requireUser, allowedBranches } from "@/lib/server-auth"
import { parseDateToUtc } from "@/lib/dates"
import { getLeaveBetween, resolveBranchFilter } from "@/lib/leave-data"

// GET /api/leave-calendar?from=YYYY-MM-DD&to=YYYY-MM-DD&branch=<name|all>
// Approved and pending leave overlapping the date range, for the team calendar
// (pending is drawn dashed). Rejected leave is never shown.
export async function GET(request: Request) {
  try {
    const auth = await requireUser(request)
    if (auth.response) return auth.response

    const { searchParams } = new URL(request.url)
    const from = parseDateToUtc(searchParams.get("from"))
    const to = parseDateToUtc(searchParams.get("to"))
    if (from === null || to === null || to < from) {
      return NextResponse.json({ error: "Give a valid from and to date (YYYY-MM-DD)" }, { status: 400 })
    }
    if (to - from > 400 * 24 * 60 * 60 * 1000) {
      return NextResponse.json({ error: "Date range is too long" }, { status: 400 })
    }

    const branches = resolveBranchFilter(searchParams.get("branch"), allowedBranches(auth.user))
    const leaves = await getLeaveBetween(from, to, branches, ["Approved", "Pending"])
    return NextResponse.json({ leaves })
  } catch (error) {
    console.error("Error loading calendar:", error)
    return NextResponse.json(
      { error: `Failed to load calendar: ${error instanceof Error ? error.message : "unknown error"}` },
      { status: 500 },
    )
  }
}
