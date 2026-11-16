// The automatic leave year job (like CarerHR's nightly rollover). Run every
// night by Vercel Cron (app/api/cron/leave-year), or by an admin from Settings:
//
// 1. If today falls in a leave year that hasn't been started yet (the active
//    one has ended), start it: the same as clicking "New period". Unused days
//    don't carry over.
// 2. Bring every balance in line with the approved leave on record and each
//    person's allowance (what "Check balances → Correct" does). Anyone with an
//    implausible amount of leave used is left alone and listed for a person
//    to review.
//
// Safe to run any number of times: a second run the same day changes nothing.

import { supabase } from "./db"
import { hasServiceRoleKey, supabaseAdmin } from "./supabase-admin"
import { applyBalanceCheck } from "./balance-server"
import { fetchLeavePeriods } from "./leave-server"
import { buildLeaveYears, type LeaveYear, type StoredPeriod } from "./leave-years"
import { isMissingSchema } from "./column-probe"

const iso = (t: number) => new Date(t).toISOString().slice(0, 10)

/**
 * The leave year to start today, or null when the year containing today is
 * already set up. The new year follows the same start day and month as the
 * stored ones (1 April unless set otherwise).
 */
export function yearToStart(periods: StoredPeriod[], today: number): LeaveYear | null {
  const current = buildLeaveYears(periods, [], today).find((y) => y.isCurrent)
  if (!current || current.stored) return null
  return current
}

export type JobResult = {
  ok: boolean
  leaveYear: string | null
  newYearStarted: boolean
  balancesChanged: number
  /** People left alone because their records look wrong */
  skipped: string[]
  message: string
}

export async function runLeaveYearJob(trigger: "nightly" | "manual", today = Date.now()): Promise<JobResult> {
  let result: JobResult
  try {
    const periods = await fetchLeavePeriods()
    const toStart = yearToStart(periods, today)
    let year: LeaveYear | undefined
    if (toStart) {
      const { error } = await supabase.rpc("create_new_leave_period", {
        start_date: iso(toStart.start),
        end_date: iso(toStart.end),
      })
      if (error) throw error
      year = toStart
    }
    const applied = await applyBalanceCheck(year, { skipSuspicious: true })
    result = {
      ok: true,
      leaveYear: applied.year.label,
      newYearStarted: !!toStart,
      balancesChanged: applied.changed,
      skipped: applied.skipped,
      message: [
        toStart ? `Started the ${applied.year.label} leave year.` : null,
        applied.changed ? `Corrected ${applied.changed} balance${applied.changed === 1 ? "" : "s"}.` : "All balances were right.",
        applied.skipped.length
          ? `Left ${applied.skipped.length} for review (more leave used than looks possible): ${applied.skipped.slice(0, 5).join(", ")}${applied.skipped.length > 5 ? "…" : ""}.`
          : null,
      ]
        .filter(Boolean)
        .join(" "),
    }
  } catch (error) {
    console.error("Leave year job failed:", error)
    result = {
      ok: false,
      leaveYear: null,
      newYearStarted: false,
      balancesChanged: 0,
      skipped: [],
      message: "The automatic check couldn't finish. Nothing was half-done; it will try again tonight.",
    }
  }
  await recordRun(trigger, result)
  console.log(`Leave year job (${trigger}): ${result.message}`)
  return result
}

export type JobRun = {
  ranAt: string
  trigger: "nightly" | "manual"
  leaveYear: string | null
  newYearStarted: boolean
  balancesChanged: number
  skipped: number
  ok: boolean
  message: string | null
}

/** Keeps a record of the run for Settings. Never fails the job. */
async function recordRun(trigger: "nightly" | "manual", r: JobResult) {
  if (!hasServiceRoleKey) return
  const { error } = await supabaseAdmin.from("leave_job_runs" as never).insert({
    trigger,
    leave_year: r.leaveYear,
    new_year_started: r.newYearStarted,
    balances_changed: r.balancesChanged,
    skipped: r.skipped.length,
    ok: r.ok,
    message: r.message,
  } as never)
  if (error && !isMissingSchema(error)) console.error("Couldn't record the leave year job run:", error)
}

/** The latest runs, newest first ([] before the database update is run) */
export async function recentRuns(limit = 5): Promise<{ runs: JobRun[]; recording: boolean }> {
  if (!hasServiceRoleKey) return { runs: [], recording: false }
  const { data, error } = await supabaseAdmin
    .from("leave_job_runs" as never)
    .select("*")
    .order("ran_at", { ascending: false })
    .limit(limit)
  if (error) {
    if (!isMissingSchema(error)) console.error("Couldn't read the leave year job runs:", error)
    return { runs: [], recording: false }
  }
  const rows = (data ?? []) as Record<string, unknown>[]
  return {
    recording: true,
    runs: rows.map((r) => ({
      ranAt: String(r.ran_at),
      trigger: r.trigger === "manual" ? "manual" : "nightly",
      leaveYear: (r.leave_year as string | null) ?? null,
      newYearStarted: !!r.new_year_started,
      balancesChanged: Number(r.balances_changed) || 0,
      skipped: Number(r.skipped) || 0,
      ok: !!r.ok,
      message: (r.message as string | null) ?? null,
    })),
  }
}
