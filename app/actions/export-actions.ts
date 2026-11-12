import { supabase } from "@/lib/supabase"
import type { LeaveRequest, Employee } from "@/lib/types"
import {
  convertToCSV,
  convertToExcel,
  formatEmployeesForExport,
  formatLeaveRequestsForExport,
} from "@/lib/export-utils"

// Export employees function
export async function exportEmployees(formData: FormData) {
  try {
    const format = formData.get("format") as string
    const branch = formData.get("branch") as string
    const search = formData.get("search") as string

    // Get sorting parameters
    const sortColumn = formData.get("sortColumn") as string
    const sortOrder = formData.get("sortOrder") as string

    // Map frontend column names to database column names
    const columnMapping: Record<string, string> = {
      name: "name",
      employeeCode: "employee_code",
      jobTitle: "job_title",
      branch: "branch",
      daysTaken: "days_taken",
      daysRemaining: "days_remaining",
      hours: "hours",
    }

    // Build the query
    let query = supabase.from("employees").select("*")

    // Apply filters
    if (branch && branch !== "all") {
      query = query.eq("branch", branch)
    }

    if (search) {
      query = query.or(`name.ilike.%${search}%,employee_code.ilike.%${search}%`)
    }

    // Apply sorting
    if (sortColumn && sortOrder) {
      const dbColumn = columnMapping[sortColumn] || sortColumn
      const order = sortOrder.toLowerCase() === "desc" ? false : true
      query = query.order(dbColumn, { ascending: order })
    } else {
      // Default sorting by name
      query = query.order("name", { ascending: true })
    }

    // Execute the query
    const { data, error } = await query

    if (error) {
      throw error
    }

    // Transform the data to match our frontend types
    const employees: Employee[] = data
      ? data.map((emp) => ({
          id: emp.id,
          name: emp.name,
          employeeCode: emp.employee_code,
          jobTitle: emp.job_title,
          branch: emp.branch,
          daysTaken: emp.days_taken,
          daysRemaining: emp.days_remaining,
          hours: emp.hours,
          email: emp.email || undefined,
          phone: emp.phone || undefined,
          status: emp.status,
        }))
      : []

    // Format the data for export
    const formattedData = formatEmployeesForExport(employees)

    // Generate the file content based on the format
    let fileContent = ""
    let fileName = ""
    let contentType = ""

    const currentDate = new Date().toISOString().split("T")[0]

    if (format === "csv") {
      fileContent = convertToCSV(formattedData)
      fileName = `employees-${currentDate}.csv`
      contentType = "text/csv"
    } else if (format === "excel") {
      fileContent = convertToExcel(formattedData)
      fileName = `employees-${currentDate}.xls`
      contentType = "application/vnd.ms-excel"
    } else {
      throw new Error("Unsupported export format")
    }

    return {
      success: true,
      fileContent,
      fileName,
      contentType,
    }
  } catch (error) {
    console.error("Error exporting employees:", error)
    return {
      success: false,
      message: error instanceof Error ? error.message : "Failed to export employees",
    }
  }
}

// Update the exportLeaveRequests function to handle sorting parameters
export async function exportLeaveRequests(formData: FormData) {
  try {
    const format = formData.get("format") as string
    const branch = formData.get("branch") as string
    const type = formData.get("type") as string
    const employee = formData.get("employee") as string
    const employeeId = formData.get("employeeId") as string
    const startDate = formData.get("startDate") as string
    const endDate = formData.get("endDate") as string
    const dateFilterMode = (formData.get("dateFilterMode") as string) || "overlap"

    // Get sorting parameters
    const sortColumn = formData.get("sortColumn") as string
    const sortDirection = formData.get("sortDirection") as string

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

    // Build the query - don't use pagination limits when exporting all
    let query = supabase.from("leave_requests").select("*")

    // Apply filters
    if (branch && branch !== "all") {
      query = query.eq("branch", branch)
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

    // Apply date range filter if provided
    if (startDate && endDate) {
      if (dateFilterMode === "overlap") {
        // Overlapping mode: Include leaves that overlap with the selected date range
        query = query
          .filter("end_date", "gte", startDate) // Leave ends on or after filter start
          .filter("start_date", "lte", endDate) // Leave starts on or before filter end
      } else {
        // Restrictive mode: Only include leaves that fall completely within the selected date range
        query = query
          .filter("start_date", "gte", startDate) // Leave starts on or after filter start
          .filter("end_date", "lte", endDate) // Leave ends on or before filter end
      }
    }

    // Apply sorting if provided
    if (sortColumn && sortDirection && columnMapping[sortColumn]) {
      const dbColumn = columnMapping[sortColumn]
      query = query.order(dbColumn, { ascending: sortDirection === "asc" })
    } else {
      // Default sorting by submitted_date descending (newest first)
      query = query.order("submitted_date", { ascending: false })
    }

    // Execute the query - get ALL records for export
    const { data, error } = await query

    if (error) {
      throw error
    }

    // Get employee codes and hours for each leave request
    const employeeCodeMap = new Map()
    const employeeHoursMap = new Map()

    // Only attempt to fetch employee codes if there are leave requests
    if (data && data.length > 0) {
      try {
        // Fetch all employees and create a mapping
        const { data: employees } = await supabase.from("employees").select("id, employee_code, hours")

        if (employees) {
          // Create maps of employee IDs to employee codes and hours
          employees.forEach((emp) => {
            employeeCodeMap.set(emp.id, emp.employee_code)
            employeeHoursMap.set(emp.id, emp.hours)
          })
        }
      } catch (employeesError) {
        console.error("Error fetching employee data:", employeesError)
      }
    }

    // Transform the data to match our frontend types
    const leaveRequests: LeaveRequest[] = data
      ? data.map((req) => ({
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
          addedBy: req.added_by || "",
        }))
      : []

    // Format the data for export
    const formattedData = formatLeaveRequestsForExport(leaveRequests)

    // Generate the file content based on the format
    let fileContent = ""
    let fileName = ""
    let contentType = ""

    const currentDate = new Date().toISOString().split("T")[0]

    if (format === "csv") {
      fileContent = convertToCSV(formattedData)
      fileName = `leave-requests-${currentDate}.csv`
      contentType = "text/csv"
    } else if (format === "excel") {
      fileContent = convertToExcel(formattedData)
      fileName = `leave-requests-${currentDate}.xls`
      contentType = "application/vnd.ms-excel"
    } else {
      throw new Error("Unsupported export format")
    }

    return {
      success: true,
      fileContent,
      fileName,
      contentType,
    }
  } catch (error) {
    console.error("Error exporting leave requests:", error)
    return {
      success: false,
      message: error instanceof Error ? error.message : "Failed to export leave requests",
    }
  }
}
