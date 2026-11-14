// Server side of the balance check: load current staff, the leave and the
// active leave year, and (when asked) write the worked-out balances. Server only.

import { supabase } from "./supabase"
import { fetchAllRows } from "./fetch-all"
import { buildLeaveYears, type LeaveYear } from "./leave-years"
import { fetchLeavePeriods } from "./leave-server"
import { balanceCheck, type BalanceLeave, type BalancePerson } from "./balances"

/** The leave year balances belong to: the active one in Settings, else the one containing today */
export async function currentLeaveYear(): Promise<LeaveYear> {
  const periods = await fetchLeavePeriods()
  const years = buildLeaveYears(periods, [], Date.now())
  const active = periods.find((p) => p.isActive)
  return (active && years.find((y) => y.key === active.startDate)) || years.find((y) => y.isCurrent) || years[0]
}

export async function loadBalanceCheck(year?: LeaveYear) {
  const leaveYear = year ?? (await currentLeaveYear())
  const employees = await fetchAllRows<{
    id: string
    name: string
    branch: string
    status: string | null
    days_taken: number | null
    days_remaining: number | null
  }>((from, to) =>
    supabase
      .from("employees")
      .select("id, name, branch, status, days_taken, days_remaining")
      .order("id")
      .range(from, to),
  )
  const leave = await fetchAllRows<{
    employee_id: string
    type: string
    status: string
    start_date: string
    end_date: string
    duration: number
  }>((from, to) =>
    supabase
      .from("leave_requests")
      .select("employee_id, type, status, start_date, end_date, duration")
      .order("id")
      .range(from, to),
  )
  const people: BalancePerson[] = employees
    .filter((e) => (e.status || "active").toLowerCase() !== "inactive")
    .map((e) => ({
      id: e.id,
      name: e.name,
      branch: e.branch,
      daysTaken: e.days_taken ?? 0,
      daysRemaining: e.days_remaining ?? 0,
    }))
  const leaves: BalanceLeave[] = leave.map((l) => ({
    employeeId: l.employee_id,
    type: l.type,
    status: l.status,
    startDate: l.start_date,
    endDate: l.end_date,
    duration: l.duration,
  }))
  return { year: leaveYear, ...balanceCheck(people, leaves, leaveYear) }
}

/** Writes the worked-out balance for everyone whose stored one differs. Returns how many changed. */
export async function applyBalanceCheck(year?: LeaveYear) {
  const check = await loadBalanceCheck(year)
  const changed = check.rows.filter((r) => r.changed)
  for (const row of changed) {
    const { error } = await supabase
      .from("employees")
      .update({ days_taken: row.taken, days_remaining: row.remaining })
      .eq("id", row.id)
    if (error) throw error
  }
  return { year: check.year, changed: changed.length, summary: check.summary }
}
