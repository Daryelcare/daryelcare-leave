import { NextResponse } from "next/server"
import { supabase } from "@/lib/supabase"
import { requireAdmin } from "@/lib/server-auth"

// Reset every active employee to `days` remaining and 0 taken (admin only).
export async function POST(request: Request) {
  try {
    const auth = await requireAdmin(request)
    if (auth.response) return auth.response

    let daysRemaining = 28
    try {
      const body = await request.json()
      const days = Number(body?.days)
      if (Number.isFinite(days) && days >= 0 && days <= 366) daysRemaining = Math.round(days)
    } catch {
      // No body: use the default
    }

    const { error, count } = await supabase
      .from("employees")
      .update({ days_remaining: daysRemaining, days_taken: 0 }, { count: "exact" })
      .eq("status", "active")

    if (error) {
      console.error("Error resetting leave balances:", error)
      return NextResponse.json({ error: `Failed to reset leave balances: ${error.message}` }, { status: 500 })
    }

    console.log(`${auth.user.email} reset leave balances for ${count ?? "?"} employees to ${daysRemaining} days`)

    return NextResponse.json({
      success: true,
      message: "Successfully reset leave balances for all active employees",
      daysRemaining,
      count,
    })
  } catch (error) {
    console.error("Error in reset leave balances API:", error)
    return NextResponse.json(
      { error: `An unexpected error occurred: ${error instanceof Error ? error.message : String(error)}` },
      { status: 500 },
    )
  }
}
