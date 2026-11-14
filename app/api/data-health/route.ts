import { NextResponse } from "next/server"
import { supabase } from "@/lib/supabase"
import { fetchAllRows } from "@/lib/fetch-all"
import { requireAdmin } from "@/lib/server-auth"
import { loadBalanceCheck } from "@/lib/balance-server"
import { plural } from "@/lib/plural"
import {
  badlyCased,
  caseVariants,
  duplicateNames,
  placeholderCode,
  titleCase,
  type HealthCheck,
} from "@/lib/data-health"
import type { DocumentRow, EmployeeRow } from "@/lib/database.types"

async function loadAll() {
  const employees = await fetchAllRows<EmployeeRow>((from, to) =>
    supabase.from("employees").select("*").order("id").range(from, to),
  )
  const documents = await fetchAllRows<DocumentRow>((from, to) =>
    supabase.from("documents").select("*").order("id").range(from, to),
  )
  const leave = await fetchAllRows<{ id: string; employee_id: string }>((from, to) =>
    supabase.from("leave_requests").select("id, employee_id").order("id").range(from, to),
  )
  return { employees, documents, leave }
}

/** Document records whose employee no longer exists, and who they probably belong to */
function orphans(employees: EmployeeRow[], documents: DocumentRow[]) {
  const ids = new Set(employees.map((e) => e.id))
  const withRecord = new Set(documents.map((d) => d.employee_id))
  return documents
    .filter((d) => !ids.has(d.employee_id))
    .map((d) => {
      const name = (d.employee_name || "").trim().toLowerCase()
      const matches = employees.filter((e) => e.name.trim().toLowerCase() === name && !withRecord.has(e.id))
      return { doc: d, match: matches.length === 1 ? matches[0] : null }
    })
}

// GET: every check, with counts, examples and what can be done about it
export async function GET(request: Request) {
  try {
    const auth = await requireAdmin(request)
    if (auth.response) return auth.response
    const { employees, documents, leave } = await loadAll()
    const current = employees.filter((e) => (e.status || "active").toLowerCase() !== "inactive")
    const leavers = employees.length - current.length
    const docIds = new Set(documents.map((d) => d.employee_id))
    const employeeIds = new Set(employees.map((e) => e.id))

    const jobVariants = caseVariants(employees.map((e) => e.job_title))
    const jobToFix = jobVariants.reduce((t, g) => t + g.from.reduce((s, f) => s + f.count, 0), 0)
    const names = employees.filter((e) => badlyCased(e.name))
    const countryVariants = caseVariants(documents.map((d) => d.country))
    const countryToFix = countryVariants.reduce((t, g) => t + g.from.reduce((s, f) => s + f.count, 0), 0)
    const orphanDocs = orphans(employees, documents)
    const relinkable = orphanDocs.filter((o) => o.match)
    const noEmail = current.filter((e) => !e.email).length
    const noHours = current.filter((e) => e.hours === null || e.hours === undefined).length
    const noJob = current.filter((e) => !e.job_title || e.job_title.trim().toLowerCase() === "unspecified").length
    const noDocs = current.filter((e) => !docIds.has(e.id)).length
    const codes = current.filter((e) => placeholderCode(e.employee_code))
    const dupes = duplicateNames(current)
    const leaveOrphans = leave.filter((l) => !employeeIds.has(l.employee_id)).length
    const balances = await loadBalanceCheck()

    const checks: HealthCheck[] = [
      {
        id: "balances",
        title: "Leave balances don't match the leave on record",
        detail: `Stored balances that differ from approved annual leave in ${balances.year.label}.${balances.summary.suspicious ? ` ${plural(balances.summary.suspicious, "person has", "people have")} over 56 days, usually a duplicate entry.` : ""}`,
        count: balances.summary.changed,
        severity: "fix",
        link: { href: "/dashboard/settings?section=leave-periods", label: "Check balances" },
      },
      {
        id: "orphans",
        title: "Document records for people who no longer exist",
        detail: relinkable.length
          ? `${plural(relinkable.length, "record matches", "records match")} a current employee by name and can be linked back.`
          : "Usually left behind when someone was deleted or re-imported.",
        count: orphanDocs.length,
        severity: "fix",
        examples: orphanDocs
          .slice(0, 5)
          .map((o) => o.doc.employee_name + (o.match ? " → matches a current employee" : "")),
        action: relinkable.length
          ? {
              id: "relink_orphans",
              label: `Link ${relinkable.length} back`,
              confirm: `Link ${plural(relinkable.length, "document record")} to the current employee with the same name?`,
            }
          : undefined,
      },
      {
        id: "leavers",
        title: leavers ? "Leavers" : "Nobody is marked as having left",
        detail: leavers
          ? `${plural(leavers, "person is", "people are")} marked as left and kept out of lists and counts.`
          : "People who have left still count in every list, tile and report. Mark them as left on the Employees page.",
        count: leavers ? 0 : current.length,
        severity: leavers ? "info" : "review",
        link: { href: "/dashboard/employees", label: "Open Employees" },
      },
      {
        id: "no_documents",
        title: "Current staff with no documents on file",
        detail: "Their right to work can't be checked until a record is added.",
        count: noDocs,
        severity: "review",
        link: { href: "/dashboard/document-tracker?status=missing", label: "See who" },
      },
      {
        id: "missing",
        title: "Current staff with missing details",
        detail: `${noEmail} without an email, ${noHours} without hours, ${noJob} without a job title.`,
        count: current.filter(
          (e) => !e.email || e.hours == null || !e.job_title || e.job_title.trim().toLowerCase() === "unspecified",
        ).length,
        severity: "review",
        link: { href: "/dashboard/employees?show=missing", label: "See who" },
      },
      {
        id: "job_titles",
        title: "Job titles written different ways",
        detail: "The same job spelt with different capitals, so it shows and counts as separate jobs.",
        count: jobToFix,
        severity: "fix",
        examples: jobVariants
          .slice(0, 4)
          .map((g) => `${g.from.map((f) => `"${f.value}" (${f.count})`).join(", ")} → "${g.to}"`),
        action: jobToFix
          ? {
              id: "job_titles",
              label: "Tidy job titles",
              confirm: `Change ${plural(jobToFix, "job title")} to one spelling each?`,
            }
          : undefined,
      },
      {
        id: "names",
        title: "Names in all lower case or all capitals",
        detail: "Shown as typed on every page and export.",
        count: names.length,
        severity: "fix",
        examples: names.slice(0, 4).map((e) => `${e.name} → ${titleCase(e.name)}`),
        action: names.length
          ? { id: "names", label: "Tidy names", confirm: `Change ${plural(names.length, "name")} to normal capitals?` }
          : undefined,
      },
      {
        id: "countries",
        title: "Countries written different ways",
        detail: "For example NIGERIA and Nigeria, which split reports.",
        count: countryToFix,
        severity: "fix",
        examples: countryVariants
          .slice(0, 4)
          .map((g) => `${g.from.map((f) => `"${f.value}" (${f.count})`).join(", ")} → "${g.to}"`),
        action: countryToFix
          ? {
              id: "countries",
              label: "Tidy countries",
              confirm: `Change ${plural(countryToFix, "country", "countries")} to one spelling each?`,
            }
          : undefined,
      },
      {
        id: "codes",
        title: "Employee codes that look like placeholders",
        detail: 'Codes with no number, such as "tenp". Update them so exports and imports match the right person.',
        count: codes.length,
        severity: "review",
        examples: codes.slice(0, 5).map((e) => `${e.name}: ${e.employee_code || "blank"}`),
      },
      {
        id: "duplicates",
        title: "Possible duplicate people",
        detail: "More than one current employee with the same name.",
        count: dupes.length,
        severity: "review",
        examples: dupes
          .slice(0, 5)
          .map((g) => `${g[0].name} (${g.length}, ${[...new Set(g.map((p) => p.branch))].join(", ")})`),
      },
      {
        id: "leave_orphans",
        title: "Leave for people who no longer exist",
        detail: "Kept for history; it doesn't count towards anyone's balance.",
        count: leaveOrphans,
        severity: "info",
      },
    ]

    return NextResponse.json({ people: current.length, checks })
  } catch (error) {
    console.error("Error checking data health:", error)
    return NextResponse.json({ error: "Couldn't check the data. Please try again." }, { status: 500 })
  }
}

// POST { action }: one of the safe tidy-ups. Returns how many records changed.
export async function POST(request: Request) {
  try {
    const auth = await requireAdmin(request)
    if (auth.response) return auth.response
    const { action } = await request.json()
    const { employees, documents } = await loadAll()
    let changed = 0

    if (action === "job_titles") {
      for (const group of caseVariants(employees.map((e) => e.job_title))) {
        for (const f of group.from) {
          const { error } = await supabase.from("employees").update({ job_title: group.to }).eq("job_title", f.value)
          if (error) throw error
          changed += f.count
        }
      }
    } else if (action === "countries") {
      for (const group of caseVariants(documents.map((d) => d.country))) {
        for (const f of group.from) {
          const { error } = await supabase.from("documents").update({ country: group.to }).eq("country", f.value)
          if (error) throw error
          changed += f.count
        }
      }
    } else if (action === "names") {
      for (const e of employees.filter((x) => badlyCased(x.name))) {
        const name = titleCase(e.name)
        const { error } = await supabase.from("employees").update({ name }).eq("id", e.id)
        if (error) throw error
        // Keep the copies of the name on their leave and documents in step
        await supabase.from("leave_requests").update({ employee_name: name }).eq("employee_id", e.id)
        await supabase.from("documents").update({ employee_name: name }).eq("employee_id", e.id)
        changed++
      }
    } else if (action === "relink_orphans") {
      for (const o of orphans(employees, documents).filter((x) => x.match)) {
        const { error } = await supabase
          .from("documents")
          .update({ employee_id: o.match!.id, employee_name: o.match!.name, branch: o.match!.branch })
          .eq("id", o.doc.id)
        if (error) throw error
        changed++
      }
    } else {
      return NextResponse.json({ error: "Unknown tidy-up" }, { status: 400 })
    }

    console.log(`${auth.user.email} ran data tidy-up "${action}": ${changed} changed`)
    return NextResponse.json({ changed })
  } catch (error) {
    console.error("Error tidying data:", error)
    return NextResponse.json({ error: "Couldn't finish the tidy-up. Please check again and retry." }, { status: 500 })
  }
}
