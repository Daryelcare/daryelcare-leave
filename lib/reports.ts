// Figures for the Reports page, worked out from approved leave in a period.
// Pure functions, so they're easy to test. Days count only inside the period
// (leave that starts before or ends after it is clipped), never more than the
// entry's recorded duration.

import { DAY_MS, parseDateToUtc } from "./dates"

export type ReportLeave = {
  employeeId: string
  employee: string
  branch: string
  type: string
  status: string
  startDate: string
  endDate: string
  duration: number
}
export type Period = { from: number; to: number }

/** Days of this entry inside the period (0 if it doesn't touch it) */
export function daysInPeriod(l: Pick<ReportLeave, "startDate" | "endDate" | "duration">, p: Period): number {
  const s = parseDateToUtc(l.startDate)
  const e = parseDateToUtc(l.endDate) ?? s
  if (s === null || e === null) return 0
  const from = Math.max(s, p.from)
  const to = Math.min(e, p.to)
  if (from > to) return 0
  if (s >= p.from && e <= p.to) return l.duration
  return Math.min(Math.round((to - from) / DAY_MS) + 1, l.duration)
}

export const isSick = (type: string) => /sick/i.test(type)
export const usesBalance = (type: string) => type === "Annual Leave" || type === "Working Holiday"

export function reportFigures(leaves: ReportLeave[], p: Period) {
  const approved = leaves
    .filter((l) => l.status === "Approved")
    .map((l) => ({ ...l, days: daysInPeriod(l, p) }))
    .filter((l) => l.days > 0)

  const people = new Set(approved.map((l) => l.employeeId))
  const types = [...new Set(approved.map((l) => l.type))].sort((a, b) => a.localeCompare(b))

  // Branch × type
  const branchMap = new Map<
    string,
    { branch: string; people: Set<string>; byType: Map<string, number>; days: number }
  >()
  for (const l of approved) {
    const b = branchMap.get(l.branch) ?? { branch: l.branch, people: new Set(), byType: new Map(), days: 0 }
    b.people.add(l.employeeId)
    b.byType.set(l.type, (b.byType.get(l.type) ?? 0) + l.days)
    b.days += l.days
    branchMap.set(l.branch, b)
  }
  const byBranch = [...branchMap.values()]
    .map((b) => ({ branch: b.branch, people: b.people.size, days: b.days, byType: Object.fromEntries(b.byType) }))
    .sort((a, b) => b.days - a.days || a.branch.localeCompare(b.branch))

  // Days by calendar month, inside the period
  const months: { key: string; label: string; days: number }[] = []
  const start = new Date(p.from)
  for (let d = Date.UTC(start.getUTCFullYear(), start.getUTCMonth(), 1); d <= p.to; ) {
    const m = new Date(d)
    const end = Date.UTC(m.getUTCFullYear(), m.getUTCMonth() + 1, 0)
    const slice = { from: Math.max(d, p.from), to: Math.min(end, p.to) }
    months.push({
      key: `${m.getUTCFullYear()}-${m.getUTCMonth() + 1}`,
      label: m.toLocaleDateString("en-GB", { month: "short", year: "2-digit", timeZone: "UTC" }),
      days: approved.reduce((t, l) => t + daysInPeriod(l, slice), 0),
    })
    d = Date.UTC(m.getUTCFullYear(), m.getUTCMonth() + 1, 1)
    if (months.length > 36) break
  }

  // Sickness: Bradford Factor = spells² × days, per person
  const sickMap = new Map<string, { name: string; branch: string; spells: number; days: number }>()
  for (const l of approved.filter((x) => isSick(x.type))) {
    const s = sickMap.get(l.employeeId) ?? { name: l.employee, branch: l.branch, spells: 0, days: 0 }
    s.spells += 1
    s.days += l.days
    sickMap.set(l.employeeId, s)
  }
  const sickness = [...sickMap.values()]
    .map((s) => ({ ...s, bradford: s.spells * s.spells * s.days }))
    .sort((a, b) => b.bradford - a.bradford || a.name.localeCompare(b.name))

  const total = (pred: (t: string) => boolean) => approved.filter((l) => pred(l.type)).reduce((t, l) => t + l.days, 0)
  return {
    entries: approved.length,
    people: people.size,
    days: approved.reduce((t, l) => t + l.days, 0),
    annualDays: total(usesBalance),
    sickDays: total(isSick),
    types,
    byBranch,
    months,
    sickness,
  }
}
