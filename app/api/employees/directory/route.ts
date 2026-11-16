import { NextResponse } from "next/server"
import { supabase } from "@/lib/db"
import { fetchAllRows } from "@/lib/fetch-all"
import { allowedBranches, requireUser } from "@/lib/server-auth"
import { toEmployeeDocument } from "@/lib/document-api"
import { rtwState } from "@/lib/document-tracker"
import { todayUtc } from "@/lib/dates"
import { leaveAround, missingDetails, type DirectoryEmployee, type DirectoryLeave } from "@/lib/employee-directory"
import type { DocumentRow, EmployeeRow } from "@/lib/database.types"
import type { TrackerDocument } from "@/lib/types"

// GET /api/employees/directory: everyone in the branches this user may see,
// with who is away now, their next leave, right to work and missing details.
// One call for the whole list, so the page can filter and sort instantly.
export async function GET(request: Request) {
  try {
    const auth = await requireUser(request)
    if (auth.response) return auth.response
    const allowed = allowedBranches(auth.user)
    if (allowed && allowed.length === 0) return NextResponse.json({ rows: [] })

    const employees = await fetchAllRows<EmployeeRow>((from, to) => {
      let q = supabase.from("employees").select("*")
      if (allowed) q = q.in("branch", allowed)
      return q.order("name").order("id").range(from, to)
    })
    const ids = new Set(employees.map((e) => e.id))

    const documents = await fetchAllRows<DocumentRow>((from, to) =>
      supabase.from("documents").select("*").order("id").range(from, to),
    )
    const docByEmployee = new Map(documents.filter((d) => ids.has(d.employee_id)).map((d) => [d.employee_id, d]))

    const leave = await fetchAllRows<{ employee_id: string; type: string; start_date: string; end_date: string }>(
      (from, to) => {
        let q = supabase
          .from("leave_requests")
          .select("employee_id, type, start_date, end_date")
          .eq("status", "Approved")
        if (allowed) q = q.in("branch", allowed)
        return q.order("id").range(from, to)
      },
    )
    const leaveByEmployee = new Map<string, DirectoryLeave[]>()
    for (const l of leave) {
      const list = leaveByEmployee.get(l.employee_id) ?? []
      list.push({ type: l.type, startDate: l.start_date, endDate: l.end_date })
      leaveByEmployee.set(l.employee_id, list)
    }

    const today = todayUtc()
    const rows: DirectoryEmployee[] = employees.map((e) => {
      const record = docByEmployee.get(e.id)
      const doc: TrackerDocument | null = record
        ? { ...toEmployeeDocument(record), recordId: record.id, employeeCode: e.employee_code, noRecord: false }
        : null
      const rtw = doc
        ? { state: rtwState(doc), date: doc.rightToWorkExpiry, days: doc.rightToWorkDaysLeft }
        : { state: "missing" as const, date: null, days: null }
      const base = {
        id: e.id,
        name: e.name,
        employeeCode: e.employee_code,
        jobTitle: e.job_title,
        branch: e.branch,
        daysTaken: e.days_taken ?? 0,
        daysRemaining: e.days_remaining ?? 0,
        hours: e.hours ?? null,
        email: e.email || null,
        phone: e.phone || null,
        status: e.status || "active",
        hasDocuments: !!record,
      }
      return {
        ...base,
        ...leaveAround(leaveByEmployee.get(e.id) ?? [], today),
        rtw,
        missing: missingDetails(base),
      }
    })

    return NextResponse.json({ rows })
  } catch (error) {
    console.error("Error loading the employee directory:", error)
    return NextResponse.json({ error: "Couldn't load employees. Please try again." }, { status: 500 })
  }
}
