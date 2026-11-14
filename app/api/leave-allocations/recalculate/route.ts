import { NextResponse } from "next/server"
import { requireAdmin } from "@/lib/server-auth"
import { applyBalanceCheck, loadBalanceCheck } from "@/lib/balance-server"
import { yearRange } from "@/lib/leave-years"

// GET: compare everyone's stored balance with the one worked out from their
// approved leave in the current leave year. Changes nothing.
export async function GET(request: Request) {
  try {
    const auth = await requireAdmin(request)
    if (auth.response) return auth.response
    const check = await loadBalanceCheck()
    return NextResponse.json({
      year: { label: check.year.label, range: yearRange(check.year) },
      summary: check.summary,
      rows: check.rows,
    })
  } catch (error) {
    console.error("Error checking leave balances:", error)
    return NextResponse.json({ error: "Couldn't check the balances. Please try again." }, { status: 500 })
  }
}

// POST: write the worked-out balances for everyone whose stored one differs
export async function POST(request: Request) {
  try {
    const auth = await requireAdmin(request)
    if (auth.response) return auth.response
    const result = await applyBalanceCheck()
    console.log(`${auth.user.email} recalculated leave balances for ${result.year.label}: ${result.changed} changed`)
    return NextResponse.json({ changed: result.changed, summary: result.summary, year: result.year.label })
  } catch (error) {
    console.error("Error recalculating leave balances:", error)
    return NextResponse.json(
      { error: "Couldn't update the balances. Nothing was half-done that can't be re-run; please try again." },
      { status: 500 },
    )
  }
}
