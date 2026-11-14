// Server-side helpers shared by the documents API routes. Server code only.

import type { DocumentRow } from "./database.types"
import type { EmployeeDocument } from "./types"
import { daysLeftFromExpiry, parseExpiryDate, withLiveDaysLeft } from "./document-status"
import { toUkDate } from "./dates"

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
