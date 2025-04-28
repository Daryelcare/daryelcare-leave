import { NextResponse } from "next/server"
import { supabase } from "@/lib/supabase"

export async function GET(request: Request) {
  try {
    // Get query parameters
    const { searchParams } = new URL(request.url)
    const employeeId = searchParams.get("employeeId")
    const periodId = searchParams.get("periodId")

    // Build the query
    let query = supabase.from("leave_allocations").select(`
        id,
        allocation_days,
        used_days,
        remaining_days,
        created_at,
        updated_at,
        employee_id (
          id,
          name,
          employee_code,
          branch
        ),
        period_id (
          id,
          start_date,
          end_date,
          is_active
        )
      `)

    // Apply filters
    if (employeeId) {
      query = query.eq("employee_id", employeeId)
    }

    if (periodId) {
      query = query.eq("period_id", periodId)
    }

    // Execute the query
    const { data, error } = await query

    if (error) {
      throw error
    }

    // Transform the data to match our frontend types
    const allocations = data.map((allocation) => ({
      id: allocation.id,
      employeeId: allocation.employee_id.id,
      employeeName: allocation.employee_id.name,
      employeeCode: allocation.employee_id.employee_code,
      branch: allocation.employee_id.branch,
      periodId: allocation.period_id.id,
      periodStart: allocation.period_id.start_date,
      periodEnd: allocation.period_id.end_date,
      isActivePeriod: allocation.period_id.is_active,
      allocationDays: allocation.allocation_days,
      usedDays: allocation.used_days,
      remainingDays: allocation.remaining_days,
      createdAt: allocation.created_at,
      updatedAt: allocation.updated_at,
    }))

    return NextResponse.json(allocations)
  } catch (error) {
    console.error("Error fetching leave allocations:", error)
    return NextResponse.json({ error: "Failed to fetch leave allocations" }, { status: 500 })
  }
}

export async function POST(request: Request) {
  try {
    const data = await request.json()

    // Validate required fields
    if (!data.employeeId || !data.periodId) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 })
    }

    // Check if allocation already exists
    const { data: existingAllocation } = await supabase
      .from("leave_allocations")
      .select("id")
      .eq("employee_id", data.employeeId)
      .eq("period_id", data.periodId)
      .single()

    if (existingAllocation) {
      return NextResponse.json({ error: "Allocation already exists for this employee and period" }, { status: 400 })
    }

    // Insert into Supabase
    const { data: newAllocation, error } = await supabase
      .from("leave_allocations")
      .insert({
        employee_id: data.employeeId,
        period_id: data.periodId,
        allocation_days: data.allocationDays || 28,
        used_days: data.usedDays || 0,
        remaining_days: (data.allocationDays || 28) - (data.usedDays || 0),
      })
      .select()
      .single()

    if (error) {
      throw error
    }

    return NextResponse.json(newAllocation, { status: 201 })
  } catch (error) {
    console.error("Error creating leave allocation:", error)
    return NextResponse.json({ error: "Failed to create leave allocation" }, { status: 500 })
  }
}
