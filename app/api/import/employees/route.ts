import { NextResponse } from "next/server"
import { requirePermission } from "@/lib/server-auth"
import { importBranch } from "@/lib/import-scope"
import { inBatches } from "@/lib/fetch-all"
import { supabase } from "@/lib/db"
import * as XLSX from "xlsx"
import { v4 as uuidv4 } from "uuid"

// Define the expected columns
const REQUIRED_COLUMNS = ["Full Name"] // Only name is required now
const OPTIONAL_COLUMNS = ["Employee Code", "Job Title", "Branch", "Days Taken", "Days Remaining", "Hours"]
const ALL_COLUMNS = [...REQUIRED_COLUMNS, ...OPTIONAL_COLUMNS]

export async function POST(request: Request) {
  try {
    // Admins and branch managers; managers only into their own branches
    const auth = await requirePermission(request, "employees_import")
    if (auth.response) return auth.response
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

      // Validate branch if provided, and that this person may import into it
      const scoped = importBranch(auth.user, row["Branch"])
      if ("error" in scoped) {
        errors.push({ row: rowNumber, message: scoped.error })
        return
      }
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
        branch: scoped.branch,
        _row: rowNumber,
        days_taken: row["Days Taken"] !== "" ? Number(row["Days Taken"]) : 0,
        days_remaining: row["Days Remaining"] !== "" ? Number(row["Days Remaining"]) : 28,
        hours: row["Hours"] !== "" ? Number(row["Hours"]) : null, // Add hours field
        status: "active",
      })
    })

    // A manager can't change someone in another branch by reusing their
    // employee code (the import updates rows with a matching code)
    if (auth.user.role !== "admin" && validRows.length > 0) {
      const codes = validRows.map((r) => r.employee_code as string)
      const elsewhere = new Map<string, string>()
      await inBatches(codes, async (batch) => {
        const { data, error } = await supabase.from("employees").select("employee_code, branch").in("employee_code", batch)
        if (error) throw error
        for (const e of data ?? []) {
          if (!(auth.user.branches || []).includes(e.branch)) elsewhere.set(e.employee_code, e.branch)
        }
      })
      for (let i = validRows.length - 1; i >= 0; i--) {
        const r = validRows[i]
        if (elsewhere.has(r.employee_code)) {
          errors.push({ row: r._row, message: `Employee code ${r.employee_code} belongs to someone in another branch` })
          validRows.splice(i, 1)
        }
      }
    }
    for (const r of validRows) delete r._row

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
      const { error } = await supabase.from("employees").upsert(batch, {
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
