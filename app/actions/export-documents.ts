"use server"

import { supabase } from "@/lib/supabase"
import type { EmployeeDocument } from "@/lib/types"

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
        documentType: doc.documentType || "",
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

// Helper function to convert documents to CSV
function convertToCSV(documents: EmployeeDocument[]): string {
  // Separate regular and sponsored employees
  const regularEmployees = documents.filter((doc) => !doc.isSponsored)
  const sponsoredEmployees = documents.filter((doc) => doc.isSponsored)

  // Group documents by employee
  const regularEmployeeMap = groupDocumentsByEmployee(regularEmployees)
  const sponsoredEmployeeMap = groupDocumentsByEmployee(sponsoredEmployees)

  // Create CSV content for regular employees - WITHOUT 20 Hours Restriction column
  let regularCsv =
    "REGULAR EMPLOYEES\nEmployee Name,Branch,Status,Country,Passport,Passport Days Left,Right to Work,Right to Work Days Left,BRP,BRP Days Left,Other Document,Other Document Days Left,Sponsored\n"

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
    "\nSPONSORED EMPLOYEES\nEmployee Name,Branch,Status,Country,Passport,Passport Days Left,Right to Work,Right to Work Days Left,BRP,BRP Days Left,Other Document,Other Document Days Left,Sponsored,20 Hours Restriction\n"

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

  // Combine both CSVs
  return regularCsv + sponsoredCsv
}

// Helper function to convert documents to Excel XML (SpreadsheetML)
function convertToExcel(documents: EmployeeDocument[]): string {
  // Separate regular and sponsored employees
  const regularEmployees = documents.filter((doc) => !doc.isSponsored)
  const sponsoredEmployees = documents.filter((doc) => doc.isSponsored)

  // Group documents by employee
  const regularEmployeeMap = groupDocumentsByEmployee(regularEmployees)
  const sponsoredEmployeeMap = groupDocumentsByEmployee(sponsoredEmployees)

  // Create a simple XML spreadsheet format
  let xml = '<?xml version="1.0"?><?mso-application progid="Excel.Sheet"?>'
  xml +=
    '<Workbook xmlns="urn:schemas-microsoft-com:office:spreadsheet" xmlns:ss="urn:schemas-microsoft-com:office:spreadsheet">'

  // Regular Employees Worksheet (Sheet1)
  xml += '<Worksheet ss:Name="Regular Employees"><Table>'

  // Add headers for regular employees
  xml += "<Row>"
  const regularHeaders = [
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
  ]

  regularHeaders.forEach((header) => {
    xml += `<Cell><Data ss:Type="String">${header}</Data></Cell>`
  })
  xml += "</Row>"

  // Add data rows for regular employees
  for (const [employeeId, employee] of regularEmployeeMap.entries()) {
    xml += "<Row>"

    // Escape XML special characters
    const escapeXml = (str: string) => {
      return str
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&apos;")
    }

    xml += `<Cell><Data ss:Type="String">${escapeXml(employee.employeeName)}</Data></Cell>`
    xml += `<Cell><Data ss:Type="String">${escapeXml(employee.branch)}</Data></Cell>`
    xml += `<Cell><Data ss:Type="String">${escapeXml(employee.status)}</Data></Cell>`
    xml += `<Cell><Data ss:Type="String">${escapeXml(employee.country)}</Data></Cell>`

    // Passport data
    xml += `<Cell><Data ss:Type="String">${employee.passportExpiry ? escapeXml(employee.passportExpiry) : ""}</Data></Cell>`
    xml += `<Cell><Data ss:Type="${employee.passportDaysLeft !== null ? "Number" : "String"}">${employee.passportDaysLeft !== null ? employee.passportDaysLeft : ""}</Data></Cell>`

    // Right to Work data
    xml += `<Cell><Data ss:Type="String">${employee.rightToWorkExpiry ? escapeXml(employee.rightToWorkExpiry) : ""}</Data></Cell>`
    xml += `<Cell><Data ss:Type="${employee.rightToWorkDaysLeft !== null ? "Number" : "String"}">${employee.rightToWorkDaysLeft !== null ? employee.rightToWorkDaysLeft : ""}</Data></Cell>`

    // BRP data
    xml += `<Cell><Data ss:Type="String">${employee.brpExpiry ? escapeXml(employee.brpExpiry) : ""}</Data></Cell>`
    xml += `<Cell><Data ss:Type="${employee.brpDaysLeft !== null ? "Number" : "String"}">${employee.brpDaysLeft !== null ? employee.brpDaysLeft : ""}</Data></Cell>`

    // Other document data
    const otherDocText = employee.otherDocumentType
      ? `${employee.otherDocumentType}: ${employee.otherDocumentExpiry || ""}`
      : ""
    xml += `<Cell><Data ss:Type="String">${escapeXml(otherDocText)}</Data></Cell>`
    xml += `<Cell><Data ss:Type="${employee.otherDocumentDaysLeft !== null ? "Number" : "String"}">${employee.otherDocumentDaysLeft !== null ? employee.otherDocumentDaysLeft : ""}</Data></Cell>`

    // Sponsored status
    xml += `<Cell><Data ss:Type="String">${employee.isSponsored ? "Yes" : "No"}</Data></Cell>`

    xml += "</Row>"
  }

  xml += "</Table></Worksheet>"

  // Sponsored Employees Worksheet (Sheet2)
  xml += '<Worksheet ss:Name="Sponsored Employees"><Table>'

  // Add headers for sponsored employees
  xml += "<Row>"
  const sponsoredHeaders = [
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
  ]

  sponsoredHeaders.forEach((header) => {
    xml += `<Cell><Data ss:Type="String">${header}</Data></Cell>`
  })
  xml += "</Row>"

  // Add data rows for sponsored employees
  for (const [employeeId, employee] of sponsoredEmployeeMap.entries()) {
    xml += "<Row>"

    // Escape XML special characters
    const escapeXml = (str: string) => {
      return str
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&apos;")
    }

    xml += `<Cell><Data ss:Type="String">${escapeXml(employee.employeeName)}</Data></Cell>`
    xml += `<Cell><Data ss:Type="String">${escapeXml(employee.branch)}</Data></Cell>`
    xml += `<Cell><Data ss:Type="String">${escapeXml(employee.status)}</Data></Cell>`
    xml += `<Cell><Data ss:Type="String">${escapeXml(employee.country)}</Data></Cell>`

    // Passport data
    xml += `<Cell><Data ss:Type="String">${employee.passportExpiry ? escapeXml(employee.passportExpiry) : ""}</Data></Cell>`
    xml += `<Cell><Data ss:Type="${employee.passportDaysLeft !== null ? "Number" : "String"}">${employee.passportDaysLeft !== null ? employee.passportDaysLeft : ""}</Data></Cell>`

    // Right to Work data
    xml += `<Cell><Data ss:Type="String">${employee.rightToWorkExpiry ? escapeXml(employee.rightToWorkExpiry) : ""}</Data></Cell>`
    xml += `<Cell><Data ss:Type="${employee.rightToWorkDaysLeft !== null ? "Number" : "String"}">${employee.rightToWorkDaysLeft !== null ? employee.rightToWorkDaysLeft : ""}</Data></Cell>`

    // BRP data
    xml += `<Cell><Data ss:Type="String">${employee.brpExpiry ? escapeXml(employee.brpExpiry) : ""}</Data></Cell>`
    xml += `<Cell><Data ss:Type="${employee.brpDaysLeft !== null ? "Number" : "String"}">${employee.brpDaysLeft !== null ? employee.brpDaysLeft : ""}</Data></Cell>`

    // Other document data
    const otherDocText = employee.otherDocumentType
      ? `${employee.otherDocumentType}: ${employee.otherDocumentExpiry || ""}`
      : ""
    xml += `<Cell><Data ss:Type="String">${escapeXml(otherDocText)}</Data></Cell>`
    xml += `<Cell><Data ss:Type="${employee.otherDocumentDaysLeft !== null ? "Number" : "String"}">${employee.otherDocumentDaysLeft !== null ? employee.otherDocumentDaysLeft : ""}</Data></Cell>`

    // Sponsored status
    xml += `<Cell><Data ss:Type="String">${employee.isSponsored ? "Yes" : "No"}</Data></Cell>`

    // 20 Hours Restriction
    xml += `<Cell><Data ss:Type="String">${employee.is20Hours ? "Yes" : "No"}</Data></Cell>`

    xml += "</Row>"
  }

  xml += "</Table></Worksheet></Workbook>"
  return xml
}

export async function exportDocuments(formData: FormData) {
  try {
    const format = formData.get("format") as string
    const branch = formData.get("branch") as string
    const status = formData.get("status") as string
    const documentType = formData.get("documentType") as string
    const search = formData.get("search") as string
    const sortColumn = formData.get("sortColumn") as string
    const sortOrder = formData.get("sortOrder") as string

    // Build the query
    let query = supabase.from("documents").select("*")

    // Apply filters
    if (branch && branch !== "all") {
      query = query.eq("branch", branch)
    }

    if (search) {
      query = query.or(`employee_name.ilike.%${search}%,country.ilike.%${search}%`)
    }

    if (documentType && documentType !== "all") {
      query = query.eq("document_type", documentType)
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
      documentType: doc.document_type || "",
    }))

    // Generate the file content based on the format
    let fileContent = ""
    let fileName = ""
    let contentType = ""

    const currentDate = new Date().toISOString().split("T")[0]

    if (format === "csv") {
      fileContent = convertToCSV(documents)
      fileName = `document-tracker-${currentDate}.csv`
      contentType = "text/csv"
    } else if (format === "excel") {
      fileContent = convertToExcel(documents)
      fileName = `document-tracker-${currentDate}.xls`
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
      message: "Failed to export documents",
    }
  }
}
