// Leave years for the Leave page.
//
// The organisation's leave years are the periods stored in Settings → Leave
// periods (the `leave_periods` table). They are the source of truth. For
// records older than the first stored period, earlier years are worked out by
// repeating the stored years' start day and month (e.g. 1 April), so old
// leave is still grouped correctly. Nothing here changes any data.

import { DAY_MS, parseDateToUtc, toUkDate } from "./dates"
import { shouldDeductFromBalance } from "./utils"

export type StoredPeriod = { id?: string; startDate: string; endDate: string; isActive?: boolean }

export type LeaveYear = {
  /** Stable id for the address bar: the start date as YYYY-MM-DD */
  key: string
  /** UTC-midnight timestamps, both inclusive */
  start: number
  end: number
  /** "2026/2027" */
  label: string
  /** Contains today */
  isCurrent: boolean
  /** Set up in Settings (false = worked out from the stored years' pattern) */
  stored: boolean
}

export type LeaveRecordLike = {
  startDate: string
  endDate: string
  status: string
  type: string
  duration: number
}

const iso = (time: number) => new Date(time).toISOString().slice(0, 10)

function yearLabel(start: number, end: number) {
  const a = new Date(start).getUTCFullYear()
  const b = new Date(end).getUTCFullYear()
  return a === b ? String(a) : `${a}/${b}`
}

/** The leave year containing `time`, using the given start day and month */
function derivedYearFor(time: number, startMonth: number, startDay: number): { start: number; end: number } {
  const d = new Date(time)
  let year = d.getUTCFullYear()
  if (time < Date.UTC(year, startMonth, startDay)) year -= 1
  const start = Date.UTC(year, startMonth, startDay)
  const end = Date.UTC(year + 1, startMonth, startDay) - DAY_MS
  return { start, end }
}

/**
 * Every leave year worth offering, newest first: the stored periods, the year
 * containing today, and any year that has leave records in it.
 */
export function buildLeaveYears(
  periods: StoredPeriod[],
  records: Pick<LeaveRecordLike, "startDate" | "endDate">[],
  today: number,
): LeaveYear[] {
  const stored = periods
    .map((p) => ({ start: parseDateToUtc(p.startDate), end: parseDateToUtc(p.endDate), isActive: !!p.isActive }))
    .filter(
      (p): p is { start: number; end: number; isActive: boolean } =>
        p.start !== null && p.end !== null && p.end >= p.start,
    )

  // The organisation's leave-year start: from the active period, else the
  // latest stored one. 1 April is only a fallback if nothing is stored yet.
  const anchor = stored.find((p) => p.isActive) ?? [...stored].sort((a, b) => b.start - a.start)[0]
  const startMonth = anchor ? new Date(anchor.start).getUTCMonth() : 3
  const startDay = anchor ? new Date(anchor.start).getUTCDate() : 1

  const years = new Map<string, LeaveYear>()
  const add = (start: number, end: number, isStored: boolean) => {
    const key = iso(start)
    if (years.has(key) && !isStored) return
    years.set(key, { key, start, end, label: yearLabel(start, end), isCurrent: false, stored: isStored })
  }
  for (const p of stored) add(p.start, p.end, true)

  const inStored = (time: number) => stored.some((p) => time >= p.start && time <= p.end)
  const addFor = (time: number) => {
    if (inStored(time)) return
    const y = derivedYearFor(time, startMonth, startDay)
    // Don't overlap a stored period that starts or ends at an odd date
    if (stored.some((p) => y.start <= p.end && y.end >= p.start)) return
    add(y.start, y.end, false)
  }
  addFor(today)
  for (const r of records) {
    const s = parseDateToUtc(r.startDate)
    const e = parseDateToUtc(r.endDate)
    if (s !== null) addFor(s)
    if (e !== null) addFor(e)
  }

  // Fill in any years between the oldest and newest, so the list has no gaps
  // (a year with no leave still shows, with an empty list)
  const all = [...years.values()]
  if (all.length) {
    const oldest = Math.min(...all.map((y) => y.start))
    const newest = Math.max(...all.map((y) => y.start))
    let cursor = derivedYearFor(oldest, startMonth, startDay).end + DAY_MS
    let guard = 0
    while (cursor < newest && guard++ < 50) {
      addFor(cursor)
      cursor = derivedYearFor(cursor, startMonth, startDay).end + DAY_MS
    }
  }

  const list = [...years.values()].sort((a, b) => b.start - a.start)
  // Current = the year containing today; if none does, the newest one that has started
  const current = list.find((y) => today >= y.start && today <= y.end) ?? list.find((y) => y.start <= today)
  if (current) current.isCurrent = true
  return list
}

/** Days of a record that fall inside a leave year (0 if none) */
export function daysInYear(
  record: Pick<LeaveRecordLike, "startDate" | "endDate" | "duration">,
  year: Pick<LeaveYear, "start" | "end">,
): number {
  const s = parseDateToUtc(record.startDate)
  const e = parseDateToUtc(record.endDate)
  if (s === null || e === null) return 0
  const from = Math.max(s, year.start)
  const to = Math.min(e, year.end)
  if (from > to) return 0
  // Wholly inside the year: use the recorded duration, as the rest of the app does
  if (s >= year.start && e <= year.end) return record.duration
  // Spans a boundary: the calendar days inside this year, never more than the duration
  return Math.min(Math.round((to - from) / DAY_MS) + 1, record.duration)
}

/** Whether any part of a record falls in the year */
export function inYear(
  record: Pick<LeaveRecordLike, "startDate" | "endDate">,
  year: Pick<LeaveYear, "start" | "end">,
): boolean {
  const s = parseDateToUtc(record.startDate)
  const e = parseDateToUtc(record.endDate)
  if (s === null || e === null) return false
  return s <= year.end && e >= year.start
}

/** Whether a record crosses the start or end of the year */
export function crossesYear(
  record: Pick<LeaveRecordLike, "startDate" | "endDate">,
  year: Pick<LeaveYear, "start" | "end">,
): boolean {
  const s = parseDateToUtc(record.startDate)
  const e = parseDateToUtc(record.endDate)
  if (s === null || e === null) return false
  return inYear(record, year) && (s < year.start || e > year.end)
}

/**
 * Totals for a leave year, following the existing rules: only Approved Annual
 * Leave and Working Holiday count as taken; Pending is shown separately; other
 * approved types (e.g. Sick Leave) are listed but don't use the allowance;
 * Rejected counts nowhere. Only days inside the year are counted.
 */
export function summariseYear(records: LeaveRecordLike[], year: Pick<LeaveYear, "start" | "end">) {
  let taken = 0
  let pending = 0
  let other = 0
  let entries = 0
  for (const r of records) {
    const days = daysInYear(r, year)
    if (!inYear(r, year)) continue
    entries++
    if (r.status === "Approved" && shouldDeductFromBalance(r.type)) taken += days
    else if (r.status === "Pending" && shouldDeductFromBalance(r.type)) pending += days
    else if (r.status === "Approved") other += days
  }
  return { taken, pending, other, entries }
}

/** "01/04/2026 – 31/03/2027" */
export function yearRange(year: Pick<LeaveYear, "start" | "end">): string {
  return `${toUkDate(year.start)} – ${toUkDate(year.end)}`
}

/** A leave year is in the past once it has ended */
export function isPastYear(year: Pick<LeaveYear, "end">, today: number): boolean {
  return year.end < today
}
