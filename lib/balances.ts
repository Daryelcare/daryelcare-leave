// Leave balances worked out from the leave itself, so they can be checked and
// repaired. Pure functions, so the rules are easy to test:
//
// - Only approved Annual Leave and Working Holiday use the balance.
// - Only the days inside the leave year count (leave crossing 31 March is split).
// - Everyone's entitlement is the standard 28 days, as when a year starts.

import { shouldDeductFromBalance } from "./utils"
import { daysInYear, type LeaveYear } from "./leave-years"

export const STANDARD_ENTITLEMENT = 28
/** More than this many days used in one year is almost certainly a mistake */
export const SUSPICIOUS_DAYS = STANDARD_ENTITLEMENT * 2

export type BalanceLeave = {
  employeeId: string
  type: string
  status: string
  startDate: string
  endDate: string
  duration: number
}

export type BalancePerson = { id: string; name: string; branch: string; daysTaken: number; daysRemaining: number }

export type BalanceRow = BalancePerson & {
  /** Days used this year according to the leave records */
  taken: number
  remaining: number
  changed: boolean
  suspicious: boolean
  entries: number
}

export function daysUsedInYear(leaves: BalanceLeave[], year: Pick<LeaveYear, "start" | "end">) {
  const used = new Map<string, { days: number; entries: number }>()
  for (const l of leaves) {
    if (l.status !== "Approved" || !shouldDeductFromBalance(l.type)) continue
    const days = daysInYear(l, year)
    if (days <= 0) continue
    const seen = used.get(l.employeeId) ?? { days: 0, entries: 0 }
    used.set(l.employeeId, { days: seen.days + days, entries: seen.entries + 1 })
  }
  return used
}

export function balanceCheck(people: BalancePerson[], leaves: BalanceLeave[], year: Pick<LeaveYear, "start" | "end">) {
  const used = daysUsedInYear(leaves, year)
  const rows: BalanceRow[] = people.map((p) => {
    const u = used.get(p.id) ?? { days: 0, entries: 0 }
    const remaining = STANDARD_ENTITLEMENT - u.days
    return {
      ...p,
      taken: u.days,
      remaining,
      changed: p.daysTaken !== u.days || p.daysRemaining !== remaining,
      suspicious: u.days > SUSPICIOUS_DAYS,
      entries: u.entries,
    }
  })
  // Biggest corrections first, then name
  rows.sort(
    (a, b) =>
      Number(b.changed) - Number(a.changed) ||
      Math.abs(b.daysRemaining - b.remaining) - Math.abs(a.daysRemaining - a.remaining) ||
      a.name.localeCompare(b.name),
  )
  const changed = rows.filter((r) => r.changed)
  return {
    rows,
    summary: {
      people: rows.length,
      changed: changed.length,
      negative: rows.filter((r) => r.remaining < 0).length,
      low: rows.filter((r) => r.remaining >= 0 && r.remaining <= 5).length,
      suspicious: rows.filter((r) => r.suspicious).length,
      daysUsed: rows.reduce((total, r) => total + r.taken, 0),
    },
  }
}
