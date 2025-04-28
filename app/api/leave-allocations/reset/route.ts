import { NextResponse } from "next/server"
import { supabase } from "@/lib/supabase"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"

export async function POST(request: Request) {
  try {
    // Check authentication and admin role
    const session = await getServerSession(authOptions)
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    if (session.user.role !== "admin") {
      return NextResponse.json({ error: "Forbidden: Admin access required" }, { status: 403 })
    }

    // Get the days to reset to from the request body
    let daysRemaining = 28
    try {
      const body = await request.json()
      daysRemaining = body.days || 28
    } catch (e) {
      console.log("Error parsing request body, using default value:", e)
    }

    console.log(`Resetting all employee leave balances to ${daysRemaining} days remaining and 0 days taken`)

    // Update all employees' leave balances directly in the employees table
    const { error, count } = await supabase
      .from("employees")
      .update({
        days_remaining: daysRemaining,
        days_taken: 0,
      })
      .eq("status", "active")

    if (error) {
      console.error("Error resetting leave balances:", error)
      return NextResponse.json(
        {
          error: "Failed to reset leave balances",
          details: error.message,
        },
        { status: 500 },
      )
    }

    // Return success response
    return NextResponse.json({
      success: true,
      message: `Successfully reset leave balances for all active employees`,
      daysRemaining,
      count,
    })
  } catch (error) {
    console.error("Error in reset leave balances API:", error)
    return NextResponse.json(
      {
        error: "An unexpected error occurred",
        details: error instanceof Error ? error.message : String(error),
      },
      { status: 500 },
    )
  }
}
