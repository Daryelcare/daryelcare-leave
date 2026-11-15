// The Documents page's people-level rules, modelled on CarerHR's Document
// Tracker. Pure functions over the rows the tracker API returns, so the rules
// are easy to test:
//
// - Everyone current is in, including people with no documents record at all
//   ("Missing"); leavers are left out by the API.
// - A document is expired on or after its expiry day (0 days left or fewer),
//   and expiring soon within the next 30 days.
// - Right to work needs action when it has expired, expires within 30 days, or
//   has no expiry date for someone whose status means they need one (NON-EU),
//   or there is no record at all. British staff and EU staff (who may hold
//   settled status, which doesn't expire) aren't flagged for a missing date.
// - Once how right to work is held is recorded (lib/rtw.ts), that decides:
//   British/Irish and permanent permission are never flagged again; time-limited
//   and pending applications count down to the date to check again by.

import type { TrackerDocument } from "./types"
import { entriesFor, nextExpiry } from "./document-view"
import { isOneOff } from "./rtw"

export const EXPIRING_DAYS = 30

export type RtwState = "ok" | "due" | "expired" | "missing" | "not_needed"

export type PersonStatus = {
  /** Dated documents that have expired */
  expired: number
  /** Dated documents expiring within 30 days */
  expiring: number
  /** No documents record on file */
  missing: boolean
  rtw: RtwState
  rtwAction: boolean
  /** Expired + expiring documents, plus one for no record or a missing right to work date */
  issues: number
}

export function rtwState(doc: TrackerDocument): RtwState {
  if (doc.noRecord) return "missing"
  // British/Irish citizens and permanent permission: one check is enough
  if (isOneOff(doc.rtwBasis)) return "not_needed"
  // Time-limited or pending: the date to check again by must be there
  if (doc.rtwBasis && !doc.rightToWorkExpiry) return "missing"
  const days = doc.rightToWorkExpiry ? doc.rightToWorkDaysLeft : null
  if (days !== null && days !== undefined) {
    if (days <= 0) return "expired"
    if (days <= EXPIRING_DAYS) return "due"
    return "ok"
  }
  return (doc.status || "").toUpperCase() === "NON-EU" ? "missing" : "not_needed"
}

export function personStatus(doc: TrackerDocument): PersonStatus {
  let expired = 0
  let expiring = 0
  for (const e of entriesFor(doc)) {
    if (e.days === null) continue
    if (e.days <= 0) expired++
    else if (e.days <= EXPIRING_DAYS) expiring++
  }
  const rtw = rtwState(doc)
  const rtwAction = rtw === "expired" || rtw === "due" || rtw === "missing"
  // A missing right to work date (with a record) is its own issue; expired and
  // due right to work are already counted as expired / expiring documents
  const issues = expired + expiring + (doc.noRecord ? 1 : 0) + (!doc.noRecord && rtw === "missing" ? 1 : 0)
  return { expired, expiring, missing: doc.noRecord, rtw, rtwAction, issues }
}

// ---------------------------------------------------------------- status filter

export type StatusFilter = "all" | "expired" | "expiring" | "missing" | "rtw_due" | "rtw_action"

export const STATUS_FILTERS: { id: StatusFilter; label: string }[] = [
  { id: "all", label: "Any status" },
  { id: "expired", label: "With expired documents" },
  { id: "expiring", label: "With documents expiring soon" },
  { id: "missing", label: "With no documents on file" },
  { id: "rtw_due", label: "Right to work check due" },
  { id: "rtw_action", label: "Right to work action needed" },
]

export const toStatusFilter = (v: string | null): StatusFilter =>
  STATUS_FILTERS.some((s) => s.id === v) ? (v as StatusFilter) : "all"

export function matchesStatus(doc: TrackerDocument, filter: StatusFilter): boolean {
  if (filter === "all") return true
  const s = personStatus(doc)
  switch (filter) {
    case "expired":
      return s.expired > 0
    case "expiring":
      return s.expiring > 0
    case "missing":
      return s.missing
    case "rtw_due":
      return s.rtw === "due"
    case "rtw_action":
      return s.rtwAction
  }
}

// ---------------------------------------------------------------- tiles

export type TrackerSummary = {
  people: number
  expired: { people: number; documents: number }
  expiring: { people: number; documents: number }
  missing: number
  rtwAction: number
  /** Dated documents not yet expired, out of dated documents plus people with nothing on file */
  inDate: { ok: number; total: number; percent: number | null }
}

export function trackerSummary(rows: TrackerDocument[]): TrackerSummary {
  const out: TrackerSummary = {
    people: rows.length,
    expired: { people: 0, documents: 0 },
    expiring: { people: 0, documents: 0 },
    missing: 0,
    rtwAction: 0,
    inDate: { ok: 0, total: 0, percent: null },
  }
  for (const row of rows) {
    const s = personStatus(row)
    if (s.expired) out.expired.people++
    if (s.expiring) out.expiring.people++
    out.expired.documents += s.expired
    out.expiring.documents += s.expiring
    if (s.missing) out.missing++
    if (s.rtwAction) out.rtwAction++
    const dated = entriesFor(row).filter((e) => e.days !== null)
    out.inDate.total += dated.length + (s.missing ? 1 : 0)
    out.inDate.ok += dated.filter((e) => (e.days as number) > 0).length
  }
  out.inDate.percent = out.inDate.total ? Math.floor((out.inDate.ok / out.inDate.total) * 100) : null
  return out
}

// ---------------------------------------------------------------- sort

/** Most issues first; then the soonest expiry; then name */
export function sortByIssues<T extends TrackerDocument>(rows: T[]): T[] {
  const key = rows.map((row) => ({
    row,
    issues: personStatus(row).issues,
    next: nextExpiry(row)?.days ?? Number.POSITIVE_INFINITY,
  }))
  return key
    .sort(
      (a, b) =>
        b.issues - a.issues || a.next - b.next || (a.row.employeeName || "").localeCompare(b.row.employeeName || ""),
    )
    .map((k) => k.row)
}

// ---------------------------------------------------------------- search

/** Every word must appear in the name, code, country, branch or status */
export function matchesSearch(doc: TrackerDocument, query: string): boolean {
  const words = query.toLowerCase().split(/\s+/).filter(Boolean)
  if (!words.length) return true
  const text = [doc.employeeName, doc.employeeCode, doc.country, doc.branch, doc.status, doc.otherDocumentType]
    .filter(Boolean)
    .join(" ")
    .toLowerCase()
  return words.every((w) => text.includes(w))
}
