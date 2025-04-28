import { NextResponse } from "next/server"
import * as XLSX from "xlsx"
import { supabase } from "@/lib/supabase"

export async function POST(request: Request) {
  try {
    // Get form data with file
    const formData = await request.formData()
    const file = formData.get("file") as File

    if (!file) {
      return NextResponse.json({ error: "No file provided" }, { status: 400 })
    }

    // Read file content
    const fileBuffer = await file.arrayBuffer()

    // Parse file based on extension
    const fileExtension = file.name.split(".").pop()?.toLowerCase()
    let rows: any[] = []

    if (fileExtension === "csv") {
      // Parse CSV
      const fileContent = new TextDecoder().decode(fileBuffer)
      const workbook = XLSX.read(fileContent, { type: "string" })
      const worksheet = workbook.Sheets[workbook.SheetNames[0]]
      rows = XLSX.utils.sheet_to_json(worksheet, { defval: "" })
    } else {
      // Parse Excel - with date formatting
      const workbook = XLSX.read(fileBuffer, { type: "array", cellDates: true })
      const worksheet = workbook.Sheets[workbook.SheetNames[0]]
      rows = XLSX.utils.sheet_to_json(worksheet, { defval: "", raw: false })
    }

    // Get all employees for matching
    const { data: employees, error: employeesError } = await supabase
      .from("employees")
      .select("id, name, employee_code, branch")

    if (employeesError) {
      throw new Error(`Error fetching employees: ${employeesError.message}`)
    }

    // Process rows for preview (limit to first 100 rows for performance)
    const previewRows = rows.slice(0, 100).map((row) => {
      // Find matching employee
      const matchingEmployee = employees?.find(
        (emp) =>
          emp.employee_code === row["Employee Code"] ||
          (emp.name === row["Employee Name"] && emp.branch === row["Branch"]),
      )

      // Format date values if they're not already formatted
      const passportExpiry = formatDateValue(row["Passport Expiry"])
      const brpExpiry = formatDateValue(row["BRP Expiry"])
      const rightToWorkExpiry = formatDateValue(row["Right to Work Expiry"])
      const otherDocumentExpiry = formatDateValue(row["Other Document Expiry"])

      // Calculate days left for each document type
      const passportDaysLeft = calculateDaysLeft(passportExpiry)
      const brpDaysLeft = calculateDaysLeft(brpExpiry)
      const rightToWorkDaysLeft = calculateDaysLeft(rightToWorkExpiry)
      const otherDocumentDaysLeft = calculateDaysLeft(otherDocumentExpiry)

      // Convert yes/no to boolean
      const isSponsored = typeof row["is_sponsored"] === "string" && row["is_sponsored"].toLowerCase() === "yes"
      const is20Hrs = typeof row["is_20_hrs"] === "string" && row["is_20_hrs"].toLowerCase() === "yes"

      return {
        employeeId: matchingEmployee?.id || null,
        employeeName: row["Employee Name"] || "",
        employeeCode: row["Employee Code"] || "",
        branch: row["Branch"] || "",
        status: row["Status"] || "",
        country: row["Country"] || "",
        passportExpiry: passportExpiry,
        passportDaysLeft: passportDaysLeft,
        brpExpiry: brpExpiry,
        brpDaysLeft: brpDaysLeft,
        rightToWorkExpiry: rightToWorkExpiry,
        rightToWorkDaysLeft: rightToWorkDaysLeft,
        otherDocumentType: row["Other Document Type"] || null,
        otherDocumentExpiry: otherDocumentExpiry,
        otherDocumentDaysLeft: otherDocumentDaysLeft,
        notes: row["Notes"] || "",
        isSponsored: isSponsored,
        is20Hrs: is20Hrs,
        isValid: !!matchingEmployee,
        validationMessage: matchingEmployee ? null : "No matching employee found",
      }
    })

    return NextResponse.json({
      data: previewRows,
      total: rows.length,
    })
  } catch (error) {
    console.error("Preview error:", error)
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "An unexpected error occurred",
      },
      { status: 500 },
    )
  }
}

// Helper function to format date values
function formatDateValue(value: any): string | null {
  if (!value) return null
  if (value === "N/A") return null

  // If it's already a string in the format DD/MM/YYYY, return it
  if (typeof value === "string" && /^\d{2}\/\d{2}\/\d{4}$/.test(value)) {
    return value
  }

  // If it's a Date object (from Excel with cellDates:true)
  if (value instanceof Date) {
    return formatDate(value)
  }

  // If it's a number (Excel date serial number)
  if (typeof value === "number" && !isNaN(value)) {
    // Convert Excel serial date to JS Date
    // Excel dates start from January 1, 1900
    const date = new Date(Math.round((value - 25569) * 86400 * 1000))
    return formatDate(date)
  }

  // Try to parse as date if it's a string but not in DD/MM/YYYY format
  if (typeof value === "string") {
    try {
      const date = new Date(value)
      if (!isNaN(date.getTime())) {
        return formatDate(date)
      }
    } catch (e) {
      // Not a valid date string
    }
  }

  return String(value)
}

// Format a Date object to DD/MM/YYYY
function formatDate(date: Date): string {
  const day = date.getDate().toString().padStart(2, "0")
  const month = (date.getMonth() + 1).toString().padStart(2, "0")
  const year = date.getFullYear()
  return `${day}/${month}/${year}`
}

// Helper function to calculate days left
function calculateDaysLeft(dateString: any): number | null {
  // Check if dateString is a valid string
  if (!dateString || typeof dateString !== "string" || dateString === "N/A") {
    return null
  }

  try {
    // Parse date in format DD/MM/YYYY
    const parts = dateString.split("/")
    if (parts.length !== 3) return null

    const day = Number.parseInt(parts[0], 10)
    const month = Number.parseInt(parts[1], 10) - 1 // Month is 0-indexed in JavaScript
    const year = Number.parseInt(parts[2], 10)

    // Check if the date parts are valid numbers
    if (isNaN(day) || isNaN(month) || isNaN(year)) {
      return null
    }

    const expiryDate = new Date(year, month, day)

    // Check if the date is valid
    if (isNaN(expiryDate.getTime())) {
      return null
    }

    const today = new Date()
    today.setHours(0, 0, 0, 0)

    const diffTime = expiryDate.getTime() - today.getTime()
    return Math.ceil(diffTime / (1000 * 60 * 60 * 24))
  } catch (error) {
    console.error("Error calculating days left:", error)
    return null
  }
}
