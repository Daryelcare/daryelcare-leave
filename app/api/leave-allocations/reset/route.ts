import { NextResponse } from "next/server"
import { supabase } from "@/lib/supabase"

export async function POST(request: Request) {
  try {
    // Check authentication using Supabase Auth
    const { data: sessionData, error: sessionError } = await supabase.auth.getSession()

    if (sessionError) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    if (!sessionData.session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    // Get user role from users table
    const { data: userData, error: userError } = await supabase
      .from("users")
      .select("role")
      .eq("email", sessionData.session.user.email)
      .single()

    if (userError || !userData) {
      return NextResponse.json({ error: "Failed to verify user role" }, { status: 500 })
    }

    if (userData.role !== "admin") {
      return NextResponse.json({ error: "Forbidden: Admin access required" }, { status: 403 })
    }

    // Get the days to reset to from the request body
    let daysRemaining = 28
    try {
      const body = await request.json()
      daysRemaining = body.days || 28
    } catch {
      // Use default value if body parsing fails
    }

    // First, check how many active employees we have (case-insensitive)
    const { data: activeEmployees, error: countError } = await supabase
      .from("employees")
      .select("id, name, status, days_remaining, days_taken")
      .ilike("status", "active")

    if (countError) {
      console.error("Error fetching employees:", countError)
      return NextResponse.json(
        {
          error: "Failed to fetch employees",
          details: countError.message,
        },
        { status: 500 },
      )
    }

    if (!activeEmployees || activeEmployees.length === 0) {
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
