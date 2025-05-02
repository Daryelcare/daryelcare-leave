
"use server"

import { supabase } from "@/lib/supabase"
import type { LeaveRequest } from "@/lib/types"

// Helper function to check if a leave type should affect the days balance
function shouldDeductFromBalance(leaveType: string): boolean {
  // Only "Annual Leave" and "Working Holiday" should deduct from the 28 days balance
  return leaveType === "Annual Leave" || leaveType === "Working Holiday"
}

export async function submitLeaveRequest(formData: FormData) {
  try {
    // Extract form data
    const employeeId = formData.get("employeeId") as string
    const employee = formData.get("employee") as string
    const branch = formData.get("branch") as string
    const type = formData.get("type") as string
    const startDate = formData.get("startDate") as string
    const endDate = formData.get("endDate") as string
    const reason = formData.get("reason") as string
    const addedBy = (formData.get("addedBy") as string) || ""

    // Validate required fields
    if (!employeeId || !employee || !branch || !type || !startDate || !endDate) {
      return {
        success: false,
        message: "Please fill in all required fields",
      }
    }

    // Calculate duration (in a real app, you would use a proper date library)
    const startParts = startDate.split("/")
    const endParts = endDate.split("/")
    const start = new Date(
      Number.parseInt(startParts[2]),
      Number.parseInt(startParts[1]) - 1,
      Number.parseInt(startParts[0]),
    )
    const end = new Date(Number.parseInt(endParts[2]), Number.parseInt(endParts[1]) - 1, Number.parseInt(endParts[0]))
    const duration = Math.floor((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)) + 1

    // Get the employee's current leave balance
    const { data: employeeData, error: empError } = await supabase
      .from("employees")
      .select("days_remaining")
      .eq("id", employeeId)
      .single()

    if (empError) {
      throw empError
    }

    if (!employeeData) {
      return {
        success: false,
        message: "Employee not found",
      }
    }

    // Get all pending leave requests for this employee
    const { data: pendingRequests, error: pendingError } = await supabase
      .from("leave_requests")
      .select("duration, type")
      .eq("employee_id", employeeId)
      .eq("status", "Pending")

    if (pendingError) throw pendingError

    // Calculate total days from pending requests that should affect balance
    const pendingDays = pendingRequests.reduce((total, request) => {
      // Only count requests that should deduct from balance
      if (shouldDeductFromBalance(request.type)) {
        return total + request.duration
      }
      return total
    }, 0)

    // Calculate what will remain after this request and all pending requests (if approved)
    const availableDays = employeeData.days_remaining - pendingDays
    
    // Only reduce remaining days if this leave type should deduct from balance
    const remainingDays = shouldDeductFromBalance(type) 
      ? availableDays - duration 
      : availableDays

    // Insert into Supabase
    const { data, error } = await supabase
      .from("leave_requests")
      .insert({
        employee_id: employeeId,
        employee_name: employee,
        branch,
        type,
        start_date: startDate,
        end_date: endDate,
        duration,
        remaining: remainingDays, // This will be the same as availableDays if type doesn't deduct
        status: "Approved",
        reason,
        submitted_date: new Date().toLocaleDateString("en-GB"),
        added_by: addedBy, // Use the provided addedBy value
      })
      .select()
      .single()

    if (error) {
      throw error
    }

    // Update the employee's leave balance only if this type should deduct from balance
    if (shouldDeductFromBalance(type)) {
      const { data: empData, error: empUpdateError } = await supabase
        .from("employees")
        .select("days_taken, days_remaining")
        .eq("id", employeeId)
        .single()

      if (empUpdateError) throw empUpdateError

      // Update the employee's leave balance
      const { error: updateError } = await supabase
        .from("employees")
        .update({
          days_taken: empData.days_taken + duration,
          days_remaining: empData.days_remaining - duration, // Can be negative
        })
        .eq("id", employeeId)

      if (updateError) throw updateError
    }

    // Transform to match frontend types
    const leaveRequest: LeaveRequest = {
      id: data.id,
      employeeId: data.employee_id,
      employee: data.employee_name,
      branch: data.branch,
      type: data.type as any,
      startDate: data.start_date,
      endDate: data.end_date,
      duration: data.duration,
      status: data.status as any,
      reason: data.reason || undefined,
      submittedDate: data.submitted_date,
      addedBy: data.added_by || "",
    }

    return {
      success: true,
      message: "Leave request submitted successfully",
      data: leaveRequest,
    }
  } catch (error) {
    console.error("Error submitting leave request:", error)
    return {
      success: false,
      message: "An error occurred while submitting your leave request",
    }
  }
}

export async function approveLeaveRequest(id: string) {
  try {
    // First, get the leave request details
    const { data: leaveRequest, error: leaveError } = await supabase
      .from("leave_requests")
      .select("*")
      .eq("id", id)
      .single()

    if (leaveError) {
      throw leaveError
    }

    // Only update employee leave balance if this type should deduct from balance
    if (shouldDeductFromBalance(leaveRequest.type)) {
      // Get the employee's current leave balance
      const { data: employee, error: empError } = await supabase
        .from("employees")
        .select("days_remaining, days_taken")
        .eq("id", leaveRequest.employee_id)
        .single()

      if (empError) {
        throw empError
      }

      // Update the employee's leave balance (allow negative)
      const { error: updateError } = await supabase
        .from("employees")
        .update({
          days_taken: employee.days_taken + leaveRequest.duration,
          days_remaining: employee.days_remaining - leaveRequest.duration, // Can be negative
        })
        .eq("id", leaveRequest.employee_id)

      if (updateError) {
        throw updateError
      }
    }

    // Update the leave request status
    const { error } = await supabase.from("leave_requests").update({ status: "Approved" }).eq("id", id)

    if (error) {
      throw error
    }

    return {
      success: true,
      message: "Leave request approved successfully",
    }
  } catch (error) {
    console.error("Error approving leave request:", error)
    return {
      success: false,
      message: "An error occurred while approving the leave request",
    }
  }
}

export async function rejectLeaveRequest(id: string) {
  try {
    const { error } = await supabase.from("leave_requests").update({ status: "Rejected" }).eq("id", id)

    if (error) {
      throw error
    }

    return {
      success: true,
      message: "Leave request rejected successfully",
    }
  } catch (error) {
    console.error("Error rejecting leave request:", error)
    return {
      success: false,
      message: "An error occurred while rejecting the leave request",
    }
  }
}
