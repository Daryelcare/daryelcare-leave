// Filters, sorting and summary counts for the Leave page list, modelled on
// CarerHR's client admin Leave page. Pure functions, so they're easy to test.

import { DAY_MS, parseDateToUtc } from "./dates"

export type LeaveLike = {
  id: string
  employeeId: string
  employee: string
  startDate: string
  endDate: string
  status: string
  type: string
  duration: number
  submittedDate?: string
}

// ---------------------------------------------------------------- status

export type StatusFilter = "all" | "Pending" | "Approved" | "Rejected"
export const STATUS_FILTERS: { value: StatusFilter; label: string }[] = [
  { value: "all", label: "All statuses" },
  { value: "Pending", label: "Pending" },
  { value: "Approved", label: "Approved" },
  { value: "Rejected", label: "Rejected" },
]
export const toStatusFilter = (v: string | null): StatusFilter =>
  STATUS_FILTERS.some((s) => s.value === v) ? (v as StatusFilter) : "all"

// ---------------------------------------------------------------- dates

export type DatePreset = "any" | "today" | "next30" | "month" | "custom"
export const DATE_PRESETS: { value: DatePreset; label: string }[] = [
  { value: "any", label: "Any dates" },
  { value: "today", label: "Away today" },
  { value: "next30", label: "Starting in 30 days" },
  { value: "month", label: "This month" },
  { value: "custom", label: "Custom dates" },
]
export const toDatePreset = (v: string | null): DatePreset =>
  DATE_PRESETS.some((d) => d.value === v) ? (v as DatePreset) : "any"

/**
 * The window a request must touch ("overlap") or start inside ("starts"), as
 * UTC-midnight timestamps. Null when there's no date filter (or a custom range
 * isn't complete yet).
 */
export function dateWindow(
  preset: DatePreset,
  today: number,
  custom?: { from: number | null; to: number | null },
): { kind: "overlap" | "starts"; from: number; to: number } | null {
  if (preset === "today") return { kind: "overlap", from: today, to: today }
  // Starting tomorrow up to 30 days ahead, as in CarerHR
  if (preset === "next30") return { kind: "starts", from: today + DAY_MS, to: today + 30 * DAY_MS }
  if (preset === "month") {
    const d = new Date(today)
    return {
      kind: "overlap",
      from: Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), 1),
      to: Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 0),
    }
  }
  if (preset === "custom" && custom?.from != null && custom?.to != null && custom.to >= custom.from) {
    return { kind: "overlap", from: custom.from, to: custom.to }
  }
  return null
}

export function inWindow(row: Pick<LeaveLike, "startDate" | "endDate">, w: ReturnType<typeof dateWindow>): boolean {
  if (!w) return true
  const s = parseDateToUtc(row.startDate)
  const e = parseDateToUtc(row.endDate) ?? s
  if (s === null || e === null) return false
  return w.kind === "starts" ? s >= w.from && s <= w.to : s <= w.to && e >= w.from
}

// ---------------------------------------------------------------- sort

export type LeaveSort = "pending_first" | "submitted" | "start_soonest" | "start_latest" | "employee"
export const LEAVE_SORTS: { value: LeaveSort; label: string }[] = [
  { value: "pending_first", label: "Pending first" },
  { value: "submitted", label: "Newest submitted" },
  { value: "start_soonest", label: "Start date, soonest" },
  { value: "start_latest", label: "Start date, latest" },
  { value: "employee", label: "Employee A–Z" },
]
export const toLeaveSort = (v: string | null): LeaveSort =>
  LEAVE_SORTS.some((s) => s.value === v) ? (v as LeaveSort) : "pending_first"

const startOf = (r: LeaveLike) => parseDateToUtc(r.startDate) ?? 0
const submittedOf = (r: LeaveLike) => (r.submittedDate ? (parseDateToUtc(r.submittedDate) ?? 0) : 0)

export function sortLeave<T extends LeaveLike>(rows: T[], sort: LeaveSort): T[] {
  const list = [...rows]
  const byName = (a: T, b: T) => a.employee.localeCompare(b.employee)
  switch (sort) {
    case "pending_first":
      // Pending needs a decision, so it comes first; then newest submitted
      return list.sort(
        (a, b) =>
          Number(b.status === "Pending") - Number(a.status === "Pending") ||
          submittedOf(b) - submittedOf(a) ||
          startOf(b) - startOf(a) ||
          byName(a, b),
      )
    case "submitted":
      return list.sort((a, b) => submittedOf(b) - submittedOf(a) || startOf(b) - startOf(a) || byName(a, b))
    case "start_soonest":
      return list.sort((a, b) => startOf(a) - startOf(b) || byName(a, b))
    case "start_latest":
      return list.sort((a, b) => startOf(b) - startOf(a) || byName(a, b))
    case "employee":
      return list.sort((a, b) => byName(a, b) || startOf(a) - startOf(b))
  }
}

// ---------------------------------------------------------------- summary tiles

/**
 * The tile numbers: requests waiting for a decision, people on approved leave
 * today, approved leave starting in the next 30 days, and (from employee
 * balances) current staff below zero.
 */
export function leaveCounts(rows: LeaveLike[], today: number) {
  const awayToday = new Set<string>()
  let pending = 0
  let upcoming = 0
  const next30 = dateWindow("next30", today)!
  for (const r of rows) {
    if (r.status === "Pending") pending++
    if (r.status !== "Approved") continue
    if (inWindow(r, { kind: "overlap", from: today, to: today })) awayToday.add(r.employeeId)
    if (inWindow(r, next30)) upcoming++
  }
  return { pending, awayToday: awayToday.size, upcoming }
}

export type BalanceLike = {
  id: string
  name: string
  branch: string
  status?: string
  daysRemaining: number
  daysTaken: number
}

/** Current staff below zero, most overdrawn first */
export function overEntitlement<T extends BalanceLike>(employees: T[]): T[] {
  return employees
    .filter((e) => (e.status ?? "active") === "active" && e.daysRemaining < 0)
    .sort((a, b) => a.daysRemaining - b.daysRemaining || a.name.localeCompare(b.name))
}

// ---------------------------------------------------------------- pages

export const PAGE_SIZES = [50, 100, 250, 0] as const // 0 = all
export type PageSize = (typeof PAGE_SIZES)[number]
export const toPageSize = (v: string | null): PageSize => {
  const n = Number(v)
  return (PAGE_SIZES as readonly number[]).includes(n) ? (n as PageSize) : 50
}

export function paginate<T>(rows: T[], page: number, size: PageSize) {
  if (size === 0) return { items: rows, page: 1, pages: 1, from: rows.length ? 1 : 0, to: rows.length }
  const pages = Math.max(1, Math.ceil(rows.length / size))
  const p = Math.min(Math.max(1, page), pages)
  const start = (p - 1) * size
  return {
    items: rows.slice(start, start + size),
    page: p,
    pages,
    from: rows.length ? start + 1 : 0,
    to: Math.min(start + size, rows.length),
  }
}
