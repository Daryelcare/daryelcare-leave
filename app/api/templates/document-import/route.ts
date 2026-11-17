import { NextResponse } from "next/server"
import * as XLSX from "xlsx"
import { requireUser } from "@/lib/server-auth"
import { CHECK_TYPE_LABELS, COLUMN_NAMES, TEMPLATE_COLUMNS } from "@/lib/document-import"

// GET /api/templates/document-import?format=excel|csv: the documents import
// template, with sample people showing each type of right to work check.
// The Excel version has drop-downs (Check Type, yes/no) and date checks, and a
// "How to fill it in" sheet.

const HEADINGS = TEMPLATE_COLUMNS.map((f) => COLUMN_NAMES[f][0])

type Sample = [string, string, string, string, string | null, string | null, string, string, string, string, string]
const SAMPLES: Sample[] = [
  [
    "Sample Employee One",
    "EMP001",
    "Example Branch",
    CHECK_TYPE_LABELS.british_irish,
    "03/11/2026",
    null,
    "BRITISH",
    "United Kingdom",
    "British passport: never due again",
    "no",
    "no",
  ],
  [
    "Sample Employee Two",
    "EMP002",
    "Example Branch",
    CHECK_TYPE_LABELS.indefinite,
    "04/11/2026",
    null,
    "EU",
    "Portugal",
    "EU settled status: never due again",
    "no",
    "no",
  ],
  [
    "Sample Employee Three",
    "EMP003",
    "Example Branch",
    CHECK_TYPE_LABELS.time_limited,
    "05/11/2026",
    "31/03/2028",
    "NON-EU",
    "Example Country",
    "Visa ends 31/03/2028: due again then",
    "yes",
    "yes",
  ],
  [
    "Sample Employee Four",
    "EMP004",
    "Example Branch",
    CHECK_TYPE_LABELS.pending_application,
    "06/11/2026",
    null,
    "NON-EU",
    "Example Country",
    "Employer Checking Service: due again 6 months after the check",
    "no",
    "no",
  ],
  [
    "Sample Employee Five",
    "EMP005",
    "Example Branch",
    "",
    null,
    null,
    "",
    "",
    "Not checked again yet: leave the right to work cells empty",
    "",
    "",
  ],
]

const GUIDE = [
  "Right to work import: how to fill it in",
  "",
  "1. One row per employee. People are matched by Employee Code, so the code must be exactly as it is in the app.",
  "   Employee Name and Branch are just there to help you; the app uses the name and branch it already has.",
  "",
  "2. Check Type (pick from the list) decides which dates you need:",
  `   ${CHECK_TYPE_LABELS.british_irish}: Date Checked. Never due again.`,
  `   ${CHECK_TYPE_LABELS.indefinite} (indefinite leave to remain, EU settled status): Date Checked. Never due again.`,
  `   ${CHECK_TYPE_LABELS.time_limited} (visa, pre-settled status, eVisa or BRP with an end date): Date Checked and Right to Work Expiry. Due again on the expiry date.`,
  `   ${CHECK_TYPE_LABELS.pending_application} (Employer Checking Service result): Date Checked. Due again 6 months after the check (the app works it out).`,
  "",
  "3. Dates are dd/mm/yyyy, for example 17/11/2026.",
  "",
  "4. Leaving Check Type, Date Checked and Right to Work Expiry all empty CLEARS that person's current check.",
  "   Delete the row instead if you don't want to change them.",
  "",
  "5. is_sponsored and is_20_hrs: yes or no. An empty cell counts as no.",
  "   Status (BRITISH, EU, NON-EU) and Country are optional: an empty cell leaves what's saved as it is.",
  "   Notes are for you; they aren't imported.",
  "",
  "6. Delete the sample rows before you import. In the app, Import shows you every change before anything is saved.",
]

function toSerial(date: string | null): number | null {
  if (!date) return null
  const [d, m, y] = date.split("/").map(Number)
  return Date.UTC(y, m - 1, d) / 86_400_000 + 25_569
}

/** Adds drop-downs and date checks to a sheet XML written by SheetJS */
function withValidations(sheetXml: string, lastRow: number) {
  const list = (range: string, items: string[]) =>
    `<dataValidation type="list" allowBlank="1" showErrorMessage="1" errorTitle="Pick from the list" error="Choose one of the options in the list" sqref="${range}"><formula1>"${items.join(",")}"</formula1></dataValidation>`
  const col = (field: (typeof TEMPLATE_COLUMNS)[number]) => String.fromCharCode(65 + TEMPLATE_COLUMNS.indexOf(field))
  const range = (field: (typeof TEMPLATE_COLUMNS)[number]) => `${col(field)}2:${col(field)}${lastRow}`
  const dates = `<dataValidation type="date" operator="between" allowBlank="1" showErrorMessage="1" errorTitle="Date" error="Enter a date as dd/mm/yyyy" sqref="${range("dateChecked")} ${range("rtwExpiry")}"><formula1>36526</formula1><formula2>73051</formula2></dataValidation>`
  const block =
    `<dataValidations count="5">` +
    list(range("checkType"), Object.values(CHECK_TYPE_LABELS)) +
    list(range("status"), ["BRITISH", "EU", "NON-EU"]) +
    list(range("sponsored"), ["yes", "no"]) +
    list(range("twentyHours"), ["yes", "no"]) +
    dates +
    `</dataValidations>`
  // dataValidations goes before pageMargins (or at the end) in a worksheet
  return sheetXml.includes("<pageMargins")
    ? sheetXml.replace("<pageMargins", `${block}<pageMargins`)
    : sheetXml.replace("</worksheet>", `${block}</worksheet>`)
}

function excelTemplate(): Buffer {
  const LAST_ROW = 1000
  const rows = SAMPLES.map((s) =>
    s.map((v, i) => {
      const field = TEMPLATE_COLUMNS[i]
      if (field === "dateChecked" || field === "rtwExpiry") {
        const serial = toSerial(v)
        return serial === null ? null : { t: "n", v: serial, z: "dd/mm/yyyy" }
      }
      return v
    }),
  )
  const sheet = XLSX.utils.aoa_to_sheet([HEADINGS, ...rows])
  sheet["!cols"] = [34, 15, 16, 26, 14, 20, 11, 18, 52, 12, 10].map((wch) => ({ wch }))
  const guide = XLSX.utils.aoa_to_sheet(GUIDE.map((line) => [line]))
  guide["!cols"] = [{ wch: 140 }]
  const book = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(book, sheet, "Right to work")
  XLSX.utils.book_append_sheet(book, guide, "How to fill it in")
  const written = XLSX.write(book, { type: "buffer", bookType: "xlsx" }) as Buffer

  // Add the drop-downs to the first sheet inside the .xlsx (a zip)
  const zip = XLSX.CFB.read(written, { type: "buffer" })
  const entry = XLSX.CFB.find(zip, "/xl/worksheets/sheet1.xml")
  if (!entry?.content) return written
  const xml = Buffer.from(entry.content as Uint8Array).toString("utf8")
  entry.content = Buffer.from(withValidations(xml, LAST_ROW), "utf8")
  entry.size = (entry.content as Buffer).length
  return Buffer.from(XLSX.CFB.write(zip, { type: "buffer", fileType: "zip" }) as Uint8Array)
}

function csvTemplate(): Buffer {
  const quote = (v: string | null) => (v && /[",\n]/.test(v) ? `"${v.replace(/"/g, '""')}"` : (v ?? ""))
  const lines = [HEADINGS, ...SAMPLES].map((r) => r.map(quote).join(","))
  return Buffer.from("﻿" + lines.join("\r\n") + "\r\n", "utf8")
}

export async function GET(request: Request) {
  try {
    const auth = await requireUser(request)
    if (auth.response) return auth.response
    // CSV unless Excel is asked for
    const csv = new URL(request.url).searchParams.get("format") !== "excel"
    const body = csv ? csvTemplate() : excelTemplate()
    return new NextResponse(new Uint8Array(body), {
      headers: {
        "Content-Type": csv
          ? "text/csv; charset=utf-8"
          : "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": `attachment; filename="right-to-work-import-template.${csv ? "csv" : "xlsx"}"`,
        "Content-Length": body.length.toString(),
      },
    })
  } catch (error) {
    console.error("Couldn't make the documents template:", error)
    return NextResponse.json({ error: "Couldn't make the template. Please try again." }, { status: 500 })
  }
}
