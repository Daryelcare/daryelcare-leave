import { NextResponse } from "next/server"
import { supabase } from "@/lib/supabase"
import { matchesDocumentStatus, withLiveDaysLeft } from "@/lib/document-status"
import { EXPIRY_FIELDS, expiryColumns, safeSearch, toEmployeeDocument } from "@/lib/document-api"
import { allowedBranches, canAccessBranch, requireUser } from "@/lib/server-auth"
import type { DocumentRow } from "@/lib/database.types"

// GET: documents records, limited to the branches the user may see
export async function GET(request: Request) {
  try {
    const auth = await requireUser(request)
    if (auth.response) return auth.response

    const { searchParams } = new URL(request.url)
    const branch = searchParams.get("branch")
    const search = safeSearch(searchParams.get("search")?.toLowerCase() || "")
    const employeeId = searchParams.get("employeeId")
    const status = searchParams.get("status")
    const sponsoredOnly = searchParams.get("sponsoredOnly") === "true"
    const sortColumn = searchParams.get("sortColumn")
    const sortDirection = searchParams.get("sortDirection")

    const allowed = allowedBranches(auth.user)
    if (branch && branch !== "all" && !canAccessBranch(auth.user, branch)) return NextResponse.json([])

    let query = supabase.from("documents").select("*")
    if (branch && branch !== "all") query = query.eq("branch", branch)
    else if (allowed) query = query.in("branch", allowed.length ? allowed : ["\u0000"])
    if (search) query = query.or(`employee_name.ilike.%${search}%,country.ilike.%${search}%`)
    if (employeeId) query = query.eq("employee_id", employeeId)
    if (sponsoredOnly) query = query.eq("is_sponsored", true)

    if (sortColumn && sortDirection) {
      const dbColumn = sortColumn.includes("_") ? sortColumn : sortColumn.replace(/([A-Z])/g, "_$1").toLowerCase()
      query = query.order(dbColumn, { ascending: sortDirection === "asc" })
    } else {
      query = query.order("employee_name", { ascending: true })
    }

    const { data, error } = await query
    if (error) throw error

    // Days left come from the expiry dates (the stored values go stale), and the
    // status filter is applied on the fresh numbers
    const documents = ((data || []) as DocumentRow[])
      .filter((doc) => !status || status === "all" || matchesDocumentStatus(withLiveDaysLeft(doc), status))
      .map(toEmployeeDocument)

    return NextResponse.json(documents)
  } catch (error) {
    console.error("Error fetching documents:", error)
    return NextResponse.json({ error: "Couldn't load the documents. Please try again." }, { status: 500 })
  }
}

// POST: add or update an employee's documents record. Only the dates sent are
// changed; the employee's name and branch come from their employee record.
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
      .select("*")
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
    }
    for (const key of Object.keys(EXPIRY_FIELDS) as (keyof typeof EXPIRY_FIELDS)[]) {
      if (!data[key]) continue
      const result = expiryColumns(key, data[key])
      if ("error" in result) return NextResponse.json({ error: result.error }, { status: 400 })
      Object.assign(documentData, result.columns)
    }
    if (data.otherDocumentExpiry) documentData.other_document_type = data.otherDocumentType || "Other Document"

    const { data: saved, error } = existingDoc
      ? await supabase.from("documents").update(documentData).eq("id", existingDoc.id).select().single()
      : await supabase.from("documents").insert(documentData).select().single()
    if (error) throw error

    return NextResponse.json(toEmployeeDocument(saved as DocumentRow), { status: existingDoc ? 200 : 201 })
  } catch (error) {
    console.error("Error creating/updating document:", error)
    return NextResponse.json({ error: "Couldn't save the documents. Please try again." }, { status: 500 })
  }
}
