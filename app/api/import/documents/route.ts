import { NextResponse } from "next/server"
import { requirePermission } from "@/lib/server-auth"
import { applyImport, planImport, readSheet } from "@/lib/document-import"

const MAX_BYTES = 5 * 1024 * 1024

// POST /api/import/documents (form data: file, skipInvalid): imports the file.
// The same rules as the preview (lib/document-import.ts). Rows with problems
// are left out when skipInvalid is "true"; otherwise nothing is imported
// while any row has a problem.
export async function POST(request: Request) {
  try {
    // Admins, and branch managers allowed to import (only people in their branches)
    const auth = await requirePermission(request, "documents_import")
    if (auth.response) return auth.response
    const form = await request.formData()
    const file = form.get("file")
    const skipInvalid = form.get("skipInvalid") === "true"
    if (!(file instanceof File)) return NextResponse.json({ error: "Choose a file to import" }, { status: 400 })
    if (file.size > MAX_BYTES) return NextResponse.json({ error: "The file is over 5MB" }, { status: 400 })
    const sheet = readSheet(await file.arrayBuffer(), file.name)
    if (sheet.rows.length === 0) return NextResponse.json({ error: "The file has no rows to import" }, { status: 400 })

    const plan = await planImport(sheet, auth.user)
    const problems = plan.rows.filter((r) => r.action === "error")
    if (problems.length && !skipInvalid) {
      return NextResponse.json(
        {
          error: `${problems.length} row${problems.length === 1 ? " has" : "s have"} a problem. Fix ${problems.length === 1 ? "it" : "them"}, or choose to skip ${problems.length === 1 ? "it" : "them"}.`,
          errors: problems.map((p) => ({ row: p.row, message: p.problems.join("; ") })),
        },
        { status: 400 },
      )
    }
    const result = await applyImport(plan)
    console.log(
      `${auth.user.email} imported documents: ${result.updated} updated, ${result.created} created, ${result.cleared} cleared, ${result.failed} failed, ${result.invalid} skipped with problems`,
    )
    return NextResponse.json({
      success: true,
      ...result,
      errors: problems.length ? problems.map((p) => ({ row: p.row, message: p.problems.join("; ") })) : undefined,
    })
  } catch (error) {
    console.error("Document import failed:", error)
    return NextResponse.json(
      { error: "Couldn't import that file. Nothing was changed. Please try again." },
      { status: 500 },
    )
  }
}
