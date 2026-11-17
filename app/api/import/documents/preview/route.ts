import { NextResponse } from "next/server"
import { requirePermission } from "@/lib/server-auth"
import { planImport, publicPlan, readSheet } from "@/lib/document-import"

const MAX_BYTES = 5 * 1024 * 1024

// POST /api/import/documents/preview (form data: file): what importing the
// file would do, person by person. Changes nothing.
export async function POST(request: Request) {
  try {
    const auth = await requirePermission(request, "documents_import")
    if (auth.response) return auth.response
    const file = (await request.formData()).get("file")
    if (!(file instanceof File)) return NextResponse.json({ error: "Choose a file to import" }, { status: 400 })
    if (file.size > MAX_BYTES) return NextResponse.json({ error: "The file is over 5MB" }, { status: 400 })
    const sheet = readSheet(await file.arrayBuffer(), file.name)
    if (sheet.rows.length === 0) return NextResponse.json({ error: "The file has no rows to import" }, { status: 400 })
    const plan = await planImport(sheet, auth.user)
    return NextResponse.json(publicPlan(plan))
  } catch (error) {
    console.error("Document import preview failed:", error)
    return NextResponse.json(
      { error: "Couldn't read that file. Check it's the template saved as Excel or CSV." },
      { status: 500 },
    )
  }
}
