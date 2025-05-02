
import { NextResponse } from "next/server"
import { supabase } from "@/lib/supabase"
import { shouldDeductFromBalance } from "@/lib/utils"

export async function GET(request: Request, { params }: { params: { id: string } }) {
  try {
    const id = params.id

    // Fetch the leave request from Supabase
    const { data, error } = await supabase.from("leave_requests").select("*").eq("id", id).single()

    if (error) {
      throw error
    }

    if (!data) {
      return NextResponse.json({ error: "Leave request not found" }, { status: 404 })
    }

    // Get employee code
    let employeeCode = data.employee_id // Default to employee_id as fallback

    try {
      const { data: employee } = await supabase
        .from("employees")
        .select("employee_code")
        .eq("id", data.employee_id)
        .maybeSingle() // Use maybeSingle instead of single to avoid errors

      if (employee) {
        employeeCode = employee.employee_code
      }
    } catch (employeeError) {
      console.error("Error fetching employee code:", employeeError)
      // Continue with default employeeCode if there's an error
    }

    // Transform the data to match our frontend types
    const leaveRequest = {
      id: data.id,
      employeeId: data.employee_id,
      employeeCode: employeeCode,
      employee: data.employee_name,
      branch: data.branch,
      type: data.type,
      startDate: data.start_date,
      endDate: data.end_date,
      duration: data.duration,
      status: data.status,
      reason: data.reason || undefined,
      submittedDate: data.submitted_date,
      addedBy: data.added_by || "System", // Add this line
    }

    return NextResponse.json(leaveRequest)
  } catch (error) {
    console.error("Error fetching leave request:", error)
    return NextResponse.json({ error: "Failed to fetch leave request" }, { status: 500 })
  }
}

export async function PUT(request: Request, { params }: { params: { id: string } }) {
  try {
    const id = params.id
    const data = await request.json()

    // Validate required fields
    if (!data.status) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 })
    }

    // Start a transaction if we're approving the request
    if (data.status === "Approved") {
      // Update employee leave balance for ALL leave types, not just Annual
      // First, get the leave request details
      const { data: leaveRequest, error: leaveError } = await supabase
        .from("leave_requests")
        .select("*")
        .eq("id", id)
        .single()

      if (leaveError) {
        throw leaveError
      }

      // Get the employee's current leave balance
      const { data: employee, error: empError } = await supabase
        .from("employees")
        .select("days_remaining, days_taken")
        .eq("id", leaveRequest.employee_id)
        .single()

      if (empError) {
        throw empError
      }

      // Check if employee has enough days remaining
      if (employee.days_remaining < leaveRequest.duration) {
        return NextResponse.json(
          {
            error: `Cannot approve request. Employee only has ${employee.days_remaining} days remaining but the request is for ${leaveRequest.duration} days.`,
          },
          { status: 400 },
        )
      }

      // Update the employee's leave balance
      const { error: updateError } = await supabase
        .from("employees")
        .update({
          days_taken: employee.days_taken + leaveRequest.duration,
          days_remaining: employee.days_remaining - leaveRequest.duration,
        })
        .eq("id", leaveRequest.employee_id)

      if (updateError) {
        throw updateError
      }
    }

    // Update the leave request status
    const { data: updatedRequest, error } = await supabase
      .from("leave_requests")
      .update({ status: data.status })
      .eq("id", id)
      .select()
      .single()

    if (error) {
      throw error
    }

    return NextResponse.json({
      id: updatedRequest.id,
      status: updatedRequest.status,
      message: `Leave request ${data.status.toLowerCase()} successfully`,
    })
  } catch (error) {
    console.error("Error updating leave request:", error)
    return NextResponse.json({ error: "Failed to update leave request" }, { status: 500 })
  }
}

export async function DELETE(request: Request, { params }: { params: { id: string } }) {
  try {
    const id = params.id

    // First, get the leave request details before deleting
    const { data: leaveRequest, error: fetchError } = await supabase
      .from("leave_requests")
      .select("*")
      .eq("id", id)
      .single()

    if (fetchError) {
      throw fetchError
    }

    // If the leave was approved AND it's a leave type that deducts from balance, restore the employee's leave balance
    if (leaveRequest && leaveRequest.status === "Approved" && shouldDeductFromBalance(leaveRequest.type)) {
      // Get the employee's current leave balance
      const { data: employee, error: empError } = await supabase
        .from("employees")
        .select("days_remaining, days_taken")
        .eq("id", leaveRequest.employee_id)
        .single()

      if (empError) {
        throw empError
      }

      // Update the employee's leave balance - restore the days
      const { error: updateError } = await supabase
        .from("employees")
        .update({
          days_taken: Math.max(0, employee.days_taken - leaveRequest.duration), // Ensure it doesn't go below 0
          days_remaining: employee.days_remaining + leaveRequest.duration,
        })
        .eq("id", leaveRequest.employee_id)

      if (updateError) {
        throw updateError
      }

      console.log(`Restored ${leaveRequest.duration} days to employee ${leaveRequest.employee_id}'s balance for ${leaveRequest.type} leave type`)
    }

    // Now delete the leave request
    const { error } = await supabase.from("leave_requests").delete().eq("id", id)

    if (error) {
      throw error
    }

    return NextResponse.json({
      success: true,
      message: "Leave request deleted successfully and leave balance restored if applicable",
    })
  } catch (error) {
    console.error("Error deleting leave request:", error)
    return NextResponse.json({ error: "Failed to delete leave request" }, { status: 500 })
  }
}
