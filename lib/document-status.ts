// Document expiry helpers.
//
// The `*_days_left` columns in the documents table are written once, when a
// record is saved, so they go stale the next day. Everything that reads
// documents should derive days-left from the expiry date instead.

const DAY_MS = 24 * 60 * 60 * 1000

const DOCUMENT_FIELDS = [
  ["passport_expiry", "passport_days_left"],
  ["right_to_work_expiry", "right_to_work_days_left"],
  ["brp_expiry", "brp_days_left"],
  ["other_document_expiry", "other_document_days_left"],
] as const

const DAYS_LEFT_COLUMNS = DOCUMENT_FIELDS.map(([, daysLeft]) => daysLeft)

// Today's date in UK time, as a UTC-midnight timestamp
function todayUtc(): number {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Europe/London",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date())
  const get = (type: string) => Number(parts.find((p) => p.type === type)?.value)
  return Date.UTC(get("year"), get("month") - 1, get("day"))
}

// Parses DD/MM/YYYY (the format the app stores) or YYYY-MM-DD.
// Returns a UTC-midnight timestamp, or null if the value is not a real date.
export function parseExpiryDate(value: unknown): number | null {
  if (typeof value !== "string") return null
  const text = value.trim()

  let day: number, month: number, year: number
  let match = text.match(/^(\d{1,2})[/.-](\d{1,2})[/.-](\d{4})$/)
  if (match) {
    day = Number(match[1])
    month = Number(match[2])
    year = Number(match[3])
  } else if ((match = text.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/))) {
    year = Number(match[1])
    month = Number(match[2])
    day = Number(match[3])
  } else {
    return null
  }

  const time = Date.UTC(year, month - 1, day)
  const date = new Date(time)
  // Reject things like 31/02/2026 that roll over into another month
  if (date.getUTCFullYear() !== year || date.getUTCMonth() !== month - 1 || date.getUTCDate() !== day) {
    return null
  }
  return time
}

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
