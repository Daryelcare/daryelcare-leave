import { NextResponse } from "next/server"
import { supabase } from "@/lib/db"
import { RTW_SETUP_MESSAGE, rtwColumns, rtwColumnsExist } from "@/lib/document-api"
import { inBatches } from "@/lib/fetch-all"
import { canAccessBranch, requirePermission } from "@/lib/server-auth"
import { isRtwBasis, rtwBasisLabel } from "@/lib/rtw"
import type { EmployeeRow } from "@/lib/database.types"

const MAX_PEOPLE = 2000

// GET: whether how right to work is held can be recorded yet (the one-off
// database update has been run)
export async function GET(request: Request) {
  const auth = await requirePermission(request, "documents_view")
  if (auth.response) return auth.response
  try {
    return NextResponse.json({ available: await rtwColumnsExist() })
  } catch (error) {
    console.error("Error checking right to work setup:", error)
    return NextResponse.json({ available: false })
  }
}

// POST /api/documents/rtw-basis { employeeIds, basis, checkedOn? }
// Records how right to work is held for several people at once (one-off
// checks, or pending applications checked on the same day). Time-limited
// permission needs each person's own end date, so it's set one at a time.
// People with no documents record get one only for "British or Irish
// citizen" (status BRITISH); otherwise they're listed as skipped.
export async function POST(request: Request) {
  try {
    const auth = await requirePermission(request, "documents_edit")
    if (auth.response) return auth.response

    const body = await request.json().catch(() => ({}))
    const raw: unknown[] = Array.isArray(body.employeeIds) ? body.employeeIds : []
    const ids = [...new Set(raw.filter((x): x is string => typeof x === "string" && !!x))]
    if (ids.length === 0) return NextResponse.json({ error: "Choose at least one person" }, { status: 400 })
    if (ids.length > MAX_PEOPLE) return NextResponse.json({ error: `Choose up to ${MAX_PEOPLE} people at a time` }, { status: 400 })
    if (!isRtwBasis(body.basis)) return NextResponse.json({ error: "Choose how their right to work is held" }, { status: 400 })
    if (body.basis === "time_limited") {
      return NextResponse.json(
        { error: "Time-limited permission needs each person's own end date, so set it from their record" },
        { status: 400 },
      )
    }
    const rtw = rtwColumns({ rtwBasis: body.basis, rtwCheckedOn: body.checkedOn ?? null })
    if (!rtw) return NextResponse.json({ error: "Choose how their right to work is held" }, { status: 400 })
    if ("error" in rtw) return NextResponse.json({ error: rtw.error }, { status: 400 })
    if (!(await rtwColumnsExist())) return NextResponse.json({ error: RTW_SETUP_MESSAGE }, { status: 409 })

    // The people, limited to branches this user may manage
    const people: Pick<EmployeeRow, "id" | "name" | "branch">[] = []
    await inBatches(ids, async (batch) => {
      const { data, error } = await supabase.from("employees").select("id, name, branch").in("id", batch)
      if (error) throw error
      people.push(...(data ?? []))
    })
    const allowed = people.filter((p) => canAccessBranch(auth.user, p.branch))
    if (allowed.length === 0) {
      return NextResponse.json({ error: "You can only manage documents for your own branches" }, { status: 403 })
    }

    const existing = new Map<string, string>()
    await inBatches(
      allowed.map((p) => p.id),
      async (batch) => {
        const { data, error } = await supabase.from("documents").select("id, employee_id").in("employee_id", batch)
        if (error) throw error
        for (const r of data ?? []) existing.set(r.employee_id, r.id)
      },
    )

    const withRecord = allowed.filter((p) => existing.has(p.id))
    const without = allowed.filter((p) => !existing.has(p.id))

    let updated = 0
    await inBatches(
      withRecord.map((p) => existing.get(p.id)!),
      async (batch) => {
        const { data, error } = await supabase.from("documents").update(rtw.columns).in("id", batch).select("id")
        if (error) throw error
        updated += data?.length ?? 0
      },
    )

    let created = 0
    const skipped: string[] = []
    if (body.basis === "british_irish" && without.length > 0) {
      const rows = without.map((p) => ({
        employee_id: p.id,
        employee_name: p.name,
        branch: p.branch,
        status: "BRITISH",
        country: "United Kingdom",
        is_sponsored: false,
        is_20_hours: false,
        ...rtw.columns,
      }))
      const { data, error } = await supabase.from("documents").insert(rows).select("id")
      if (error) throw error
      created = data?.length ?? 0
    } else {
      skipped.push(...without.map((p) => p.name))
    }

    console.log(
      `${auth.user.email} set right to work to "${rtwBasisLabel(body.basis)}" for ${updated + created} people` +
        (skipped.length ? ` (${skipped.length} skipped: no documents record)` : ""),
    )
    return NextResponse.json({ updated, created, skipped })
  } catch (error) {
    console.error("Error setting right to work basis:", error)
    return NextResponse.json({ error: "Couldn't save. Please try again." }, { status: 500 })
  }
}
