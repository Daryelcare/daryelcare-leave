import { NextResponse } from "next/server"
import { supabase } from "@/lib/db"
import { EXPIRY_FIELDS, RTW_SETUP_MESSAGE, expiryColumns, rtwColumns, rtwColumnsExist, toEmployeeDocument } from "@/lib/document-api"
import { canAccessBranch, requireUser } from "@/lib/server-auth"
import type { DocumentRow } from "@/lib/database.types"

// POST: save an employee's whole documents record (Add document). Dates not
// sent are cleared; the name and branch come from the employee record.
export async function POST(request: Request) {
  try {
    const auth = await requireUser(request)
    if (auth.response) return auth.response

    const data = await request.json()
    if (!data.employeeId || !data.status) {
      return NextResponse.json({ error: "Choose an employee and their status" }, { status: 400 })
    }

    const { data: employee, error: employeeError } = await supabase
      .from("employees")
      .select("id, name, branch")
      .eq("id", data.employeeId)
      .maybeSingle()
    if (employeeError) throw employeeError
    if (!employee) return NextResponse.json({ error: "Employee not found" }, { status: 404 })
    if (!canAccessBranch(auth.user, employee.branch)) {
      return NextResponse.json({ error: "You can only manage documents for your own branches" }, { status: 403 })
    }

    const { data: existingDoc, error: checkError } = await supabase
      .from("documents")
      .select("id")
      .eq("employee_id", data.employeeId)
      .maybeSingle()
    if (checkError) throw checkError

    const documentData: Partial<DocumentRow> &
      Pick<DocumentRow, "employee_id" | "employee_name" | "branch" | "status"> = {
      employee_id: employee.id,
      employee_name: employee.name,
      branch: employee.branch,
      status: data.status,
      country: data.country,
      is_sponsored: data.isSponsored || false,
      is_20_hours: data.is20Hours || false,
      other_document_type: data.otherDocumentType || null,
    }
    for (const key of Object.keys(EXPIRY_FIELDS) as (keyof typeof EXPIRY_FIELDS)[]) {
      const result = expiryColumns(key, data[key] || null)
      if ("error" in result) return NextResponse.json({ error: result.error }, { status: 400 })
      Object.assign(documentData, result.columns)
    }
    const rtw = rtwColumns(data)
    if (rtw && "error" in rtw) return NextResponse.json({ error: rtw.error }, { status: 400 })
    if (rtw) {
      if (!(await rtwColumnsExist())) return NextResponse.json({ error: RTW_SETUP_MESSAGE }, { status: 409 })
      Object.assign(documentData, rtw.columns)
    }

    const { data: saved, error } = existingDoc
      ? await supabase.from("documents").update(documentData).eq("id", existingDoc.id).select().single()
      : await supabase.from("documents").insert(documentData).select().single()
    if (error) throw error

    return NextResponse.json(toEmployeeDocument(saved as DocumentRow), { status: existingDoc ? 200 : 201 })
  } catch (error) {
    console.error("Error saving documents:", error)
    return NextResponse.json({ error: "Couldn't save the documents. Please try again." }, { status: 500 })
  }
}
