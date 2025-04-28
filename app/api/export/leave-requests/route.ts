import { NextResponse } from "next/server"
import { exportLeaveRequests } from "@/app/actions/export-actions"

export async function POST(request: Request) {
  try {
    const formData = await request.formData()

    // Add date range filtering if provided
    const startDate = formData.get("startDate") as string
    const endDate = formData.get("endDate") as string
    const dateFilterMode = (formData.get("dateFilterMode") as string) || "overlap"
    const exportAll = formData.get("exportAll") === "true"

    if (startDate && endDate) {
      // Convert to DD/MM/YYYY format for filtering
      const formatDate = (dateStr: string) => {
        const date = new Date(dateStr)
        return `${date.getDate().toString().padStart(2, "0")}/${(date.getMonth() + 1).toString().padStart(2, "0")}/${date.getFullYear()}`
      }

      formData.set("startDate", formatDate(startDate))
      formData.set("endDate", formatDate(endDate))
    }

    // Make sure the date filter mode is passed to the export function
    if (!formData.has("dateFilterMode")) {
      formData.set("dateFilterMode", "overlap") // Default to overlap if not specified
    }

    // Pass the exportAll flag
    if (exportAll) {
      formData.set("exportAll", "true")
    }

    const result = await exportLeaveRequests(formData)

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
