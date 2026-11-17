// Importing documents (mainly right-to-work checks) from a spreadsheet.
// Shared by the preview and the import, so what the preview shows is exactly
// what the import does. Server only.
//
// Rules:
// - People are matched by Employee Code only (names can repeat; codes can't).
// - Only the columns in the file are touched. A blank cell leaves that field
//   as it is, with one exception: right to work. If the file has the right to
//   work columns and all three are blank for someone, their right to work is
//   cleared, so they show as needing a check (the whole list is being redone).
// - Check Type decides which dates are needed (lib/rtw.ts):
//   British or Irish citizen / Permanent permission: Date Checked, never due again;
//   Time-limited permission: Date Checked and Right to Work Expiry, due on that date;
//   Pending application: Date Checked, due again 6 months later.

import * as XLSX from "xlsx"
import { supabase } from "./db"
import { allowedBranches, type RequestUser } from "./server-auth"
import { parseDateToUtc, toUkDate } from "./dates"
import { daysLeftFromExpiry } from "./document-status"
import { RTW_BASES, isOneOff, rtwBasisLabel, rtwNextCheck, type RtwBasis } from "./rtw"
import { RTW_SETUP_MESSAGE, rtwColumnsExist } from "./document-api"
import type { DocumentRow } from "./database.types"

// ---------------------------------------------------------------- columns

export type ImportField =
  | "code"
  | "name"
  | "branch"
  | "checkType"
  | "dateChecked"
  | "rtwExpiry"
  | "status"
  | "country"
  | "passportExpiry"
  | "brpExpiry"
  | "otherType"
  | "otherExpiry"
  | "sponsored"
  | "twentyHours"
  | "notes"

/** Column headings we recognise (any case, extra spaces ignored), first one is the template's */
export const COLUMN_NAMES: Record<ImportField, string[]> = {
  name: ["Employee Name", "Name", "Full Name"],
  code: ["Employee Code", "Code"],
  branch: ["Branch"],
  checkType: ["Check Type", "Right to Work Type", "RTW Type", "Right to Work Check Type"],
  dateChecked: ["Date Checked", "Check Date", "Checked On", "Right to Work Checked"],
  rtwExpiry: ["Right to Work Expiry", "RTW Expiry", "Right to Work Expiry Date"],
  status: ["Status"],
  country: ["Country"],
  passportExpiry: ["Passport Expiry"],
  brpExpiry: ["BRP Expiry"],
  otherType: ["Other Document Type"],
  otherExpiry: ["Other Document Expiry"],
  sponsored: ["is_sponsored", "Sponsored", "Is Sponsored"],
  twentyHours: ["is_20_hrs", "20 Hours", "Is 20 Hrs", "20 Hrs"],
  notes: ["Notes"],
}

/** The template's columns, in order */
export const TEMPLATE_COLUMNS: ImportField[] = [
  "name",
  "code",
  "branch",
  "checkType",
  "dateChecked",
  "rtwExpiry",
  "status",
  "country",
  "notes",
  "sponsored",
  "twentyHours",
]

const norm = (s: unknown) =>
  String(s ?? "")
    .toLowerCase()
    .replace(/[_\s]+/g, " ")
    .trim()

const HEADER_LOOKUP = new Map<string, ImportField>(
  (Object.entries(COLUMN_NAMES) as [ImportField, string[]][]).flatMap(([field, names]) =>
    names.map((n) => [norm(n), field] as const),
  ),
)

// ---------------------------------------------------------------- check types

export const CHECK_TYPE_LABELS: Record<RtwBasis, string> = {
  british_irish: "British or Irish citizen",
  indefinite: "Permanent permission",
  time_limited: "Time-limited permission",
  pending_application: "Pending application",
}

const CHECK_TYPE_ALIASES: Record<string, RtwBasis> = Object.fromEntries(
  (
    [
      [
        "british_irish",
        ["british or irish citizen", "british or irish", "british/irish", "british", "irish", "british irish"],
      ],
      [
        "indefinite",
        [
          "permanent permission",
          "permanent",
          "indefinite",
          "ilr",
          "indefinite leave to remain",
          "settled",
          "settled status",
          "eu settled status",
        ],
      ],
      [
        "time_limited",
        [
          "time-limited permission",
          "time limited permission",
          "time-limited",
          "time limited",
          "visa",
          "pre-settled status",
        ],
      ],
      ["pending_application", ["pending application", "pending", "ecs", "employer checking service"]],
    ] as [RtwBasis, string[]][]
  ).flatMap(([basis, names]) => [[basis.replace(/_/g, " "), basis], ...names.map((n) => [n, basis])]),
)

export function parseCheckType(value: unknown): RtwBasis | null | "invalid" {
  const v = norm(value)
  if (!v) return null
  return CHECK_TYPE_ALIASES[v] ?? CHECK_TYPE_ALIASES[v.replace(/-/g, " ")] ?? "invalid"
}

// ---------------------------------------------------------------- cells

/**
 * A date cell: Excel date (serial number), dd/mm/yyyy (or d/m/yyyy, dd-mm-yyyy)
 * or yyyy-mm-dd. Never read as US month/day. "N/A" means none.
 */
export function parseDateCell(value: unknown): { date: string | null } | { error: true } {
  if (value === null || value === undefined) return { date: null }
  if (typeof value === "number") {
    const p = XLSX.SSF.parse_date_code(value)
    if (!p || !p.y) return { error: true }
    return { date: toUkDate(Date.UTC(p.y, p.m - 1, p.d)) }
  }
  const text = String(value).trim()
  if (!text || /^n\/?a$/i.test(text)) return { date: null }
  const time = parseDateToUtc(text)
  return time === null ? { error: true } : { date: toUkDate(time) }
}

const cellText = (value: unknown) => (value === null || value === undefined ? "" : String(value).trim())

function parseYesNo(value: unknown): boolean | null | "invalid" {
  const v = norm(value)
  if (!v) return null
  if (["yes", "y", "true", "1"].includes(v)) return true
  if (["no", "n", "false", "0"].includes(v)) return false
  return "invalid"
}

const STATUSES: Record<string, string> = {
  british: "BRITISH",
  eu: "EU",
  "non-eu": "NON-EU",
  "non eu": "NON-EU",
  noneu: "NON-EU",
}

// ---------------------------------------------------------------- reading the file

export type SheetRow = { row: number; cells: Partial<Record<ImportField, unknown>> }

/** Reads the first sheet. Dates stay as Excel serial numbers or text, never guessed. */
export function readSheet(buffer: ArrayBuffer, fileName: string): { rows: SheetRow[]; fields: Set<ImportField> } {
  const isCsv = fileName.toLowerCase().endsWith(".csv")
  const workbook = isCsv
    ? XLSX.read(new TextDecoder().decode(buffer).replace(/^﻿/, ""), { type: "string", raw: true })
    : XLSX.read(buffer, { type: "array" })
  const sheet = workbook.Sheets[workbook.SheetNames[0]]
  if (!sheet) return { rows: [], fields: new Set() }
  const grid = XLSX.utils.sheet_to_json<unknown[]>(sheet, { header: 1, raw: true, defval: null, blankrows: true })
  const header = (grid[0] ?? []).map((h) => HEADER_LOOKUP.get(norm(h)) ?? null)
  const fields = new Set(header.filter((f): f is ImportField => !!f))
  const rows: SheetRow[] = []
  grid.slice(1).forEach((line, i) => {
    const cells: Partial<Record<ImportField, unknown>> = {}
    header.forEach((field, col) => {
      if (field && cells[field] === undefined) cells[field] = line?.[col] ?? null
    })
    // Completely empty lines are ignored
    if (Object.values(cells).every((v) => cellText(v) === "")) return
    rows.push({ row: i + 2, cells })
  })
  return { rows, fields }
}

// ---------------------------------------------------------------- planning

type RtwSnapshot = { basis: RtwBasis | null; checkedOn: string | null; expiry: string | null }

export type RowPlan = {
  row: number
  code: string
  /** The employee's name in the app (or the file's, when there's no match) */
  name: string
  branch: string | null
  employeeId: string | null
  documentId: string | null
  /** update: change an existing record; create: new record; clear: right to work cleared; skip: nothing to do; error: can't import */
  action: "update" | "create" | "clear" | "skip" | "error"
  problems: string[]
  notes: string[]
  rtwBefore: RtwSnapshot | null
  /** undefined: right to work not changed */
  rtwAfter?: RtwSnapshot | null
  /** Other fields that change, as "Status: NON-EU" */
  otherChanges: string[]
}

type InternalPlan = RowPlan & { columns: Record<string, unknown> }

export type ImportPlan = {
  rows: InternalPlan[]
  fields: ImportField[]
  counts: { update: number; create: number; clear: number; skip: number; error: number }
  /** File has no Employee Code column */
  missingCodeColumn: boolean
}

const RTW_FIELDS: ImportField[] = ["checkType", "dateChecked", "rtwExpiry"]

/** Works out what importing these rows would do. Reads, never writes. */
export async function planImport(
  sheet: { rows: SheetRow[]; fields: Set<ImportField> },
  user: RequestUser,
): Promise<ImportPlan> {
  const { rows, fields } = sheet
  const scope = allowedBranches(user)
  const { data: employees, error } = await supabase.from("employees").select("id, name, employee_code, branch")
  if (error) throw error
  const byCode = new Map<string, { id: string; name: string; branch: string }>()
  for (const e of employees ?? []) {
    const code = cellText(e.employee_code)
    if (code && (scope === null || scope.includes(e.branch))) byCode.set(code.toLowerCase(), e)
  }

  const ids = [
    ...new Set(rows.map((r) => byCode.get(cellText(r.cells.code).toLowerCase())?.id).filter(Boolean)),
  ] as string[]
  const docs = new Map<string, DocumentRow>()
  for (let i = 0; i < ids.length; i += 200) {
    const { data, error: docError } = await supabase
      .from("documents")
      .select("*")
      .in("employee_id", ids.slice(i, i + 200))
    if (docError) throw docError
    for (const d of (data ?? []) as DocumentRow[]) if (!docs.has(d.employee_id)) docs.set(d.employee_id, d)
  }
  const rtwTracking = await rtwColumnsExist()
  const hasRtwColumns = RTW_FIELDS.some((f) => fields.has(f))
  const seen = new Map<string, number>()

  const plans = rows.map((r): InternalPlan => {
    const c = r.cells
    const code = cellText(c.code)
    const fileName = cellText(c.name)
    const plan: InternalPlan = {
      row: r.row,
      code,
      name: fileName,
      branch: cellText(c.branch) || null,
      employeeId: null,
      documentId: null,
      action: "update",
      problems: [],
      notes: [],
      rtwBefore: null,
      otherChanges: [],
      columns: {},
    }
    if (!code) {
      plan.problems.push("Add the Employee Code: people are matched by their code")
      plan.action = "error"
      return plan
    }
    const first = seen.get(code.toLowerCase())
    if (first) plan.problems.push(`Code ${code} is also on row ${first}; each person should appear once`)
    else seen.set(code.toLowerCase(), r.row)
    const employee = byCode.get(code.toLowerCase())
    if (!employee) {
      plan.problems.push(
        `No employee with code ${code}${fileName ? ` (${fileName})` : ""}${scope === null ? "" : " in your branches"}`,
      )
      plan.action = "error"
      return plan
    }
    plan.employeeId = employee.id
    plan.name = employee.name
    plan.branch = employee.branch
    if (fileName && norm(fileName) !== norm(employee.name)) plan.notes.push(`Name in the file: ${fileName}`)
    const doc = docs.get(employee.id) ?? null
    plan.documentId = doc?.id ?? null
    const before: RtwSnapshot | null = doc
      ? {
          basis: (doc.rtw_basis as RtwBasis | null) ?? null,
          checkedOn: doc.rtw_checked_on ?? null,
          expiry: doc.right_to_work_expiry,
        }
      : null
    plan.rtwBefore = before
    const cols = plan.columns

    // Right to work
    if (hasRtwColumns) {
      const typeRaw = cellText(c.checkType)
      const type = parseCheckType(c.checkType)
      const checked = parseDateCell(c.dateChecked)
      const expiry = parseDateCell(c.rtwExpiry)
      if (type === "invalid")
        plan.problems.push(
          `Check Type "${typeRaw}" isn't one of: ${RTW_BASES.map((b) => CHECK_TYPE_LABELS[b.id]).join(", ")}`,
        )
      if ("error" in checked)
        plan.problems.push(`Date Checked "${cellText(c.dateChecked)}" isn't a real date (use dd/mm/yyyy)`)
      if ("error" in expiry)
        plan.problems.push(`Right to Work Expiry "${cellText(c.rtwExpiry)}" isn't a real date (use dd/mm/yyyy)`)
      const checkedOn = "date" in checked ? checked.date : null
      const expiryOn = "date" in expiry ? expiry.date : null
      if (checkedOn && (daysLeftFromExpiry(checkedOn) ?? 0) > 0) plan.problems.push("Date Checked is in the future")

      if (type !== "invalid" && !("error" in checked) && !("error" in expiry)) {
        if (!type && !checkedOn && !expiryOn) {
          // Blank: not checked again yet, so clear what was there
          if (before && (before.basis || before.checkedOn || before.expiry)) {
            plan.rtwAfter = null
            if ((doc?.status || "").toUpperCase() !== "NON-EU")
              plan.notes.push(
                `Status is ${doc?.status || "not set"}, so the Documents page won't flag them as missing a check`,
              )
            Object.assign(cols, { right_to_work_expiry: null, right_to_work_days_left: null })
            if (rtwTracking) Object.assign(cols, { rtw_basis: null, rtw_checked_on: null })
          }
        } else if (!type) {
          if (checkedOn && !expiryOn) plan.problems.push("Choose a Check Type")
          else {
            // An expiry date with no type: counts down to that date, as before
            plan.notes.push("No Check Type: counts down to the expiry date")
            plan.rtwAfter = { basis: null, checkedOn, expiry: expiryOn }
            Object.assign(cols, {
              right_to_work_expiry: expiryOn,
              right_to_work_days_left: daysLeftFromExpiry(expiryOn),
            })
            if (rtwTracking) Object.assign(cols, { rtw_basis: null, rtw_checked_on: checkedOn })
          }
        } else {
          if (!rtwTracking) plan.problems.push(RTW_SETUP_MESSAGE)
          if (!checkedOn) plan.problems.push("Enter the Date Checked")
          if (type === "time_limited" && !expiryOn)
            plan.problems.push("Enter the Right to Work Expiry (when their permission ends)")
          if (expiryOn && isOneOff(type))
            plan.notes.push(`Right to Work Expiry not needed for ${CHECK_TYPE_LABELS[type]}, so it's ignored`)
          if (expiryOn && type === "pending_application")
            plan.notes.push("Right to Work Expiry ignored: the next check is 6 months after the check")
          const next = rtwNextCheck(type, checkedOn, expiryOn)
          plan.rtwAfter = { basis: type, checkedOn, expiry: next }
          Object.assign(cols, {
            rtw_basis: type,
            rtw_checked_on: checkedOn,
            right_to_work_expiry: next,
            right_to_work_days_left: next ? daysLeftFromExpiry(next) : null,
          })
        }
      }
    }

    // Same as what's saved already: nothing to change
    const a = plan.rtwAfter
    if (a && before && a.basis === before.basis && a.checkedOn === before.checkedOn && a.expiry === before.expiry) {
      plan.rtwAfter = undefined
      for (const k of ["rtw_basis", "rtw_checked_on", "right_to_work_expiry", "right_to_work_days_left"]) delete cols[k]
    }

    // Other columns: only when the cell has something in it
    const statusText = cellText(c.status)
    if (statusText) {
      const status = STATUSES[norm(statusText)]
      if (!status) plan.problems.push(`Status "${statusText}" should be BRITISH, EU or NON-EU`)
      else if (status !== doc?.status) {
        cols.status = status
        plan.otherChanges.push(`Status: ${status}`)
      }
    }
    const country = cellText(c.country)
    if (country && country !== doc?.country) {
      cols.country = country
      plan.otherChanges.push(`Country: ${country}`)
    }
    for (const [field, column, daysColumn, label] of [
      ["passportExpiry", "passport_expiry", "passport_days_left", "Passport expiry"],
      ["brpExpiry", "brp_expiry", "brp_days_left", "BRP expiry"],
      ["otherExpiry", "other_document_expiry", "other_document_days_left", "Other document expiry"],
    ] as const) {
      const raw = cellText(c[field])
      if (!raw) continue
      const parsed = parseDateCell(c[field])
      if ("error" in parsed) plan.problems.push(`${label} "${raw}" isn't a real date (use dd/mm/yyyy)`)
      else if (parsed.date !== (doc?.[column] ?? null)) {
        cols[column] = parsed.date
        cols[daysColumn] = parsed.date ? daysLeftFromExpiry(parsed.date) : null
        plan.otherChanges.push(`${label}: ${parsed.date ?? "none"}`)
      }
    }
    const otherType = cellText(c.otherType)
    if (otherType && otherType !== doc?.other_document_type) {
      cols.other_document_type = otherType
      plan.otherChanges.push(`Other document: ${otherType}`)
    }
    for (const [field, column, label] of [
      ["sponsored", "is_sponsored", "Sponsored"],
      ["twentyHours", "is_20_hours", "20 hours"],
    ] as const) {
      // Blank means no (when the column is in the file)
      const parsed = parseYesNo(c[field])
      const v = parsed === null && fields.has(field) ? false : parsed
      if (v === "invalid") plan.problems.push(`${label} should be yes or no`)
      else if (v !== null && !doc) cols[column] = v
      else if (v !== null && v !== (doc?.[column] ?? false)) {
        cols[column] = v
        plan.otherChanges.push(`${label}: ${v ? "yes" : "no"}`)
      }
    }

    if (plan.problems.length) {
      plan.action = "error"
      return plan
    }
    if (Object.keys(cols).length === 0) {
      plan.action = "skip"
      return plan
    }
    if (!doc) {
      plan.action = "create"
      // A new record needs a status: British/Irish citizens are BRITISH, anyone else NON-EU until told otherwise
      if (!cols.status) cols.status = cols.rtw_basis === "british_irish" ? "BRITISH" : "NON-EU"
    } else if (plan.rtwAfter === null && plan.otherChanges.length === 0) {
      plan.action = "clear"
    }
    Object.assign(cols, { employee_name: employee.name, branch: employee.branch })
    return plan
  })

  const counts = { update: 0, create: 0, clear: 0, skip: 0, error: 0 }
  for (const p of plans) counts[p.action]++
  return { rows: plans, fields: [...fields], counts, missingCodeColumn: !fields.has("code") }
}

/** What the browser sees: the plan without the database columns */
export const publicPlan = (plan: ImportPlan) => ({
  ...plan,
  rows: plan.rows.map(({ columns: _columns, ...row }) => row),
})

export const rtwSummary = (s: RtwSnapshot | null | undefined) =>
  !s ? null : { ...s, label: s.basis ? rtwBasisLabel(s.basis) : null }

/** Applies a plan: rows with problems or nothing to do are left alone */
export async function applyImport(plan: ImportPlan) {
  let updated = 0
  let created = 0
  let cleared = 0
  let failed = 0
  for (const p of plan.rows) {
    if (p.action === "error" || p.action === "skip") continue
    try {
      if (p.documentId) {
        const { error } = await supabase
          .from("documents")
          .update(p.columns as Partial<DocumentRow>)
          .eq("id", p.documentId)
        if (error) throw error
        if (p.action === "clear") cleared++
        else updated++
      } else {
        const { error } = await supabase
          .from("documents")
          .insert({ employee_id: p.employeeId, ...p.columns } as unknown as DocumentRow)
        if (error) throw error
        created++
      }
    } catch (error) {
      console.error(`Couldn't import row ${p.row} (${p.code}):`, error)
      failed++
    }
  }
  return { updated, created, cleared, failed, skipped: plan.counts.skip, invalid: plan.counts.error }
}
