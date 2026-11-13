// Date helpers. The database stores dates as DD/MM/YYYY text, and "today"
// means today in the UK, whatever time zone the server runs in.
//
// Dates are handled as ISO "YYYY-MM-DD" strings or as UTC-midnight timestamps
// so that daylight-saving changes never shift a day.

export const DAY_MS = 24 * 60 * 60 * 1000

// Parses DD/MM/YYYY (also with - or .) or YYYY-MM-DD.
// Returns a UTC-midnight timestamp, or null if it is not a real date.
export function parseDateToUtc(value: unknown): number | null {
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

// Today's date in the UK, as a UTC-midnight timestamp
export function todayUtc(): number {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Europe/London",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date())
  const get = (type: string) => Number(parts.find((p) => p.type === type)?.value)
  return Date.UTC(get("year"), get("month") - 1, get("day"))
}

export function toIsoDate(time: number): string {
  return new Date(time).toISOString().slice(0, 10)
}

// DD/MM/YYYY, the format the database uses
export function toUkDate(time: number): string {
  const d = new Date(time)
  const dd = String(d.getUTCDate()).padStart(2, "0")
  const mm = String(d.getUTCMonth() + 1).padStart(2, "0")
  return `${dd}/${mm}/${d.getUTCFullYear()}`
}

export function addDays(time: number, days: number): number {
  return time + days * DAY_MS
}

// Monday of the week containing `time`
export function startOfWeek(time: number): number {
  const weekday = new Date(time).getUTCDay() // 0 = Sunday
  const sinceMonday = (weekday + 6) % 7
  return addDays(time, -sinceMonday)
}

// Number of calendar days from start to end, counting both (weekends included,
// matching how the app has always counted leave)
export function inclusiveDays(start: number, end: number): number {
  return Math.round((end - start) / DAY_MS) + 1
}

// A local Date (e.g. from a date picker) as a UTC-midnight timestamp of the same calendar day
export function localDateToUtc(date: Date): number {
  return Date.UTC(date.getFullYear(), date.getMonth(), date.getDate())
}

// A UTC-midnight timestamp as a local Date at midnight (for date pickers)
export function utcToLocalDate(time: number): Date {
  const d = new Date(time)
  return new Date(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate())
}

// All dates on screen are DD/MM/YYYY (e.g. 12/09/2026).

const WEEKDAYS_SHORT = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"]
const WEEKDAYS_LONG = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"]

// "12/09/2026" (or "Sat 12/09/2026" with a weekday), from DD/MM/YYYY or
// YYYY-MM-DD; returns the input if it can't be parsed
export function formatDisplayDate(value: string, options: { weekday?: boolean | "long" } = {}): string {
  const time = parseDateToUtc(value)
  if (time === null) return value
  if (!options.weekday) return toUkDate(time)
  const day = new Date(time).getUTCDay()
  return `${options.weekday === "long" ? WEEKDAYS_LONG[day] : WEEKDAYS_SHORT[day]} ${toUkDate(time)}`
}

// "10/11/2026 – 14/11/2026", or a single date when both ends are the same day
export function formatDisplayRange(start: string, end: string): string {
  const s = parseDateToUtc(start)
  const e = parseDateToUtc(end)
  if (s === null || e === null) return `${start} – ${end}`
  if (s === e) return toUkDate(s)
  return `${toUkDate(s)} – ${toUkDate(e)}`
}

// DD/MM/YYYY for a Date or a timestamp string (e.g. a created_at), in local time
export function formatLocalDate(value: Date | string | null | undefined): string {
  if (!value) return "—"
  const d = value instanceof Date ? value : new Date(value)
  if (Number.isNaN(d.getTime())) return typeof value === "string" ? value : "—"
  return `${String(d.getDate()).padStart(2, "0")}/${String(d.getMonth() + 1).padStart(2, "0")}/${d.getFullYear()}`
}
