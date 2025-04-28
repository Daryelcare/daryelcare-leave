import { NextResponse } from "next/server"
import { supabase } from "@/lib/supabase"

async function validateLeaveRequest(data: any) {
  try {
    // Get the employee's current leave balance
    const { data: employee, error: empError } = await supabase
      .from("employees")
      .select("days_remaining, days_taken")
      .eq("id", data.employeeId)
      .single()

    if (empError) throw empError

    if (!employee) {
      return {
        valid: false,
        message: "Employee not found",
      }
    }

    // Get all pending leave requests for this employee (regardless of type)
    const { data: pendingRequests, error: pendingError } = await supabase
      .from("leave_requests")
      .select("duration")
      .eq("employee_id", data.employeeId)
      .eq("status", "Pending")

    if (pendingError) throw pendingError

    // Calculate total days from pending requests
    const pendingDays = pendingRequests.reduce((total, request) => total + request.duration, 0)

    // Calculate available days considering pending requests
    const availableDays = employee.days_remaining - pendingDays

    // We'll always return valid=true, but include a warning if exceeding
    const isExceeding = data.duration > availableDays

    return {
      valid: true, // Always valid, but may have a warning
      isExceeding,
      message: isExceeding
        ? `Warning: This request exceeds the remaining leave balance. Employee has ${availableDays} days available but requested ${data.duration} days.`
        : null,
      remainingDays: availableDays - data.duration, // This can be negative now
    }
  } catch (error) {
    console.error("Error validating leave request:", error)
    // If there's an error in validation, don't allow the request to proceed
    return {
      valid: false,
      message: "Error validating leave request. Please try again.",
    }
  }
}

export async function GET(request: Request) {
  try {
    // Get query parameters
    const { searchParams } = new URL(request.url)
    const branch = searchParams.get("branch")
    const branches = searchParams.get("branches")
    const type = searchParams.get("type")
    const employee = searchParams.get("employee")?.toLowerCase()
    const employeeId = searchParams.get("employeeId")
    const status = searchParams.get("status")
    const exportAll = searchParams.get("exportAll") === "true"

    // Get sorting parameters
    const sortColumn = searchParams.get("sortColumn")
    const sortDirection = searchParams.get("sortDirection")

    // Map frontend column names to database column names
    const columnMapping: Record<string, string> = {
      employee: "employee_name",
      branch: "branch",
      type: "type",
      startDate: "start_date",
      endDate: "end_date",
      duration: "duration",
      remaining: "remaining",
      status: "status",
      submittedDate: "submitted_date",
    }

    // Build the query
    let query = supabase.from("leave_requests").select("*")

    // Apply filters
    if (branch && branch !== "all") {
      query = query.eq("branch", branch)
    } else if (branches) {
      // Handle multiple branches (comma-separated list)
      const branchList = branches.split(",")
      query = query.in("branch", branchList)
    }

    if (type && type !== "all") {
      query = query.eq("type", type)
    }

    if (employee) {
      query = query.ilike("employee_name", `%${employee}%`)
    }

    if (employeeId) {
      query = query.eq("employee_id", employeeId)
    }

    if (status) {
      query = query.eq("status", status)
    }

    // Apply sorting if provided
    if (sortColumn && sortDirection && columnMapping[sortColumn]) {
      const dbColumn = columnMapping[sortColumn]
      query = query.order(dbColumn, { ascending: sortDirection === "asc" })
    } else {
      // Default sorting by submitted_date descending (newest first)
      query = query.order("submitted_date", { ascending: false })
    }

    // Execute the query
    const { data, error } = await query

    if (error) {
      throw error
    }

    // Get employee codes for each leave request
    const employeeCodeMap = new Map()

    // Only attempt to fetch employee codes if there are leave requests
    if (data.length > 0) {
      try {
        // Instead of trying to join by ID, we'll fetch all employees and create a mapping
        const { data: employees } = await supabase.from("employees").select("id, employee_code")

        if (employees) {
          // Create a map of employee IDs to employee codes
          employees.forEach((emp) => {
            employeeCodeMap.set(emp.id, emp.employee_code)
          })
        }
      } catch (employeesError) {
        console.error("Error fetching employee codes:", employeesError)
        // Continue with empty map if there's an error
      }
    }

    // Transform the data to match our frontend types
    const leaveRequests = data.map((req) => ({
      id: req.id,
      employeeId: req.employee_id,
      employeeCode: employeeCodeMap.get(req.employee_id) || req.employee_id,
      employee: req.employee_name,
      branch: req.branch,
      type: req.type,
      startDate: req.start_date,
      endDate: req.end_date,
      duration: req.duration,
      remaining: req.remaining,
      status: req.status,
      reason: req.reason || undefined,
      submittedDate: req.submitted_date,
      addedBy: req.added_by || "System",
    }))

    return NextResponse.json(leaveRequests)
  } catch (error) {
    console.error("Error fetching leave requests:", error)
    return NextResponse.json({ error: "Failed to fetch leave requests" }, { status: 500 })
  }
}

export async function POST(request: Request) {
  try {
    const data = await request.json()

    // Validate required fields
    if (!data.employeeId || !data.type || !data.startDate || !data.endDate) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 })
    }

    // Validate leave request against employee's remaining days
    // Now applies to ALL leave types, but allows exceeding with warning
    const validation = await validateLeaveRequest(data)
    if (!validation.valid) {
      return NextResponse.json({ error: validation.message }, { status: 400 })
    }

    // Get the employee's current remaining days
    // Get the employee's current leave balance
    const { data: employee, error: empError } = await supabase
      .from("employees")
      .select("days_remaining")
      .eq("id", data.employeeId)
      .single()

    if (empError) throw empError

    // Get all pending leave requests for this employee
    const { data: pendingRequests, error: pendingError } = await supabase
      .from("leave_requests")
      .select("duration")
      .eq("employee_id", data.employeeId)
      .eq("status", "Pending")

    if (pendingError) throw pendingError

    // Calculate total days from pending requests
    const pendingDays = pendingRequests.reduce((total, request) => total + request.duration, 0)

    // Calculate what will remain after this request and all pending requests (if approved)
    const availableDays = employee.days_remaining - pendingDays
    const remainingDays = availableDays - data.duration
    // Allow negative remaining days

    // Insert into Supabase
    const { data: newRequest, error } = await supabase
      .from("leave_requests")
      .insert({
        employee_id: data.employeeId,
        employee_name: data.employee,
        branch: data.branch,
        type: data.type,
        start_date: data.startDate,
        end_date: data.endDate,
        duration: data.duration,
        remaining: remainingDays, // Can be negative
        status: "Approved",
        reason: data.reason,
        submitted_date: new Date().toLocaleDateString("en-GB"),
        added_by: data.addedBy || "System",
      })
      .select()
      .single()

    if (error) {
      throw error
    }

    // Update the employee's leave balance for ALL leave types
    const { data: employeeData, error: empDataError } = await supabase
      .from("employees")
      .select("days_taken, days_remaining")
      .eq("id", data.employeeId)
      .single()

    if (empDataError) throw empDataError

    // Update the employee's leave balance
    const { error: updateError } = await supabase
      .from("employees")
      .update({
        days_taken: employeeData.days_taken + data.duration,
        days_remaining: employeeData.days_remaining - data.duration, // Can go negative
      })
      .eq("id", data.employeeId)

    if (updateError) throw updateError

    // Transform to match frontend types
    const transformedRequest = {
      id: newRequest.id,
      employeeId: newRequest.employee_id,
      employee: newRequest.employee_name,
      branch: newRequest.branch,
      type: newRequest.type,
      startDate: newRequest.start_date,
      endDate: newRequest.end_date,
      duration: newRequest.duration,
      remaining: newRequest.remaining,
      status: newRequest.status,
      reason: newRequest.reason || undefined,
      submittedDate: newRequest.submitted_date,
    }

    return NextResponse.json(transformedRequest, { status: 201 })
  } catch (error) {
    console.error("Error creating leave request:", error)
    return NextResponse.json({ error: "Failed to create leave request" }, { status: 500 })
  }
}
