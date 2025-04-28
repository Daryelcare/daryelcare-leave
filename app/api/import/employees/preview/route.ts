import { NextResponse } from "next/server"
import * as XLSX from "xlsx"
import { v4 as uuidv4 } from "uuid"

// Define the expected columns
const REQUIRED_COLUMNS = ["Full Name"] // Only name is required now
const OPTIONAL_COLUMNS = ["Employee Code", "Job Title", "Branch", "Days Taken", "Days Remaining", "Hours"]
const ALL_COLUMNS = [...REQUIRED_COLUMNS, ...OPTIONAL_COLUMNS]

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
      rows = XLSX.utils.sheet_to_json(worksheet, { header: ALL_COLUMNS, defval: "" })

      // Remove header row if it matches our expected headers
      if (rows.length > 0 && rows[0]["Full Name"] === "Full Name") {
        rows.shift()
      }
    } else {
      // Parse Excel
      const workbook = XLSX.read(fileBuffer, { type: "array" })
      const worksheet = workbook.Sheets[workbook.SheetNames[0]]
      rows = XLSX.utils.sheet_to_json(worksheet, { defval: "" })
    }

    // Process rows for preview (limit to first 100 rows for performance)
    const previewRows = rows
      .slice(0, 100)
      .map((row) => {
        // Check if row has the required field (Full Name)
        if (!row["Full Name"] && row["Full Name"] !== 0) {
          return null // Skip invalid rows
        }

        // Generate employee code if not provided - Changed prefix from EMP to DCYA
        const employeeCode = row["Employee Code"] || `DCYA-${uuidv4().substring(0, 8).toUpperCase()}`

        return {
          name: row["Full Name"],
          employeeCode: employeeCode,
          jobTitle: row["Job Title"] || "Unspecified", // Default job title
          branch: row["Branch"] || "Unassigned", // Default branch
          daysTaken: row["Days Taken"] !== "" ? Number(row["Days Taken"]) : 0,
          daysRemaining: row["Days Remaining"] !== "" ? Number(row["Days Remaining"]) : 28,
          hours: row["Hours"] !== "" ? Number(row["Hours"]) : undefined, // Add hours field
        }
      })
      .filter(Boolean) // Remove null entries

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
