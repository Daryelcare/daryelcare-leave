import { NextResponse } from "next/server"
import { supabase } from "@/lib/db"
import { fetchAllRows } from "@/lib/fetch-all"
import { rtwColumnsExist, toEmployeeDocument } from "@/lib/document-api"
import { allowedBranches, canAccessBranch, requirePermission } from "@/lib/server-auth"
import type { DocumentRow, EmployeeRow } from "@/lib/database.types"
import type { TrackerDocument } from "@/lib/types"

type Person = Pick<EmployeeRow, "id" | "name" | "employee_code" | "branch" | "status">

// GET /api/documents/tracker?branch=: one row per current employee (leavers left
// out), with their documents record, or marked as having nothing on file. The
// employee's current name and branch are shown, and decide who may see them.
export async function GET(request: Request) {
  try {
    const auth = await requirePermission(request, "documents_view")
    if (auth.response) return auth.response

    const branch = new URL(request.url).searchParams.get("branch") || "all"
    if (branch !== "all" && !canAccessBranch(auth.user, branch)) return NextResponse.json({ rows: [] })
    const allowed = allowedBranches(auth.user)
    if (allowed && allowed.length === 0) return NextResponse.json({ rows: [] })

    const people = await fetchAllRows<Person>((from, to) => {
      let query = supabase.from("employees").select("id, name, employee_code, branch, status")
      if (branch !== "all") query = query.eq("branch", branch)
      else if (allowed) query = query.in("branch", allowed)
      return query.order("name").order("id").range(from, to)
    })
    const current = people.filter((p) => (p.status || "active").toLowerCase() !== "inactive")

    const records = await fetchAllRows<DocumentRow>((from, to) =>
      supabase.from("documents").select("*").order("id").range(from, to),
    )
    const byEmployee = new Map(records.map((r) => [r.employee_id, r]))

    const rows: TrackerDocument[] = current.map((person) => {
      const record = byEmployee.get(person.id)
      if (record) {
        return {
          ...toEmployeeDocument(record),
          employeeName: person.name,
          branch: person.branch,
          recordId: record.id,
          employeeCode: person.employee_code || null,
          noRecord: false,
        }
      }
      return {
        id: `none:${person.id}`,
        recordId: null,
        noRecord: true,
        employeeId: person.id,
        employeeName: person.name,
        employeeCode: person.employee_code || null,
        branch: person.branch,
        status: "",
        country: null,
        passportExpiry: null,
        passportDaysLeft: null,
        rightToWorkExpiry: null,
        rightToWorkDaysLeft: null,
        brpExpiry: null,
        brpDaysLeft: null,
        otherDocumentType: null,
        otherDocumentExpiry: null,
        otherDocumentDaysLeft: null,
        isSponsored: false,
        is20Hours: false,
        rtwBasis: null,
        rtwCheckedOn: null,
      }
    })

    // Whether "how right to work is held" can be saved yet (database update run)
    return NextResponse.json({ rows, rtwTracking: await rtwColumnsExist() })
  } catch (error) {
    console.error("Error loading the document tracker:", error)
    return NextResponse.json({ error: "Couldn't load the documents. Please try again." }, { status: 500 })
  }
}
