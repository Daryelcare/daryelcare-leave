import { NextResponse } from "next/server"
import { exportEmployees } from "@/app/actions/export-actions"

export async function POST(request: Request) {
  try {
    const formData = await request.formData()
    const format = formData.get("format") as string
    const branch = formData.get("branch") as string
    const search = formData.get("search") as string
    const exportAll = formData.get("exportAll") === "true"

    // Pass all parameters to the export function
    if (branch) {
      formData.set("branch", branch)
    }

    if (search) {
      formData.set("search", search)
    }

    if (exportAll) {
      formData.set("exportAll", "true")
    }

    const result = await exportEmployees(formData)

    if (!result.success) {
      return NextResponse.json({ error: result.message }, { status: 500 })
    }

    // Return the file content with appropriate headers
    const response = new NextResponse(result.fileContent, {
      status: 200,
      headers: {
        "Content-Type": result.contentType,
        "Content-Disposition": `attachment; filename="${result.fileName}"`,
        // Add cache control headers to prevent caching
        "Cache-Control": "no-cache, no-store, must-revalidate",
        Pragma: "no-cache",
        Expires: "0",
      },
    })

    return response
  } catch (error) {
    console.error("Error in export route:", error)
    return NextResponse.json({ error: "Failed to export data" }, { status: 500 })
  }
}
