import type { LeaveRequest, Employee, EmployeeDocument } from "@/lib/types"

/**
 * Convert an array of objects to CSV format
 * @param data Array of objects to convert
 * @returns CSV string
 */
export function convertToCSV(data: any[]): string {
  if (data.length === 0) return ""

  // Get headers from the first object
  const headers = Object.keys(data[0])

  // Create CSV header row
  let csv = headers.join(",") + "\n"

  // Add data rows
  data.forEach((item) => {
    const row = headers.map((header) => {
      // Handle undefined, null, or empty values
      const value = item[header] === undefined || item[header] === null ? "" : item[header]

      // Escape commas and quotes in values
      const escaped = String(value).replace(/"/g, '""')

      // Wrap in quotes if the value contains commas, quotes, or newlines
      return /[",\n\r]/.test(escaped) ? `"${escaped}"` : escaped
    })

    csv += row.join(",") + "\n"
  })

  return csv
}

/**
 * Convert an array of objects to Excel XML format
 * @param data Array of objects to convert
 * @returns Excel XML string
 */
export function convertToExcel(data: any[]): string {
  if (data.length === 0) return ""

  // Create a simple XML spreadsheet format
  let xml = '<?xml version="1.0"?><?mso-application progid="Excel.Sheet"?>'
  xml +=
    '<Workbook xmlns="urn:schemas-microsoft-com:office:spreadsheet" xmlns:ss="urn:schemas-microsoft-com:office:spreadsheet">'
  xml += '<Worksheet ss:Name="Sheet1"><Table>'

  // Get headers from the first object
  const headers = Object.keys(data[0])

  // Add header row
  xml += "<Row>"
  headers.forEach((header) => {
    xml += `<Cell><Data ss:Type="String">${escapeXml(formatHeader(header))}</Data></Cell>`
  })
  xml += "</Row>"

  // Add data rows
  data.forEach((item) => {
    xml += "<Row>"
    headers.forEach((header) => {
      const value = item[header]

      if (value === undefined || value === null) {
        xml += `<Cell><Data ss:Type="String"></Data></Cell>`
      } else if (typeof value === "number") {
        xml += `<Cell><Data ss:Type="Number">${value}</Data></Cell>`
      } else if (typeof value === "boolean") {
        xml += `<Cell><Data ss:Type="Boolean">${value ? 1 : 0}</Data></Cell>`
      } else {
        xml += `<Cell><Data ss:Type="String">${escapeXml(String(value))}</Data></Cell>`
      }
    })
    xml += "</Row>"
  })

  xml += "</Table></Worksheet></Workbook>"
  return xml
}

// Helper function to escape XML special characters
function escapeXml(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;")
}

// Helper function to format header names
function formatHeader(header: string): string {
  // Convert camelCase to Title Case with Spaces
  return header
    .replace(/([A-Z])/g, " $1") // Add space before capital letters
    .replace(/^./, (str) => str.toUpperCase()) // Capitalize first letter
    .trim() // Remove any leading/trailing spaces
}

/**
 * Format employee data for export
 * @param employees Array of employees to format
 * @returns Formatted array for export
 */
export function formatEmployeesForExport(employees: Employee[]): any[] {
  return employees.map((emp) => ({
    Name: emp.name,
    "Employee Code": emp.employeeCode,
    "Job Title": emp.jobTitle,
    Branch: emp.branch,
    "Days Taken": emp.daysTaken,
    "Days Remaining": emp.daysRemaining,
    Hours: emp.hours || "",
    Email: emp.email || "",
    Phone: emp.phone || "",
    Status: emp.status,
  }))
}

/**
 * Format leave requests for export
 * @param leaveRequests Array of leave requests to format
 * @returns Formatted array for export
 */
export function formatLeaveRequestsForExport(leaveRequests: LeaveRequest[]): any[] {
  return leaveRequests.map((req) => ({
    Employee: req.employee,
    "Employee Code": req.employeeCode,
    Branch: req.branch,
    Type: req.type,
    "Start Date": req.startDate,
    "End Date": req.endDate,
    Duration: req.duration,
    "Days Remaining": req.remaining,
    Status: req.status,
    Reason: req.reason || "",
    "Submitted Date": req.submittedDate,
    "Added By": req.addedBy || "",
  }))
}

/**
 * Format documents for export
 * @param documents Array of documents to format
 * @returns Formatted array for export
 */
export function formatDocumentsForExport(documents: EmployeeDocument[]): any[] {
  return documents.map((doc) => ({
    Employee: doc.employeeName,
    Branch: doc.branch,
    Status: doc.status,
    Country: doc.country,
    "Passport Expiry": doc.passportExpiry || "",
    "Passport Days Left": doc.passportDaysLeft || "",
    "Right to Work Expiry": doc.rightToWorkExpiry || "",
    "Right to Work Days Left": doc.rightToWorkDaysLeft || "",
    "BRP Expiry": doc.brpExpiry || "",
    "BRP Days Left": doc.brpDaysLeft || "",
    "Other Document Type": doc.otherDocumentType || "",
    "Other Document Expiry": doc.otherDocumentExpiry || "",
    "Other Document Days Left": doc.otherDocumentDaysLeft || "",
    Sponsored: doc.isSponsored ? "Yes" : "No",
    "20 Hours Restriction": doc.is20Hours ? "Yes" : "No",
  }))
}
