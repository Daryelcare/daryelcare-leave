import { NextResponse } from "next/server"
import { supabase } from "@/lib/db"
import { EXPIRY_FIELDS, RTW_SETUP_MESSAGE, expiryColumns, rtwColumns, rtwColumnsExist, toEmployeeDocument } from "@/lib/document-api"
import { canAccessBranch, requireAdmin, requireUser, type RequestUser } from "@/lib/server-auth"
import type { DocumentRow } from "@/lib/database.types"

/** The record, or a response to send instead (missing, or another branch's) */
async function loadRecord(id: string, user: RequestUser) {
  const { data, error } = await supabase.from("documents").select("*").eq("id", id).maybeSingle()
  if (error) throw error
  if (!data) return { response: NextResponse.json({ error: "Document record not found" }, { status: 404 }) }
  if (!canAccessBranch(user, data.branch)) {
    return {
      response: NextResponse.json({ error: "You can only manage documents for your own branches" }, { status: 403 }),
    }
  }
  return { record: data as DocumentRow }
}

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const auth = await requireUser(request)
    if (auth.response) return auth.response
    const { id } = await params
    const found = await loadRecord(id, auth.user)
    if (found.response) return found.response
    return NextResponse.json(toEmployeeDocument(found.record))
  } catch (error) {
    console.error("Error fetching document:", error)
    return NextResponse.json({ error: "Couldn't load the document record. Please try again." }, { status: 500 })
  }
}

// PUT: change part of a record. Only the fields sent change; an expiry date
// sent as null or "" is cleared ("no expiry").
export async function PUT(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const auth = await requireUser(request)
    if (auth.response) return auth.response
    const { id } = await params
    const data = await request.json()

    const found = await loadRecord(id, auth.user)
    if (found.response) return found.response
    const existing = found.record

    const status = typeof data.status === "string" && data.status.trim() ? data.status.trim() : existing.status

    const updateData: Record<string, unknown> = {
      status,
      country: data.country !== undefined ? data.country : existing.country,
      is_sponsored: data.isSponsored !== undefined ? !!data.isSponsored : existing.is_sponsored,
      is_20_hours: data.is20Hours !== undefined ? !!data.is20Hours : existing.is_20_hours,
    }
    for (const key of Object.keys(EXPIRY_FIELDS) as (keyof typeof EXPIRY_FIELDS)[]) {
      if (data[key] === undefined) continue
      const result = expiryColumns(key, data[key])
      if ("error" in result) return NextResponse.json({ error: result.error }, { status: 400 })
      Object.assign(updateData, result.columns)
    }
    if (data.otherDocumentExpiry !== undefined || data.otherDocumentType !== undefined) {
      updateData.other_document_type =
        (typeof data.otherDocumentType === "string" && data.otherDocumentType.trim()) ||
        existing.other_document_type ||
        (data.otherDocumentExpiry ? "Other Document" : null)
    }

    // How right to work is held: when sent, it decides the right-to-work date
    const rtw = rtwColumns(data)
    if (rtw && "error" in rtw) return NextResponse.json({ error: rtw.error }, { status: 400 })
    if (rtw) {
      if (!(await rtwColumnsExist())) return NextResponse.json({ error: RTW_SETUP_MESSAGE }, { status: 409 })
      Object.assign(updateData, rtw.columns)
    }

    const { data: updated, error } = await supabase.from("documents").update(updateData).eq("id", id).select().single()
    if (error) throw error

    return NextResponse.json(toEmployeeDocument(updated as DocumentRow))
  } catch (error) {
    console.error("Error updating document:", error)
    return NextResponse.json({ error: "Couldn't save the document record. Please try again." }, { status: 500 })
  }
}

// DELETE: admins only, as in CarerHR
export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const auth = await requireAdmin(request)
    if (auth.response) return auth.response
    const { id } = await params
    const found = await loadRecord(id, auth.user)
    if (found.response) return found.response

    const { error } = await supabase.from("documents").delete().eq("id", id)
    if (error) throw error
    console.log(`${auth.user.email} deleted the documents record for ${found.record.employee_name}`)
    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("Error deleting document:", error)
    return NextResponse.json({ error: "Couldn't delete the document record. Please try again." }, { status: 500 })
  }
}
