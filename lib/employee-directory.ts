// The Employees page's rules, as pure functions so they're easy to test:
// who is away now, whose leave is next, right to work at a glance, missing
// details, and the filters and sorts built on them.

import { parseDateToUtc } from "./dates"
import type { RtwState } from "./document-tracker"

export type DirectoryLeave = { type: string; startDate: string; endDate: string }

export type DirectoryEmployee = {
  id: string
  name: string
  employeeCode: string
  jobTitle: string
  branch: string
  daysTaken: number
  daysRemaining: number
  hours: number | null
  email: string | null
  phone: string | null
  status: string
  /** Approved leave covering today, if any */
  awayNow: DirectoryLeave | null
  /** The next approved leave starting after today */
  nextLeave: DirectoryLeave | null
  rtw: { state: RtwState; date: string | null; days: number | null }
  hasDocuments: boolean
  /** What's missing from their record, in plain words */
  missing: string[]
}

export const isLeaver = (e: { status: string }) => (e.status || "active").toLowerCase() === "inactive"

/** "Unspecified" and blank job titles aren't shown */
export const shownJobTitle = (title: string | null | undefined) =>
  title && title.trim().toLowerCase() !== "unspecified" ? title.trim() : ""

export function missingDetails(e: Pick<DirectoryEmployee, "email" | "hours" | "jobTitle" | "hasDocuments">) {
  const out: string[] = []
  if (!e.email) out.push("Email")
  if (e.hours === null || e.hours === undefined) out.push("Hours")
  if (!shownJobTitle(e.jobTitle)) out.push("Job title")
  if (!e.hasDocuments) out.push("Documents")
  return out
}

/** Approved leave for one person → away now and next, given today (UTC midnight) */
export function leaveAround(leaves: DirectoryLeave[], today: number) {
  let awayNow: DirectoryLeave | null = null
  let nextLeave: DirectoryLeave | null = null
  let nextStart = Infinity
  let awayEnd = -Infinity
  for (const l of leaves) {
    const s = parseDateToUtc(l.startDate)
    const e = parseDateToUtc(l.endDate) ?? s
    if (s === null || e === null) continue
    if (s <= today && e >= today && e > awayEnd) {
      awayNow = l
      awayEnd = e
    } else if (s > today && s < nextStart) {
      nextLeave = l
      nextStart = s
    }
  }
  return { awayNow, nextLeave }
}

// ---------------------------------------------------------------- filters

export type PeopleStatus = "current" | "leavers" | "everyone"
export const toPeopleStatus = (v: string | null): PeopleStatus => (v === "leavers" || v === "everyone" ? v : "current")

export type PeopleShow = "all" | "away" | "rtw" | "missing" | "negative"
export const PEOPLE_SHOW: { id: PeopleShow; label: string }[] = [
  { id: "all", label: "Everyone" },
  { id: "away", label: "Away today" },
  { id: "rtw", label: "Right to work needs action" },
  { id: "missing", label: "Missing details" },
  { id: "negative", label: "Below zero" },
]
export const toPeopleShow = (v: string | null): PeopleShow =>
  PEOPLE_SHOW.some((s) => s.id === v) ? (v as PeopleShow) : "all"

const RTW_ACTION: RtwState[] = ["expired", "due", "missing"]
export const rtwNeedsAction = (e: Pick<DirectoryEmployee, "rtw">) => RTW_ACTION.includes(e.rtw.state)

export function matchesShow(e: DirectoryEmployee, show: PeopleShow) {
  switch (show) {
    case "away":
      return !!e.awayNow
    case "rtw":
      return rtwNeedsAction(e)
    case "missing":
      return e.missing.length > 0
    case "negative":
      return e.daysRemaining < 0
    default:
      return true
  }
}

export function matchesPeopleSearch(e: DirectoryEmployee, query: string) {
  const words = query.toLowerCase().split(/\s+/).filter(Boolean)
  if (!words.length) return true
  const text = [e.name, e.employeeCode, e.jobTitle, e.branch, e.email].filter(Boolean).join(" ").toLowerCase()
  return words.every((w) => text.includes(w))
}

// ---------------------------------------------------------------- sort

export type PeopleSort = "name" | "name_desc" | "leave_low" | "next_leave"
export const PEOPLE_SORTS: { id: PeopleSort; label: string }[] = [
  { id: "name", label: "Name A–Z" },
  { id: "name_desc", label: "Name Z–A" },
  { id: "leave_low", label: "Least leave left" },
  { id: "next_leave", label: "Next leave soonest" },
]
export const toPeopleSort = (v: string | null): PeopleSort =>
  PEOPLE_SORTS.some((s) => s.id === v) ? (v as PeopleSort) : "name"

export function sortPeople<T extends DirectoryEmployee>(rows: T[], sort: PeopleSort): T[] {
  const byName = (a: T, b: T) => a.name.localeCompare(b.name)
  const nextKey = (e: T) =>
    e.awayNow ? -1 : e.nextLeave ? (parseDateToUtc(e.nextLeave.startDate) ?? Infinity) : Infinity
  const list = [...rows]
  switch (sort) {
    case "name_desc":
      return list.sort((a, b) => byName(b, a))
    case "leave_low":
      return list.sort((a, b) => a.daysRemaining - b.daysRemaining || byName(a, b))
    case "next_leave":
      return list.sort((a, b) => nextKey(a) - nextKey(b) || byName(a, b))
    default:
      return list.sort(byName)
  }
}

export function peopleSummary(rows: DirectoryEmployee[]) {
  const current = rows.filter((e) => !isLeaver(e))
  return {
    current: current.length,
    leavers: rows.length - current.length,
    away: current.filter((e) => e.awayNow).length,
    rtw: current.filter(rtwNeedsAction).length,
    missing: current.filter((e) => e.missing.length > 0).length,
    negative: current.filter((e) => e.daysRemaining < 0).length,
  }
}
