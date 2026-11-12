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
        "Employee Name": "Sample Employee One",
        "Employee Code": "EMP001",
        Branch: "Unassigned",
        Status: "NON-EU",
        Country: "Example Country",
        "Passport Expiry": "31/01/2031",
        "BRP Expiry": "01/02/2031",
        "Right to Work Expiry": "20/04/2030",
        "Other Document Type": "",
        "Other Document Expiry": "N/A",
        Notes: "",
        is_sponsored: "no",
        is_20_hrs: "no",
      },
      {
        "Employee Name": "Sample Employee Two",
        "Employee Code": "EMP002",
        Branch: "Example Branch",
        Status: "NON-EU",
        Country: "Example Country",
        "Passport Expiry": "05/09/2032",
        "BRP Expiry": "N/A",
        "Right to Work Expiry": "02/07/2029",
        "Other Document Type": "",
        "Other Document Expiry": "N/A",
        Notes: "",
        is_sponsored: "yes",
        is_20_hrs: "no",
      },
      {
        "Employee Name": "Sample Employee Three",
        "Employee Code": "EMP003",
        Branch: "Example Branch",
        Status: "NON-EU",
        Country: "Example Country",
        "Passport Expiry": "06/09/2032",
        "BRP Expiry": "N/A",
        "Right to Work Expiry": "03/07/2029",
        "Other Document Type": "",
        "Other Document Expiry": "N/A",
        Notes: "",
        is_sponsored: "yes",
        is_20_hrs: "yes",
      },
      {
        "Employee Name": "Sample Employee Four",
        "Employee Code": "EMP004",
        Branch: "Example Branch",
        Status: "NON-EU",
        Country: "Example Country",
        "Passport Expiry": "07/09/2032",
        "BRP Expiry": "N/A",
        "Right to Work Expiry": "04/07/2029",
        "Other Document Type": "",
        "Other Document Expiry": "N/A",
        Notes: "",
        is_sponsored: "no",
        is_20_hrs: "yes",
      },
    ]

    // Create workbook and worksheet
    const workbook = XLSX.utils.book_new()
    const worksheet = XLSX.utils.json_to_sheet(templateData)

    // Add worksheet to workbook
    XLSX.utils.book_append_sheet(workbook, worksheet, "Documents")

    // Generate file content
    let fileContent: Buffer
    let contentType: string
    let fileName: string

    if (format === "csv") {
      // Generate CSV
      const csvContent = XLSX.utils.sheet_to_csv(worksheet)
      fileContent = Buffer.from(csvContent)
      contentType = "text/csv"
      fileName = "document-import-template.csv"
    } else {
      // Generate Excel
      fileContent = Buffer.from(XLSX.write(workbook, { type: "buffer", bookType: "xlsx" }))
      contentType = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
      fileName = "document-import-template.xlsx"
    }

    // Return file
    return new NextResponse(new Uint8Array(fileContent), {
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
