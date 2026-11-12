// Document expiry helpers.
//
// The `*_days_left` columns in the documents table are written once, when a
// record is saved, so they go stale the next day. Everything that reads
// documents should derive days-left from the expiry date instead.

import { DAY_MS, parseDateToUtc, todayUtc } from "./dates"

export const DOCUMENT_FIELDS = [
  ["passport_expiry", "passport_days_left"],
  ["right_to_work_expiry", "right_to_work_days_left"],
  ["brp_expiry", "brp_days_left"],
  ["other_document_expiry", "other_document_days_left"],
] as const

const DAYS_LEFT_COLUMNS = DOCUMENT_FIELDS.map(([, daysLeft]) => daysLeft)

export const parseExpiryDate = parseDateToUtc

// Days from today until the expiry date (0 = expires today, negative = expired)
export function daysLeftFromExpiry(value: unknown): number | null {
  const expiry = parseExpiryDate(value)
  if (expiry === null) return null
  return Math.round((expiry - todayUtc()) / DAY_MS)
}

// Returns a copy of a documents row with every *_days_left recalculated from
// its expiry date. If an expiry date can't be parsed, the stored value is kept.
export function withLiveDaysLeft<T extends Record<string, any>>(row: T): T {
  const result: Record<string, any> = { ...row }
  for (const [expiryColumn, daysLeftColumn] of DOCUMENT_FIELDS) {
    const expiry = row[expiryColumn]
    if (!expiry) {
      result[daysLeftColumn] = null
      continue
    }
    const live = daysLeftFromExpiry(expiry)
    result[daysLeftColumn] = live !== null ? live : (row[daysLeftColumn] ?? null)
  }
  return result as T
}

// Same buckets the document tracker tabs use. A record is "expired" if any of
// its documents is expired, and "valid" only if none expires within 90 days.
export function matchesDocumentStatus(row: Record<string, any>, status: string): boolean {
  const days = DAYS_LEFT_COLUMNS.map((column) => row[column]).filter(
    (value): value is number => typeof value === "number",
  )
  switch (status) {
    case "expired":
      return days.some((d) => d <= 0)
    case "expiring7":
      return days.some((d) => d > 0 && d <= 7)
    case "expiring30":
      return days.some((d) => d > 7 && d <= 30)
    case "expiring90":
      return days.some((d) => d > 30 && d <= 90)
    case "valid":
      return days.every((d) => d > 90)
    default:
      return true
  }
}
