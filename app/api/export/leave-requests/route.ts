import { NextResponse } from "next/server"
import { allowedBranches, canAccessBranch, requireUser } from "@/lib/server-auth"
import { exportLeaveRequests } from "@/app/actions/export-actions"

export async function POST(request: Request) {
  try {
    const auth = await requireUser(request)
    if (auth.response) return auth.response
    const formData = await request.formData()
    // Only the branches this user may see; never trust a limit sent by the browser
    formData.delete("allowedBranches")
    const allowed = allowedBranches(auth.user)
    const requested = formData.get("branch")
    if (typeof requested === "string" && requested !== "all" && requested && !canAccessBranch(auth.user, requested)) {
      return NextResponse.json({ error: "You can only export your own branches" }, { status: 403 })
    }
    if (allowed) formData.set("allowedBranches", JSON.stringify(allowed))

    // Add date range filtering if provided
    const startDate = formData.get("startDate") as string
    const endDate = formData.get("endDate") as string
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
        "Content-Type": result.contentType || "application/octet-stream",
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
