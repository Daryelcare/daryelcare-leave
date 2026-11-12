import { NextResponse } from "next/server"
import { supabase } from "@/lib/supabase"
import { requireUser, allowedBranches } from "@/lib/server-auth"
import { addDays, startOfWeek, toIsoDate, todayUtc } from "@/lib/dates"
import { getLeaveBetween, resolveBranchFilter } from "@/lib/leave-data"
import { DOCUMENT_FIELDS, withLiveDaysLeft } from "@/lib/document-status"

// At or below this many days remaining counts as a "low" balance
const LOW_BALANCE_DAYS = 5
// Documents expiring within this many days are flagged on the dashboard
const DOCUMENT_WARNING_DAYS = 30

const DOCUMENT_LABELS: Record<string, string> = {
  passport_expiry: "Passport",
  right_to_work_expiry: "Right to work",
  brp_expiry: "BRP",
}

// GET /api/dashboard?branch=<name|all>
// Real numbers for the dashboard: who is off today and this week, staff with
// low or negative leave balances and (admins only) documents expiring soon.
export async function GET(request: Request) {
  try {
    const auth = await requireUser(request)
    if (auth.response) return auth.response
    const { user } = auth

    const { searchParams } = new URL(request.url)
    const branches = resolveBranchFilter(searchParams.get("branch"), allowedBranches(user))

    const today = todayUtc()
    const weekStart = startOfWeek(today)
    const weekEnd = addDays(weekStart, 6)
    const todayIso = toIsoDate(today)

    // Leave overlapping this week (includes everyone off today)
    const weekLeave = await getLeaveBetween(weekStart, weekEnd, branches)
    const offToday = weekLeave.filter((l) => l.start <= todayIso && l.end >= todayIso)

    // Leave balances of active staff
    let employees: { id: string; name: string; branch: string; days_remaining: number; days_taken: number }[] = []
    if (!branches || branches.length > 0) {
      let query = supabase
        .from("employees")
        .select("id, name, branch, days_remaining, days_taken")
        .eq("status", "active")
        .lte("days_remaining", LOW_BALANCE_DAYS)
        .order("days_remaining", { ascending: true })
        .limit(1000)
      if (branches) query = query.in("branch", branches)
      const { data, error } = await query
      if (error) throw error
      employees = data || []
    }
    const toBalance = (e: (typeof employees)[number]) => ({
      id: e.id,
      name: e.name,
      branch: e.branch,
      daysRemaining: e.days_remaining,
      daysTaken: e.days_taken,
    })

    // Documents: admins only, as on the Document Tracker
    let documents = null
    if (user.role === "admin") {
      let query = supabase.from("documents").select("*").limit(5000)
      if (branches) query = query.in("branch", branches)
      const { data, error } = await query
      if (error) throw error

      const items: {
        id: string
        employeeId: string
        employeeName: string
        branch: string
        document: string
        expiry: string
        daysLeft: number
        isSponsored: boolean
      }[] = []

      for (const raw of data || []) {
        const doc = withLiveDaysLeft(raw)
        for (const [expiryColumn, daysLeftColumn] of DOCUMENT_FIELDS) {
          const daysLeft = doc[daysLeftColumn]
          const expiry = doc[expiryColumn]
          if (typeof daysLeft !== "number" || !expiry || daysLeft > DOCUMENT_WARNING_DAYS) continue
          items.push({
            id: doc.id,
            employeeId: doc.employee_id,
            employeeName: doc.employee_name,
            branch: doc.branch,
            document: DOCUMENT_LABELS[expiryColumn] || doc.other_document_type || "Other document",
            expiry,
            daysLeft,
            isSponsored: !!doc.is_sponsored,
          })
        }
      }
      items.sort((a, b) => a.daysLeft - b.daysLeft)
      documents = {
        warningDays: DOCUMENT_WARNING_DAYS,
        expired: items.filter((i) => i.daysLeft <= 0),
        expiringSoon: items.filter((i) => i.daysLeft > 0),
      }
    }

    return NextResponse.json({
      today: todayIso,
      weekStart: toIsoDate(weekStart),
      weekEnd: toIsoDate(weekEnd),
      offToday,
      offThisWeek: weekLeave,
      balances: {
        lowThreshold: LOW_BALANCE_DAYS,
        negative: employees.filter((e) => e.days_remaining < 0).map(toBalance),
        low: employees.filter((e) => e.days_remaining >= 0).map(toBalance),
      },
      documents,
    })
  } catch (error) {
    console.error("Error building dashboard:", error)
    return NextResponse.json(
      { error: `Failed to load dashboard: ${error instanceof Error ? error.message : "unknown error"}` },
      { status: 500 },
    )
  }
}
