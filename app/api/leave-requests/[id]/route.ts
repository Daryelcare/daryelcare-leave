
import { NextResponse } from "next/server"
import { supabase } from "@/lib/supabase"
import { shouldDeductFromBalance } from "@/lib/utils"
import { inclusiveDays, parseDateToUtc, toUkDate } from "@/lib/dates"
import { canAccessBranch, requireUser } from "@/lib/server-auth"

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params

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

// Add `delta` days to an employee's leave taken (negative gives days back).
// Returns the new days remaining. Balances may go negative, as elsewhere in the app.
async function adjustBalance(employeeId: string, delta: number): Promise<number | null> {
  const { data: employee, error } = await supabase
    .from("employees")
    .select("days_remaining, days_taken")
    .eq("id", employeeId)
    .maybeSingle()
  if (error) throw error
  if (!employee) return null
  if (delta === 0) return employee.days_remaining

  const daysRemaining = employee.days_remaining - delta
  const { error: updateError } = await supabase
    .from("employees")
    .update({ days_taken: Math.max(0, employee.days_taken + delta), days_remaining: daysRemaining })
    .eq("id", employeeId)
  if (updateError) throw updateError
  return daysRemaining
}

// Days a leave entry takes off the balance (only approved Annual Leave / Working Holiday count)
function deductedDays(status: string, type: string, duration: number): number {
  return status === "Approved" && shouldDeductFromBalance(type) ? duration : 0
}

// PUT: change a leave request's status (Approved / Rejected / Pending)
export async function PUT(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const data = await request.json()

    if (!data.status || typeof data.status !== "string") {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 })
    }

    const { data: leaveRequest, error: leaveError } = await supabase
      .from("leave_requests")
      .select("*")
      .eq("id", id)
      .single()
    if (leaveError) throw leaveError

    const delta =
      deductedDays(data.status, leaveRequest.type, leaveRequest.duration) -
      deductedDays(leaveRequest.status, leaveRequest.type, leaveRequest.duration)
    await adjustBalance(leaveRequest.employee_id, delta)

    const { data: updatedRequest, error } = await supabase
      .from("leave_requests")
      .update({ status: data.status })
      .eq("id", id)
      .select()
      .single()
    if (error) throw error

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

// PATCH: edit a leave entry's type, dates and reason. The employee's balance
// is corrected by the difference (e.g. shortening approved Annual Leave from
// 5 to 3 days gives 2 days back; changing it to Sick Leave gives all 5 back).
export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const auth = await requireUser(request)
    if (auth.response) return auth.response

    const { id } = await params
    const data = await request.json()

    const type = typeof data.type === "string" ? data.type.trim() : ""
    const start = parseDateToUtc(data.startDate)
    const end = parseDateToUtc(data.endDate)
    if (!type || start === null || end === null) {
      return NextResponse.json({ error: "Leave type, start date and end date are required" }, { status: 400 })
    }
    if (end < start) {
      return NextResponse.json({ error: "The end date can't be before the start date" }, { status: 400 })
    }
    const duration = inclusiveDays(start, end)
    if (duration > 366) {
      return NextResponse.json({ error: "Leave can't be longer than a year" }, { status: 400 })
    }

    const { data: existing, error: fetchError } = await supabase
      .from("leave_requests")
      .select("*")
      .eq("id", id)
      .maybeSingle()
    if (fetchError) throw fetchError
    if (!existing) {
      return NextResponse.json({ error: "Leave entry not found" }, { status: 404 })
    }
    if (!canAccessBranch(auth.user, existing.branch)) {
      return NextResponse.json({ error: "You can only edit leave for your own branches" }, { status: 403 })
    }

    const delta =
      deductedDays(existing.status, type, duration) -
      deductedDays(existing.status, existing.type, existing.duration)
    const daysRemaining = await adjustBalance(existing.employee_id, delta)

    const reason = typeof data.reason === "string" ? data.reason.trim() : existing.reason
    const { data: updated, error: updateError } = await supabase
      .from("leave_requests")
      .update({
        type,
        start_date: toUkDate(start),
        end_date: toUkDate(end),
        duration,
        reason: reason || null,
        remaining: delta !== 0 && daysRemaining !== null ? daysRemaining : existing.remaining,
      })
      .eq("id", id)
      .select()
      .single()

    if (updateError) {
      // Put the balance back as it was
      if (delta !== 0) await adjustBalance(existing.employee_id, -delta).catch(() => {})
      throw updateError
    }

    console.log(
      `${auth.user.email} edited leave ${id} for ${existing.employee_name}: ` +
        `${existing.type} ${existing.start_date}-${existing.end_date} -> ${type} ${updated.start_date}-${updated.end_date}`,
    )

    return NextResponse.json({
      id: updated.id,
      employeeId: updated.employee_id,
      employee: updated.employee_name,
      branch: updated.branch,
      type: updated.type,
      startDate: updated.start_date,
      endDate: updated.end_date,
      duration: updated.duration,
      remaining: updated.remaining,
      status: updated.status,
      reason: updated.reason || undefined,
      submittedDate: updated.submitted_date,
      addedBy: updated.added_by || "System",
      balanceChange: -delta,
      daysRemaining,
    })
  } catch (error) {
    console.error("Error editing leave request:", error)
    return NextResponse.json(
      { error: `Failed to edit leave: ${error instanceof Error ? error.message : "unknown error"}` },
      { status: 500 },
    )
  }
}

export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params

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
