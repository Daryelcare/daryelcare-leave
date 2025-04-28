import { NextResponse } from "next/server"
import { supabase } from "@/lib/supabase"
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

    // Validate rows
    const errors: { row: number; message: string }[] = []
    const validRows: any[] = []

    // Get existing branches for validation
    const { data: branches, error: branchError } = await supabase.from("branches").select("name")

    if (branchError) {
      throw branchError
    }

    const validBranches = branches.map((b) => b.name)

    // Process each row
    rows.forEach((row, index) => {
      const rowNumber = index + 2 // +2 because of 0-indexing and header row

      // Check for required fields (only Full Name is required now)
      if (!row["Full Name"] && row["Full Name"] !== 0) {
        errors.push({
          row: rowNumber,
          message: `Missing required field: Full Name`,
        })
        return // Skip this row
      }

      // Validate branch if provided
      if (row["Branch"] && !validBranches.includes(row["Branch"])) {
        errors.push({
          row: rowNumber,
          message: `Invalid branch: ${row["Branch"]}. Must be one of: ${validBranches.join(", ")}`,
        })
        return // Skip this row
      }

      // Validate numeric fields
      if (row["Days Taken"] !== "" && isNaN(Number(row["Days Taken"]))) {
        errors.push({
          row: rowNumber,
          message: `Days Taken must be a number`,
        })
        return
      }

      if (row["Days Remaining"] !== "" && isNaN(Number(row["Days Remaining"]))) {
        errors.push({
          row: rowNumber,
          message: `Days Remaining must be a number`,
        })
        return
      }

      if (row["Hours"] !== "" && isNaN(Number(row["Hours"]))) {
        errors.push({
          row: rowNumber,
          message: `Hours must be a number`,
        })
        return
      }

      // Generate employee code if not provided - Changed prefix from EMP to DCYA
      const employeeCode = row["Employee Code"] || `DCYA-${uuidv4().substring(0, 8).toUpperCase()}`

      // Add to valid rows
      validRows.push({
        name: row["Full Name"],
        employee_code: employeeCode,
        job_title: row["Job Title"] || "Unspecified", // Default job title
        branch: row["Branch"] || "Unassigned", // Default branch
        days_taken: row["Days Taken"] !== "" ? Number(row["Days Taken"]) : 0,
        days_remaining: row["Days Remaining"] !== "" ? Number(row["Days Remaining"]) : 28,
        hours: row["Hours"] !== "" ? Number(row["Hours"]) : null, // Add hours field
        status: "active",
      })
    })

    // If no valid rows, return error
    if (validRows.length === 0) {
      return NextResponse.json(
        {
          error: "No valid rows found in the file",
          errors,
        },
        { status: 400 },
      )
    }

    // Insert valid rows in batches for better performance
    const BATCH_SIZE = 100
    let successCount = 0

    for (let i = 0; i < validRows.length; i += BATCH_SIZE) {
      const batch = validRows.slice(i, i + BATCH_SIZE)
      const { data, error } = await supabase.from("employees").upsert(batch, {
        onConflict: "employee_code",
        ignoreDuplicates: false,
      })

      if (error) {
        console.error("Batch insert error:", error)
        // Continue with next batch despite errors
      } else {
        successCount += batch.length
      }
    }

    return NextResponse.json({
      success: successCount,
      errors,
      total: rows.length,
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
