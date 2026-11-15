import { NextResponse } from "next/server"
import { requireAdmin } from "@/lib/server-auth"
import { allowanceColumnExists } from "@/lib/column-probe"
import { recentRuns, runLeaveYearJob } from "@/lib/leave-year-job"

export const dynamic = "force-dynamic"
export const maxDuration = 60

// GET: how the automatic leave year is set up, and its latest runs (admins)
export async function GET(request: Request) {
  const auth = await requireAdmin(request)
  if (auth.response) return auth.response
  try {
    const [{ runs, recording }, allowances] = await Promise.all([recentRuns(), allowanceColumnExists()])
    return NextResponse.json({
      scheduled: !!process.env.CRON_SECRET,
      recording,
      allowances,
      runs,
    })
  } catch (error) {
    console.error("Error reading the leave year job status:", error)
    return NextResponse.json({ error: "Couldn't load the automatic check. Please try again." }, { status: 500 })
  }
}

// POST: run it now (admins). Same as the nightly run; safe to repeat.
export async function POST(request: Request) {
  const auth = await requireAdmin(request)
  if (auth.response) return auth.response
  const result = await runLeaveYearJob("manual")
  console.log(`${auth.user.email} ran the leave year check: ${result.message}`)
  return NextResponse.json(result, { status: result.ok ? 200 : 500 })
}
