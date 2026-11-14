// Server-side leave helpers shared by the leave request routes. Server code only.

import { supabase } from "./supabase"
import type { StoredPeriod } from "./leave-years"
import { crossesLeaveYearEnd } from "./leave-years"
import { toUkDate } from "./dates"

/** The organisation's leave years from Settings → Leave periods */
export async function fetchLeavePeriods(): Promise<StoredPeriod[]> {
  const { data, error } = await supabase.from("leave_periods").select("start_date, end_date, is_active")
  if (error) {
    console.error("Couldn't read leave periods, assuming 1 April leave years:", error)
    return []
  }
  return (data || []).map((p) => ({ startDate: p.start_date, endDate: p.end_date, isActive: !!p.is_active }))
}

/** A plain-English refusal if the dates cross the end of a leave year, else null */
export async function leaveYearBoundaryError(start: number, end: number): Promise<string | null> {
  const year = crossesLeaveYearEnd(await fetchLeavePeriods(), start, end)
  if (!year) return null
  return `Leave can't cross the end of the leave year (${toUkDate(year.end)}). Add it as two entries: one up to ${toUkDate(year.end)} and one from the next day.`
}

/** True when a write failed because an optional column isn't in the database yet */
export function isMissingColumn(error: unknown): boolean {
  const e = error as { code?: string; message?: string } | null
  return (
    !!e &&
    (e.code === "42703" ||
      e.code === "PGRST204" ||
      /column .* does not exist|Could not find the .* column/i.test(e.message || ""))
  )
}
