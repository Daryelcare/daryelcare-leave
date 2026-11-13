// Server-side helpers for reading leave, shared by the dashboard and the
// team calendar. Server code only.

import { supabase } from "./supabase"
import { parseDateToUtc, toIsoDate } from "./dates"
import type { LeaveRequestRow } from "./database.types"

export type LeaveEntry = {
  id: string
  employeeId: string
  employeeName: string
  branch: string
  type: string
  startDate: string // DD/MM/YYYY, as stored
  endDate: string
  start: string // YYYY-MM-DD, for sorting and calendars
  end: string
  duration: number
  reason: string | null
  status: string
}

const PAGE_SIZE = 1000 // Supabase returns at most 1000 rows per request

// Read every leave request (optionally only some branches), page by page.
// Dates are stored as text, so the database can't filter them by date range:
// we read them all and filter here.
async function fetchAllLeaveRows(
  branches: string[] | null,
  statuses: string[] = ["Approved"],
): Promise<LeaveRequestRow[]> {
  if (branches && branches.length === 0) return []

  const rows: LeaveRequestRow[] = []
  for (let from = 0; ; from += PAGE_SIZE) {
    let query = supabase.from("leave_requests").select("*").in("status", statuses)
    if (branches) query = query.in("branch", branches)
    const { data, error } = await query.order("id").range(from, from + PAGE_SIZE - 1)
    if (error) throw error
    rows.push(...(data || []))
    if (!data || data.length < PAGE_SIZE) break
  }
  return rows
}

// Leave that overlaps the days from `from` to `to` (UTC-midnight timestamps,
// both included), sorted by start date then name. Approved only unless other
// statuses are asked for (the team calendar also shows Pending).
export async function getLeaveBetween(
  from: number,
  to: number,
  branches: string[] | null,
  statuses: string[] = ["Approved"],
): Promise<LeaveEntry[]> {
  const rows = await fetchAllLeaveRows(branches, statuses)
  const entries: LeaveEntry[] = []

  for (const row of rows) {
    const start = parseDateToUtc(row.start_date)
    const end = parseDateToUtc(row.end_date) ?? start
    if (start === null || end === null) continue
    if (start > to || end < from) continue

    entries.push({
      id: row.id,
      employeeId: row.employee_id,
      employeeName: row.employee_name,
      branch: row.branch,
      type: row.type,
      startDate: row.start_date,
      endDate: row.end_date,
      start: toIsoDate(start),
      end: toIsoDate(Math.max(start, end)),
      duration: row.duration,
      reason: row.reason,
      status: row.status,
    })
  }

  return entries.sort((a, b) => a.start.localeCompare(b.start) || a.employeeName.localeCompare(b.employeeName))
}

// Pick the branches to show: what the user asked for, limited to what they may see.
// Returns null for "all branches".
export function resolveBranchFilter(requested: string | null, allowed: string[] | null): string[] | null {
  if (requested && requested !== "all") {
    if (allowed === null || allowed.includes(requested)) return [requested]
    return []
  }
  return allowed
}
