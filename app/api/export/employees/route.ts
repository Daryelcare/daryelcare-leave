import { NextResponse } from "next/server"
import { allowedBranches, canAccessBranch, requirePermission } from "@/lib/server-auth"
import { exportEmployees } from "@/app/actions/export-actions"

export async function POST(request: Request) {
  try {
    const auth = await requirePermission(request, "export")
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
