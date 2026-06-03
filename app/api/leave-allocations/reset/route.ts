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

    console.log(`[v0] Resetting all employee leave balances to ${daysRemaining} days remaining and 0 days taken`)

    // First, check how many active employees we have (case-insensitive)
    const { data: activeEmployees, error: countError } = await supabase
      .from("employees")
      .select("id, name, status, days_remaining, days_taken")
      .ilike("status", "active")

    console.log(`[v0] Found ${activeEmployees?.length || 0} active employees to reset`)
    console.log(`[v0] Active employees:`, activeEmployees)

    if (countError) {
      console.error("[v0] Error fetching employees:", countError)
      return NextResponse.json(
        {
          error: "Failed to fetch employees",
          details: countError.message,
        },
        { status: 500 },
      )
    }

    if (!activeEmployees || activeEmployees.length === 0) {
      console.log("[v0] No active employees found to reset")
      return NextResponse.json(
        {
          error: "No active employees found",
          details: "There are no employees with status 'active' in the database",
        },
        { status: 404 },
      )
    }

    // Get the IDs of active employees to update them
    const activeEmployeeIds = activeEmployees.map((emp) => emp.id)

    // Update all employees' leave balances directly in the employees table using the IDs
    const { data: updatedData, error } = await supabase
      .from("employees")
      .update({
        days_remaining: daysRemaining,
        days_taken: 0,
      })
      .in("id", activeEmployeeIds)
      .select()

    console.log(`[v0] Update result - data:`, updatedData)
    console.log(`[v0] Update result - error:`, error)

    if (error) {
      console.error("[v0] Error resetting leave balances:", error)
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
      message: `Successfully reset leave balances for ${updatedData?.length || 0} active employees`,
      daysRemaining,
      count: updatedData?.length || 0,
      updatedEmployees: updatedData,
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
