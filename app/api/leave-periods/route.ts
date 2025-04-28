import { NextResponse } from "next/server"
import { supabase } from "@/lib/supabase"

export async function GET(request: Request) {
  try {
    // Get query parameters
    const { searchParams } = new URL(request.url)
    const activeOnly = searchParams.get("activeOnly") === "true"

    // Build the query
    let query = supabase.from("leave_periods").select("*")

    // Apply filters
    if (activeOnly) {
      query = query.eq("is_active", true)
    }

    // Execute the query
    const { data, error } = await query.order("start_date", { ascending: false })

    if (error) {
      throw error
    }

    // Transform the data to match our frontend types
    const periods = data.map((period) => ({
      id: period.id,
      startDate: period.start_date,
      endDate: period.end_date,
      isActive: period.is_active,
      createdAt: period.created_at,
    }))

    return NextResponse.json(periods)
  } catch (error) {
    console.error("Error fetching leave periods:", error)
    return NextResponse.json({ error: "Failed to fetch leave periods" }, { status: 500 })
  }
}

export async function POST(request: Request) {
  try {
    const data = await request.json()

    // Validate required fields
    if (!data.startDate || !data.endDate) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 })
    }

    // Call the function to create a new period and reset employee balances
    const { data: result, error } = await supabase.rpc("create_new_leave_period", {
      start_date: data.startDate,
      end_date: data.endDate,
    })

    if (error) {
      throw error
    }

    return NextResponse.json({ id: result }, { status: 201 })
  } catch (error) {
    console.error("Error creating leave period:", error)
    return NextResponse.json({ error: "Failed to create leave period" }, { status: 500 })
  }
}
