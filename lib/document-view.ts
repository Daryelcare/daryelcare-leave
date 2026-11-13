// Expiry rules for the Documents page. Pure functions, so they're easy to test.
import type { EmployeeDocument } from "./types"
import { parseDateToUtc } from "./dates"

export type DocKind = "passport" | "rightToWork" | "brp" | "other"
export type DocEntry = { kind: DocKind; label: string; date: string; days: number | null }

// Right to work is the check that matters most, so it always comes first
export const DOC_KINDS: { id: DocKind; label: string }[] = [
  { id: "rightToWork", label: "Right to work" },
  { id: "passport", label: "Passport" },
  { id: "brp", label: "BRP" },
  { id: "other", label: "Other" },
]

/** The documents with an expiry date on one employee's record */
export function entriesFor(doc: EmployeeDocument, kind: DocKind | "all" = "all"): DocEntry[] {
  const all: DocEntry[] = [
    { kind: "rightToWork", label: "Right to work", date: doc.rightToWorkExpiry || "", days: doc.rightToWorkDaysLeft },
    { kind: "passport", label: "Passport", date: doc.passportExpiry || "", days: doc.passportDaysLeft },
    { kind: "brp", label: "BRP", date: doc.brpExpiry || "", days: doc.brpDaysLeft },
    {
      kind: "other",
      label: doc.otherDocumentType || "Other",
      date: doc.otherDocumentExpiry || "",
      days: doc.otherDocumentDaysLeft,
    },
  ]
  return all.filter((e) => e.date && (kind === "all" || e.kind === kind))
}

/**
 * Expiry filters. 7, 30 and 90 days are windows that include everything due
 * inside them (so "30 days" includes the 7-day ones); expired documents are
 * their own filter. Valid means every dated document has more than 90 days.
 */
export type ExpiryFilter = "all" | "expired" | "within7" | "within30" | "within90" | "valid" | "none"

export const EXPIRY_FILTERS: { id: ExpiryFilter; label: string; long: string }[] = [
  { id: "all", label: "All", long: "All employees" },
  { id: "expired", label: "Expired", long: "Expired" },
  { id: "within7", label: "7 days", long: "Expiring within 7 days" },
  { id: "within30", label: "30 days", long: "Expiring within 30 days" },
  { id: "within90", label: "90 days", long: "Expiring within 90 days" },
  { id: "valid", label: "Valid", long: "Valid for 90+ days" },
  { id: "none", label: "No dates", long: "No expiry dates recorded" },
]

const inWindow = (d: number | null, max: number) => d !== null && d > 0 && d <= max

/** Whether one document's days-left falls in a filter */
export function entryMatches(filter: ExpiryFilter, days: number | null): boolean {
  switch (filter) {
    case "expired":
      return days !== null && days <= 0
    case "within7":
      return inWindow(days, 7)
    case "within30":
      return inWindow(days, 30)
    case "within90":
      return inWindow(days, 90)
    case "valid":
      return days === null || days > 90
    default:
      return true
  }
}

/** Whether an employee's record belongs in a filter, looking only at `kind` documents */
export function recordMatches(doc: EmployeeDocument, filter: ExpiryFilter, kind: DocKind | "all" = "all"): boolean {
  const entries = entriesFor(doc, kind)
  if (filter === "all") return true
  if (filter === "none") return entries.length === 0
  if (filter === "valid") return entries.length > 0 && entries.every((e) => e.days === null || e.days > 90)
  return entries.some((e) => entryMatches(filter, e.days))
}

/** The record's most urgent state, for the colour stripe and the overview bar */
export type Urgency = "expired" | "d7" | "d30" | "d90" | "valid" | "none"

export function urgencyOf(days: number | null): Urgency {
  if (days === null) return "valid"
  if (days <= 0) return "expired"
  if (days <= 7) return "d7"
  if (days <= 30) return "d30"
  if (days <= 90) return "d90"
  return "valid"
}

/** The soonest-expiring document (null if none have a date) */
export function nextExpiry(doc: EmployeeDocument, kind: DocKind | "all" = "all"): DocEntry | null {
  const dated = entriesFor(doc, kind).filter((e) => e.days !== null)
  if (dated.length === 0) return null
  return dated.reduce((a, b) => ((b.days as number) < (a.days as number) ? b : a))
}

export function recordUrgency(doc: EmployeeDocument, kind: DocKind | "all" = "all"): Urgency {
  const next = nextExpiry(doc, kind)
  return next ? urgencyOf(next.days) : entriesFor(doc, kind).length > 0 ? "valid" : "none"
}

/** "12 days overdue", "Expires today", "In 8 days", "In 2y 3m" */
export function daysLabel(days: number | null): string {
  if (days === null) return "—"
  if (days < 0) return `${Math.abs(days)} ${Math.abs(days) === 1 ? "day" : "days"} overdue`
  if (days === 0) return "Expires today"
  if (days === 1) return "Tomorrow"
  if (days > 365) {
    const years = Math.floor(days / 365)
    const months = Math.round((days % 365) / 30)
    return months > 0 ? `In ${years}y ${months}m` : `In ${years}y`
  }
  return `In ${days} days`
}

/** The two lines of a date chip: "13/11" over "2026" (dates are always DD/MM/YYYY) */
export function dateChip(value: string): { dayMonth: string; year: string } | null {
  const time = parseDateToUtc(value)
  if (time === null) return null
  const d = new Date(time)
  return {
    dayMonth: `${String(d.getUTCDate()).padStart(2, "0")}/${String(d.getUTCMonth() + 1).padStart(2, "0")}`,
    year: String(d.getUTCFullYear()),
  }
}

/** A CSV file of the given records, one row per employee */
export function documentsCsv(docs: EmployeeDocument[]): string {
  const header = [
    "Employee",
    "Branch",
    "Status",
    "Country",
    "Sponsored",
    "20 hours",
    "Right to work expiry",
    "Right to work days left",
    "Passport expiry",
    "Passport days left",
    "BRP expiry",
    "BRP days left",
    "Other document",
    "Other expiry",
    "Other days left",
  ]
  const cell = (value: unknown) => {
    const text = value === null || value === undefined ? "" : String(value)
    return /[",\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text
  }
  const rows = docs.map((d) =>
    [
      d.employeeName,
      d.branch,
      d.status,
      d.country,
      d.isSponsored ? "Yes" : "No",
      d.is20Hours ? "Yes" : "No",
      d.rightToWorkExpiry,
      d.rightToWorkDaysLeft,
      d.passportExpiry,
      d.passportDaysLeft,
      d.brpExpiry,
      d.brpDaysLeft,
      d.otherDocumentType,
      d.otherDocumentExpiry,
      d.otherDocumentDaysLeft,
    ]
      .map(cell)
      .join(","),
  )
  return [header.join(","), ...rows].join("\r\n")
}
