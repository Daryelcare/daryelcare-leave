import { supabase } from "@/lib/supabaseClient"
import type { LeaveRequest, Employee, EmployeeDocument } from "@/lib/types"
import {
  convertToCSV,
  convertToExcel,
  formatEmployeesForExport,
  formatLeaveRequestsForExport,
  formatDocumentsForExport,
} from "@/lib/export-utils"

// Export employees function
export async function exportEmployees(formData: FormData) {
  try {
    const format = formData.get("format") as string
    const branch = formData.get("branch") as string
    const search = formData.get("search") as string
    const exportAll = formData.get("exportAll") === "true"

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
    const exportAll = formData.get("exportAll") === "true"

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
    const filterMode = dateFilterMode === "overlap" ? "overlapping" : "restrictive"

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

// Export documents function
export async function exportDocuments(formData: FormData) {
  try {
    const format = formData.get("format") as string
    const branch = formData.get("branch") as string
    const status = formData.get("status") as string
    const search = formData.get("search") as string
    const exportAll = formData.get("exportAll") === "true"

    // Get sorting parameters
    const sortColumn = formData.get("sortColumn") as string
    const sortDirection = formData.get("sortDirection") as string

    // Build the query
    let query = supabase.from("documents").select("*")

    // Apply filters
    if (branch && branch !== "all") {
      query = query.eq("branch", branch)
    }

    if (search) {
      query = query.or(`employee_name.ilike.%${search}%,country.ilike.%${search}%`)
    }

    // Apply status filter
    if (status && status !== "all") {
      switch (status) {
        case "expired":
          query = query.or(
            "passport_days_left.lte.0,right_to_work_days_left.lte.0,brp_days_left.lte.0,other_document_days_left.lte.0",
          )
          break
        case "expiring7":
          query = query.or(
            "passport_days_left.gt.0,passport_days_left.lte.7," +
              "right_to_work_days_left.gt.0,right_to_work_days_left.lte.7," +
              "brp_days_left.gt.0,brp_days_left.lte.7," +
              "other_document_days_left.gt.0,other_document_days_left.lte.7",
          )
          break
        case "expiring30":
          query = query.or(
            "passport_days_left.gt.7,passport_days_left.lte.30," +
              "right_to_work_days_left.gt.7,right_to_work_days_left.lte.30," +
              "brp_days_left.gt.7,brp_days_left.lte.30," +
              "other_document_days_left.gt.7,other_document_days_left.lte.30",
          )
          break
        case "expiring90":
          query = query.or(
            "passport_days_left.gt.30,passport_days_left.lte.90," +
              "right_to_work_days_left.gt.30,right_to_work_days_left.lte.90," +
              "brp_days_left.gt.30,brp_days_left.lte.90," +
              "other_document_days_left.gt.30,other_document_days_left.lte.90",
          )
          break
        case "valid":
          query = query.and(
            "passport_days_left.gt.90,right_to_work_days_left.gt.90,brp_days_left.gt.90,other_document_days_left.gt.90",
          )
          break
      }
    }

    // Apply sorting if provided
    if (sortColumn && sortDirection) {
      // Map frontend column names to database column names if needed
      const dbColumn = sortColumn.includes("_") ? sortColumn : sortColumn.replace(/([A-Z])/g, "_$1").toLowerCase()
      query = query.order(dbColumn, { ascending: sortDirection === "asc" })
    }

    // Execute the query
    const { data, error } = await query

    if (error) {
      throw error
    }

    // Transform the data to match our frontend types
    const documents: EmployeeDocument[] = data.map((doc) => ({
      id: doc.id,
      employeeId: doc.employee_id,
      employeeName: doc.employee_name,
      branch: doc.branch,
      status: doc.status,
      country: doc.country,
      passportExpiry: doc.passport_expiry || null,
      passportDaysLeft: doc.passport_days_left || null,
      rightToWorkExpiry: doc.right_to_work_expiry || null,
      rightToWorkDaysLeft: doc.right_to_work_days_left || null,
      brpExpiry: doc.brp_expiry || null,
      brpDaysLeft: doc.brp_days_left || null,
      otherDocumentType: doc.other_document_type || null,
      otherDocumentExpiry: doc.other_document_expiry || null,
      otherDocumentDaysLeft: doc.other_document_days_left || null,
      isSponsored: doc.is_sponsored || false,
      is20Hours: doc.is_20_hours || false,
    }))

    // Format the data for export
    const formattedData = formatDocumentsForExport(documents)

    // Generate the file content based on the format
    let fileContent = ""
    let fileName = ""
    let contentType = ""

    const currentDate = new Date().toISOString().split("T")[0]

    if (format === "csv") {
      fileContent = convertToCSV(formattedData)
      fileName = `documents-${currentDate}.csv`
      contentType = "text/csv"
    } else if (format === "excel") {
      fileContent = convertToExcel(formattedData)
      fileName = `documents-${currentDate}.xls`
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
    console.error("Error exporting documents:", error)
    return {
      success: false,
      message: error instanceof Error ? error.message : "Failed to export documents",
    }
  }
}
