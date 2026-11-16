// Server side of the balance check: load current staff, the leave and the
// active leave year, and (when asked) write the worked-out balances. Server only.

import { supabase } from "./db"
import { fetchAllRows } from "./fetch-all"
import { buildLeaveYears, type LeaveYear } from "./leave-years"
import { fetchLeavePeriods } from "./leave-server"
import { balanceCheck, type BalanceLeave, type BalancePerson } from "./balances"
import { allowanceColumnExists } from "./column-probe"

/** The leave year balances belong to: the active one in Settings, else the one containing today */
export async function currentLeaveYear(): Promise<LeaveYear> {
  const periods = await fetchLeavePeriods()
  const years = buildLeaveYears(periods, [], Date.now())
  const active = periods.find((p) => p.isActive)
  return (active && years.find((y) => y.key === active.startDate)) || years.find((y) => y.isCurrent) || years[0]
}

const EMPLOYEE_COLUMNS = "id, name, branch, status, days_taken, days_remaining"
// A variable, so the typed query builder doesn't try to check a column the
// generated types only know as optional
const EMPLOYEE_COLUMNS_WITH_ALLOWANCE: string = `${EMPLOYEE_COLUMNS}, annual_allowance`

export async function loadBalanceCheck(year?: LeaveYear) {
  const leaveYear = year ?? (await currentLeaveYear())
  // Per-person allowances, once the database update adding them has been run
  const withAllowance = await allowanceColumnExists()
  const employees = await fetchAllRows<{
    id: string
    name: string
    branch: string
    status: string | null
    days_taken: number | null
    days_remaining: number | null
    annual_allowance?: number | null
  }>((from, to) =>
    // Untyped here: annual_allowance only exists once the update has been run
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (supabase.from("employees") as any)
      .select(withAllowance ? EMPLOYEE_COLUMNS_WITH_ALLOWANCE : EMPLOYEE_COLUMNS)
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
      allowance: e.annual_allowance ?? null,
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

/**
 * Writes the worked-out balance for everyone whose stored one differs. Returns
 * how many changed. `skipSuspicious` (the nightly job) leaves alone anyone with
 * an implausible amount of leave used, so a bad record is reviewed by a person
 * rather than silently applied.
 */
export async function applyBalanceCheck(year?: LeaveYear, opts: { skipSuspicious?: boolean; only?: string[] } = {}) {
  const check = await loadBalanceCheck(year)
  const candidates = check.rows.filter((r) => r.changed && (!opts.only || opts.only.includes(r.id)))
  const skipped = opts.skipSuspicious ? candidates.filter((r) => r.suspicious) : []
  const changed = candidates.filter((r) => !skipped.includes(r))
  for (const row of changed) {
    const { error } = await supabase
      .from("employees")
      .update({ days_taken: row.taken, days_remaining: row.remaining })
      .eq("id", row.id)
    if (error) throw error
  }
  return { year: check.year, changed: changed.length, skipped: skipped.map((r) => r.name), summary: check.summary }
}
