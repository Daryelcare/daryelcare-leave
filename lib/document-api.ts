// Server-side helpers shared by the documents API routes. Server code only.

import type { DocumentRow } from "./database.types"
import type { EmployeeDocument } from "./types"
import { daysLeftFromExpiry, parseExpiryDate, withLiveDaysLeft } from "./document-status"
import { toUkDate } from "./dates"
import { isRtwBasis, rtwNextCheck, rtwProblem, type RtwBasis } from "./rtw"
import { supabase } from "./supabase"

/** A documents row as the browser sees it, with days left worked out from today */
export function toEmployeeDocument(stored: DocumentRow): EmployeeDocument {
  const doc = withLiveDaysLeft(stored)
  return {
    id: doc.id,
    employeeId: doc.employee_id,
    employeeName: doc.employee_name,
    branch: doc.branch,
    status: doc.status,
    country: doc.country,
    passportExpiry: doc.passport_expiry || null,
    passportDaysLeft: doc.passport_days_left ?? null,
    rightToWorkExpiry: doc.right_to_work_expiry || null,
    rightToWorkDaysLeft: doc.right_to_work_days_left ?? null,
    brpExpiry: doc.brp_expiry || null,
    brpDaysLeft: doc.brp_days_left ?? null,
    otherDocumentType: doc.other_document_type || null,
    otherDocumentExpiry: doc.other_document_expiry || null,
    otherDocumentDaysLeft: doc.other_document_days_left ?? null,
    isSponsored: doc.is_sponsored || false,
    is20Hours: doc.is_20_hours || false,
    rtwBasis: isRtwBasis(doc.rtw_basis) ? doc.rtw_basis : null,
    rtwCheckedOn: doc.rtw_checked_on || null,
  }
}

// ---------------------------------------------------------------- right to work basis

/** True when the error is "that column doesn't exist" (the migration hasn't been run) */
export const isMissingColumn = (error: unknown) => {
  const e = error as { code?: string; message?: string } | null
  return !!e && (e.code === "42703" || e.code === "PGRST204" || /rtw_(basis|checked_on)/.test(e.message || ""))
}

// Whether the rtw_basis / rtw_checked_on columns exist yet. Once they do, that
// is remembered; while they don't, it's checked again after a minute.
let rtwKnown: { ok: boolean; at: number } | null = null
export async function rtwColumnsExist(): Promise<boolean> {
  if (rtwKnown && (rtwKnown.ok || Date.now() - rtwKnown.at < 60_000)) return rtwKnown.ok
  const { error } = await supabase.from("documents").select("rtw_basis, rtw_checked_on").limit(1)
  const ok = !error
  if (error && !isMissingColumn(error)) console.error("Couldn't check for the right to work columns:", error)
  rtwKnown = { ok, at: Date.now() }
  return ok
}

/** Forget what's known about the columns (tests, or right after running the update) */
export const forgetRtwColumns = () => {
  rtwKnown = null
}

export const RTW_SETUP_MESSAGE =
  "Recording how right to work is held needs a one-off database update. Ask your administrator to run it, then try again."

/**
 * Columns to write for a right-to-work basis sent by the browser
 * (rtwBasis, rtwCheckedOn, and rightToWorkExpiry for a time-limited end date).
 * The right-to-work expiry the tracker counts down to is worked out here:
 * none for one-off checks, 6 months after the check for a pending
 * application, the end date for time-limited permission.
 */
export function rtwColumns(data: {
  rtwBasis?: unknown
  rtwCheckedOn?: unknown
  rightToWorkExpiry?: unknown
}): { columns: Record<string, string | number | null> } | { error: string } | null {
  if (data.rtwBasis === undefined && data.rtwCheckedOn === undefined) return null
  const basis: RtwBasis | null = data.rtwBasis === null || data.rtwBasis === "" ? null : isRtwBasis(data.rtwBasis) ? data.rtwBasis : null
  if (data.rtwBasis && !basis) return { error: "Choose how their right to work is held" }

  let checkedOn: string | null = null
  if (data.rtwCheckedOn) {
    const time = typeof data.rtwCheckedOn === "string" ? parseExpiryDate(data.rtwCheckedOn) : null
    if (time === null) return { error: "The check date must be a real date in dd/mm/yyyy" }
    checkedOn = toUkDate(time)
  }
  let entered: string | null = null
  if (data.rightToWorkExpiry) {
    const time = typeof data.rightToWorkExpiry === "string" ? parseExpiryDate(data.rightToWorkExpiry) : null
    if (time === null) return { error: "Expiry dates must be real dates in dd/mm/yyyy" }
    entered = toUkDate(time)
  }
  const problem = rtwProblem(basis, checkedOn, entered)
  if (problem) return { error: problem }

  const next = rtwNextCheck(basis, checkedOn, entered)
  return {
    columns: {
      rtw_basis: basis,
      rtw_checked_on: checkedOn,
      right_to_work_expiry: next,
      right_to_work_days_left: next ? daysLeftFromExpiry(next) : null,
    },
  }
}

/** The four expiry fields: request key → [expiry column, days-left column] */
export const EXPIRY_FIELDS = {
  passportExpiry: ["passport_expiry", "passport_days_left"],
  rightToWorkExpiry: ["right_to_work_expiry", "right_to_work_days_left"],
  brpExpiry: ["brp_expiry", "brp_days_left"],
  otherDocumentExpiry: ["other_document_expiry", "other_document_days_left"],
} as const

/**
 * The columns for one expiry date sent by the browser: null clears it, a
 * DD/MM/YYYY date sets it (days left worked out here, not trusted from the
 * browser). Returns an error message for a date that isn't real.
 */
export function expiryColumns(
  key: keyof typeof EXPIRY_FIELDS,
  value: unknown,
): { columns: Record<string, string | number | null> } | { error: string } {
  const [expiryColumn, daysColumn] = EXPIRY_FIELDS[key]
  if (value === null || value === "") return { columns: { [expiryColumn]: null, [daysColumn]: null } }
  const time = typeof value === "string" ? parseExpiryDate(value) : null
  if (time === null) return { error: "Expiry dates must be real dates in dd/mm/yyyy" }
  // Always stored as DD/MM/YYYY
  const stored = toUkDate(time)
  return { columns: { [expiryColumn]: stored, [daysColumn]: daysLeftFromExpiry(stored) } }
}

/** Search text that is safe inside a PostgREST or() filter */
export const safeSearch = (value: string) => value.replace(/[,()%*\\]/g, " ").trim()
