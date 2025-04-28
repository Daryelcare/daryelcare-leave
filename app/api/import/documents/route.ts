import { NextResponse } from "next/server"
import * as XLSX from "xlsx"
import { supabase } from "@/lib/supabase"

export async function POST(request: Request) {
  try {
    // Get form data with file
    const formData = await request.formData()
    const file = formData.get("file") as File
    const skipInvalid = formData.get("skipInvalid") === "true"

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

    // Process rows and prepare for import
    const validRows: any[] = []
    const invalidRows: any[] = []
    const errors: { row: number; message: string }[] = []

    rows.forEach((row, index) => {
      // Find matching employee
      const matchingEmployee = employees?.find(
        (emp) =>
          emp.employee_code === row["Employee Code"] ||
          (emp.name === row["Employee Name"] && emp.branch === row["Branch"]),
      )

      if (!matchingEmployee) {
        invalidRows.push(row)
        errors.push({
          row: index + 2, // +2 for header row and 0-indexing
          message: `No matching employee found for ${row["Employee Name"]} (${row["Employee Code"]})`,
        })
        return
      }

      // Validate required fields
      if (!row["Status"] || !row["Country"]) {
        invalidRows.push(row)
        errors.push({
          row: index + 2,
          message: `Missing required fields (Status or Country) for ${row["Employee Name"]}`,
        })
        return
      }

      // Format date values
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

      // Prepare document data for database
      validRows.push({
        employee_id: matchingEmployee.id,
        employee_name: row["Employee Name"],
        branch: row["Branch"],
        status: row["Status"],
        country: row["Country"],
        passport_expiry: passportExpiry,
        passport_days_left: passportDaysLeft,
        brp_expiry: brpExpiry,
        brp_days_left: brpDaysLeft,
        right_to_work_expiry: rightToWorkExpiry,
        right_to_work_days_left: rightToWorkDaysLeft,
        other_document_type: row["Other Document Type"] || null,
        other_document_expiry: otherDocumentExpiry,
        other_document_days_left: otherDocumentDaysLeft,
        is_sponsored: isSponsored,
        is_20_hours: is20Hrs,
      })
    })

    // If no valid rows and not skipping invalid, return error
    if (validRows.length === 0 && !skipInvalid) {
      return NextResponse.json(
        {
          error: "No valid rows found in the file",
          errors,
        },
        { status: 400 },
      )
    }

    // Import valid rows
    let successCount = 0
    let updateCount = 0
    let errorCount = 0

    // Process in batches for better performance
    const BATCH_SIZE = 50
    for (let i = 0; i < validRows.length; i += BATCH_SIZE) {
      const batch = validRows.slice(i, i + BATCH_SIZE)

      // For each document in the batch, check if it already exists and update or insert accordingly
      for (const doc of batch) {
        try {
          // Check if document already exists for this employee
          const { data: existingDoc, error: checkError } = await supabase
            .from("documents")
            .select("id")
            .eq("employee_id", doc.employee_id)
            .maybeSingle()

          if (checkError) {
            console.error("Error checking for existing document:", checkError)
            errorCount++
            continue
          }

          if (existingDoc) {
            // Update existing document
            const { error: updateError } = await supabase.from("documents").update(doc).eq("id", existingDoc.id)

            if (updateError) {
              console.error("Error updating document:", updateError)
              errorCount++
            } else {
              updateCount++
              successCount++
            }
          } else {
            // Insert new document
            const { error: insertError } = await supabase.from("documents").insert(doc)

            if (insertError) {
              console.error("Error inserting document:", insertError)
              errorCount++
            } else {
              successCount++
            }
          }
        } catch (error) {
          console.error("Error processing document:", error)
          errorCount++
        }
      }
    }

    return NextResponse.json({
      success: true,
      imported: successCount,
      updated: updateCount,
      failed: errorCount,
      skipped: invalidRows.length,
      errors: errors.length > 0 ? errors : undefined,
    })
  } catch (error) {
    console.error("Import error:", error)
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
