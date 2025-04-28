import { NextResponse } from "next/server"
import { supabase } from "@/lib/supabase"
import * as XLSX from "xlsx"
import type { EmployeeDocument } from "@/lib/types"

export async function POST(request: Request) {
  try {
    const formData = await request.formData()
    const format = formData.get("format") as string
    const branch = formData.get("branch") as string
    const status = formData.get("status") as string
    const search = formData.get("search") as string
    const sortColumn = (formData.get("sortColumn") as string) || "employee_name"
    const sortOrder = (formData.get("sortOrder") as string) || "asc"

    // Fetch all documents
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
              "right_to_work_days_left.gt.30,right_to-work_days_left.lte.90," +
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

    // Apply sorting
    if (sortColumn && sortOrder) {
      // Map frontend column names to database column names
      const columnMapping: Record<string, string> = {
        employeeName: "employee_name",
        branch: "branch",
        status: "status",
        country: "country",
        passportExpiry: "passport_expiry",
        passportDaysLeft: "passport_days_left",
        rightToWorkExpiry: "right_to_work_expiry",
        rightToWorkDaysLeft: "right_to_work_days_left",
        brpExpiry: "brp_expiry",
        brpDaysLeft: "brp_days_left",
        otherDocumentExpiry: "other_document_expiry",
        otherDocumentDaysLeft: "other_document_days_left",
      }

      const dbColumn = columnMapping[sortColumn] || sortColumn
      const order = sortOrder.toLowerCase() === "desc" ? false : true
      query = query.order(dbColumn, { ascending: order })
    }

    // Execute the query
    const { data, error } = await query

    if (error) {
      throw error
    }

    // Transform the data to match our frontend types
    const documents = data.map((doc) => ({
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

    // Separate regular and sponsored employees
    const regularEmployees = documents.filter((doc) => !doc.isSponsored)
    const sponsoredEmployees = documents.filter((doc) => doc.isSponsored)

    // Format data for export
    if (format === "csv") {
      return handleCsvExport(regularEmployees, sponsoredEmployees)
    } else {
      return handleExcelExport(regularEmployees, sponsoredEmployees)
    }
  } catch (error) {
    console.error("Error exporting documents:", error)
    return NextResponse.json({ error: "Failed to export documents" }, { status: 500 })
  }
}

function handleCsvExport(regularEmployees: EmployeeDocument[], sponsoredEmployees: EmployeeDocument[]) {
  // Group documents by employee
  const regularEmployeeMap = groupDocumentsByEmployee(regularEmployees)
  const sponsoredEmployeeMap = groupDocumentsByEmployee(sponsoredEmployees)

  // Create CSV content for regular employees - WITHOUT 20 Hours Restriction column
  let regularCsv =
    "Employee Name,Branch,Status,Country,Passport,Passport Days Left,Right to Work,Right to Work Days Left,BRP,BRP Days Left,Other Document,Other Document Days Left,Sponsored\n"

  // Add data rows for regular employees
  for (const [employeeId, employee] of regularEmployeeMap.entries()) {
    regularCsv += `"${employee.employeeName}","${employee.branch}","${employee.status}","${employee.country}",`

    // Add passport data
    regularCsv += `"${employee.passportExpiry || ""}",${employee.passportDaysLeft || ""},`

    // Add right to work data
    regularCsv += `"${employee.rightToWorkExpiry || ""}",${employee.rightToWorkDaysLeft || ""},`

    // Add BRP data
    regularCsv += `"${employee.brpExpiry || ""}",${employee.brpDaysLeft || ""},`

    // Add other document data
    regularCsv += `"${employee.otherDocumentType ? employee.otherDocumentType + ": " + (employee.otherDocumentExpiry || "") : ""}",${employee.otherDocumentDaysLeft || ""},`

    // Add sponsored status
    regularCsv += `"${employee.isSponsored ? "Yes" : "No"}"\n`
  }

  // Create CSV content for sponsored employees - WITH 20 Hours Restriction column
  let sponsoredCsv =
    "Employee Name,Branch,Status,Country,Passport,Passport Days Left,Right to Work,Right to Work Days Left,BRP,BRP Days Left,Other Document,Other Document Days Left,Sponsored,20 Hours Restriction\n"

  // Add data rows for sponsored employees
  for (const [employeeId, employee] of sponsoredEmployeeMap.entries()) {
    sponsoredCsv += `"${employee.employeeName}","${employee.branch}","${employee.status}","${employee.country}",`

    // Add passport data
    sponsoredCsv += `"${employee.passportExpiry || ""}",${employee.passportDaysLeft || ""},`

    // Add right to work data
    sponsoredCsv += `"${employee.rightToWorkExpiry || ""}",${employee.rightToWorkDaysLeft || ""},`

    // Add BRP data
    sponsoredCsv += `"${employee.brpExpiry || ""}",${employee.brpDaysLeft || ""},`

    // Add other document data
    sponsoredCsv += `"${employee.otherDocumentType ? employee.otherDocumentType + ": " + (employee.otherDocumentExpiry || "") : ""}",${employee.otherDocumentDaysLeft || ""},`

    // Add sponsored status and 20 hours restriction
    sponsoredCsv += `"${employee.isSponsored ? "Yes" : "No"}","${employee.is20Hours ? "Yes" : "No"}"\n`
  }

  // Combine both CSVs with headers
  const combinedCsv = "REGULAR EMPLOYEES\n" + regularCsv + "\n\nSPONSORED EMPLOYEES\n" + sponsoredCsv

  // Return the CSV file
  const currentDate = new Date().toISOString().split("T")[0]
  const filename = `document-tracker-${currentDate}.csv`

  return new NextResponse(combinedCsv, {
    status: 200,
    headers: {
      "Content-Type": "text/csv",
      "Content-Disposition": `attachment; filename="${filename}"`,
    },
  })
}

function handleExcelExport(regularEmployees: EmployeeDocument[], sponsoredEmployees: EmployeeDocument[]) {
  // Group documents by employee
  const regularEmployeeMap = groupDocumentsByEmployee(regularEmployees)
  const sponsoredEmployeeMap = groupDocumentsByEmployee(sponsoredEmployees)

  // Create workbook and worksheets
  const workbook = XLSX.utils.book_new()

  // Format data for regular employees worksheet - WITHOUT 20 Hours Restriction column
  const regularData = []

  // Add header row for regular employees
  regularData.push([
    "Employee Name",
    "Branch",
    "Status",
    "Country",
    "Passport",
    "Passport Days Left",
    "Right to Work",
    "Right to Work Days Left",
    "BRP",
    "BRP Days Left",
    "Other Document",
    "Other Document Days Left",
    "Sponsored",
  ])

  // Add data rows for regular employees
  for (const [employeeId, employee] of regularEmployeeMap.entries()) {
    regularData.push([
      employee.employeeName,
      employee.branch,
      employee.status,
      employee.country,
      employee.passportExpiry || "",
      employee.passportDaysLeft || "",
      employee.rightToWorkExpiry || "",
      employee.rightToWorkDaysLeft || "",
      employee.brpExpiry || "",
      employee.brpDaysLeft || "",
      employee.otherDocumentType ? `${employee.otherDocumentType}: ${employee.otherDocumentExpiry || ""}` : "",
      employee.otherDocumentDaysLeft || "",
      employee.isSponsored ? "Yes" : "No",
    ])
  }

  // Format data for sponsored employees worksheet - WITH 20 Hours Restriction column
  const sponsoredData = []

  // Add header row for sponsored employees
  sponsoredData.push([
    "Employee Name",
    "Branch",
    "Status",
    "Country",
    "Passport",
    "Passport Days Left",
    "Right to Work",
    "Right to Work Days Left",
    "BRP",
    "BRP Days Left",
    "Other Document",
    "Other Document Days Left",
    "Sponsored",
    "20 Hours Restriction",
  ])

  // Add data rows for sponsored employees
  for (const [employeeId, employee] of sponsoredEmployeeMap.entries()) {
    sponsoredData.push([
      employee.employeeName,
      employee.branch,
      employee.status,
      employee.country,
      employee.passportExpiry || "",
      employee.passportDaysLeft || "",
      employee.rightToWorkExpiry || "",
      employee.rightToWorkDaysLeft || "",
      employee.brpExpiry || "",
      employee.brpDaysLeft || "",
      employee.otherDocumentType ? `${employee.otherDocumentType}: ${employee.otherDocumentExpiry || ""}` : "",
      employee.otherDocumentDaysLeft || "",
      employee.isSponsored ? "Yes" : "No",
      employee.is20Hours ? "Yes" : "No",
    ])
  }

  // Create worksheets from the data
  const regularWorksheet = XLSX.utils.aoa_to_sheet(regularData)
  const sponsoredWorksheet = XLSX.utils.aoa_to_sheet(sponsoredData)

  // Add worksheets to workbook with the names "Regular Employees" and "Sponsored Employees"
  XLSX.utils.book_append_sheet(workbook, regularWorksheet, "Regular Employees")
  XLSX.utils.book_append_sheet(workbook, sponsoredWorksheet, "Sponsored Employees")

  // Generate Excel file
  const excelBuffer = XLSX.write(workbook, { type: "buffer", bookType: "xlsx" })

  // Return the Excel file
  const currentDate = new Date().toISOString().split("T")[0]
  const filename = `document-tracker-${currentDate}.xlsx`

  return new NextResponse(excelBuffer, {
    status: 200,
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="${filename}"`,
    },
  })
}

// Helper function to group documents by employee
function groupDocumentsByEmployee(documents: EmployeeDocument[]) {
  const employeeMap = new Map<string, EmployeeDocument>()

  for (const doc of documents) {
    if (!employeeMap.has(doc.employeeId)) {
      // Create a new employee entry with basic info
      employeeMap.set(doc.employeeId, {
        id: doc.id,
        employeeId: doc.employeeId,
        employeeName: doc.employeeName,
        branch: doc.branch,
        status: doc.status,
        country: doc.country,
        passportExpiry: null,
        passportDaysLeft: null,
        rightToWorkExpiry: null,
        rightToWorkDaysLeft: null,
        brpExpiry: null,
        brpDaysLeft: null,
        otherDocumentType: null,
        otherDocumentExpiry: null,
        otherDocumentDaysLeft: null,
        isSponsored: doc.isSponsored,
        is20Hours: doc.is20Hours,
      })
    }

    // Update the employee entry with document details
    const employee = employeeMap.get(doc.employeeId)!

    // Update passport info if available
    if (doc.passportExpiry) {
      employee.passportExpiry = doc.passportExpiry
      employee.passportDaysLeft = doc.passportDaysLeft
    }

    // Update right to work info if available
    if (doc.rightToWorkExpiry) {
      employee.rightToWorkExpiry = doc.rightToWorkExpiry
      employee.rightToWorkDaysLeft = doc.rightToWorkDaysLeft
    }

    // Update BRP info if available
    if (doc.brpExpiry) {
      employee.brpExpiry = doc.brpExpiry
      employee.brpDaysLeft = doc.brpDaysLeft
    }

    // Update other document info if available
    if (doc.otherDocumentExpiry) {
      employee.otherDocumentType = doc.otherDocumentType
      employee.otherDocumentExpiry = doc.otherDocumentExpiry
      employee.otherDocumentDaysLeft = doc.otherDocumentDaysLeft
    }
  }

  return employeeMap
}
