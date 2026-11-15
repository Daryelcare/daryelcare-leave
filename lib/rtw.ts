// How someone's right to work is held, and when it must be checked again.
// Pure functions shared by the API and the screens, so the rules are easy to
// test. Dates are DD/MM/YYYY text, like every other date in the documents table.
//
// - British or Irish citizen: one check is enough, never again.
// - Permanent permission (indefinite leave to remain, EU settled status): one
//   check is enough.
// - Time-limited permission (visa, pre-settled status, eVisa/BRP with an end
//   date): check again by the date their permission ends (entered by hand).
// - Pending application (a positive Employer Checking Service result): check
//   again 6 months after the check.

import { parseDateToUtc, toUkDate } from "./dates"

export type RtwBasis = "british_irish" | "indefinite" | "time_limited" | "pending_application"

export const RTW_BASES: { id: RtwBasis; label: string; hint: string; oneOff: boolean }[] = [
  { id: "british_irish", label: "British or Irish citizen", hint: "One check is enough", oneOff: true },
  {
    id: "indefinite",
    label: "Permanent permission",
    hint: "Indefinite leave to remain or EU settled status · one check is enough",
    oneOff: true,
  },
  {
    id: "time_limited",
    label: "Time-limited permission",
    hint: "Visa, pre-settled status or eVisa with an end date · check again by that date",
    oneOff: false,
  },
  {
    id: "pending_application",
    label: "Pending application",
    hint: "Employer Checking Service result · check again 6 months after the check",
    oneOff: false,
  },
]

export const PENDING_RECHECK_MONTHS = 6

export const isRtwBasis = (v: unknown): v is RtwBasis => RTW_BASES.some((b) => b.id === v)
export const rtwBasisLabel = (b: RtwBasis | null | undefined) => RTW_BASES.find((x) => x.id === b)?.label ?? null
export const isOneOff = (b: RtwBasis | null | undefined) => !!RTW_BASES.find((x) => x.id === b)?.oneOff

/** dd/mm/yyyy plus whole months; the 31st becomes the month's last day (31/08 + 6 → 28 or 29/02) */
export function addMonthsUk(date: string, months: number): string | null {
  const t = parseDateToUtc(date)
  if (t === null) return null
  const d = new Date(t)
  const day = d.getUTCDate()
  const target = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + months, 1))
  const lastDay = new Date(Date.UTC(target.getUTCFullYear(), target.getUTCMonth() + 1, 0)).getUTCDate()
  target.setUTCDate(Math.min(day, lastDay))
  return toUkDate(target.getTime())
}

/**
 * The right-to-work date the tracker counts down to, for a basis:
 * - one-off bases: none (nothing to check again)
 * - pending application: 6 months after the check (null until there's a check date)
 * - time-limited: the end date entered
 * - no basis recorded: the date entered, as before
 */
export function rtwNextCheck(basis: RtwBasis | null | undefined, checkedOn: string | null, entered: string | null) {
  if (isOneOff(basis)) return null
  if (basis === "pending_application") return checkedOn ? addMonthsUk(checkedOn, PENDING_RECHECK_MONTHS) : null
  return entered || null
}

/** What's wrong with a basis + dates before saving, in plain words, or null */
export function rtwProblem(basis: RtwBasis | null | undefined, checkedOn: string | null, entered: string | null) {
  if (basis === "pending_application" && !checkedOn) return "Enter the date of the Employer Checking Service check"
  if (basis === "time_limited" && !entered) return "Enter the date their permission ends"
  return null
}
