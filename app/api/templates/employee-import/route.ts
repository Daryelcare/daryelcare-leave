import { NextResponse } from "next/server"
import * as XLSX from "xlsx"

export async function GET(request: Request) {
  try {
    // Get query parameters
    const { searchParams } = new URL(request.url)
    const format = searchParams.get("format") || "csv"

    // Create template data
    const templateData = [
      {
        "Full Name": "John Doe",
        "Employee Code": "EMP001", // Optional
        "Job Title": "Software Engineer", // Optional
        Branch: "London", // Optional
        "Days Taken": 0, // Optional
        "Days Remaining": 28, // Optional
        Hours: 40, // Optional - Added hours field
      },
      {
        "Full Name": "Jane Smith",
        "Employee Code": "", // Will be auto-generated
        "Job Title": "", // Will default to "Unspecified"
        Branch: "", // Will default to "Unassigned"
        "Days Taken": 5,
        "Days Remaining": 23,
        Hours: 35, // Optional - Added hours field
      },
    ]

    // Create workbook and worksheet
    const workbook = XLSX.utils.book_new()
    const worksheet = XLSX.utils.json_to_sheet(templateData)

    // Add worksheet to workbook
    XLSX.utils.book_append_sheet(workbook, worksheet, "Employees")

    // Generate file content
    let fileContent: Buffer
    let contentType: string
    let fileName: string

    if (format === "csv") {
      // Generate CSV
      const csvContent = XLSX.utils.sheet_to_csv(worksheet)
      fileContent = Buffer.from(csvContent)
      contentType = "text/csv"
      fileName = "employee-import-template.csv"
    } else {
      // Generate Excel
      fileContent = Buffer.from(XLSX.write(workbook, { type: "buffer", bookType: "xlsx" }))
      contentType = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
      fileName = "employee-import-template.xlsx"
    }

    // Return file
    return new NextResponse(fileContent, {
      headers: {
        "Content-Type": contentType,
        "Content-Disposition": `attachment; filename="${fileName}"`,
        "Content-Length": fileContent.length.toString(),
      },
    })
  } catch (error) {
    console.error("Template generation error:", error)
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "An unexpected error occurred",
      },
      { status: 500 },
    )
  }
}
