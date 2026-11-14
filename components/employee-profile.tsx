"use client"

// One employee on one page: who they are, their leave and their documents,
// with the actions you'd take for them (add leave, edit, record documents,
// mark as left). Replaces the stack of separate pop-ups.

import { useMemo, useState } from "react"
import Link from "next/link"
import { useQuery, useQueryClient } from "@tanstack/react-query"
import {
  CalendarDays,
  CalendarPlus,
  FilePlus2,
  FileText,
  Loader2,
  Pencil,
  RotateCcw,
  ShieldCheck,
  Trash2,
  UserMinus,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Sheet, SheetContent, SheetDescription, SheetTitle } from "@/components/ui/sheet"
import { useToast } from "@/components/ui/use-toast"
import { fetchWithAuth, handleApiError } from "@/lib/api-utils"
import { formatDisplayDate, formatDisplayRange, todayUtc } from "@/lib/dates"
import { DOC_KINDS, daysLabel, entriesFor, urgencyOf, type DocKind } from "@/lib/document-view"
import { rtwState } from "@/lib/document-tracker"
import { buildLeaveYears, inYear, type StoredPeriod } from "@/lib/leave-years"
import { daysUsedInYear, STANDARD_ENTITLEMENT } from "@/lib/balances"
import { isLeaver, leaveAround, missingDetails, shownJobTitle } from "@/lib/employee-directory"
import { leaveTypeColour } from "@/lib/leave-type-colour"
import type { Employee, EmployeeDocument, LeaveRequest, TrackerDocument } from "@/lib/types"
import { cn } from "@/lib/utils"
import { AddLeaveModal } from "./add-leave-modal"
import { AddDocumentModal } from "./add-document-modal"
import { EditEmployeeModal } from "./edit-employee-modal"
import { EditDocumentModal } from "./edit-document-modal"
import { DeleteConfirmationDialog } from "./delete-confirmation-dialog"
import { DocumentDateDialog } from "./document-tracker-dialogs"
import { LeaveCell, LeaveLeft, RtwChip } from "./employee-directory"
import { Avatar, EmptyState, ErrorState, Field, ListSkeleton, StatCard, plural } from "./page-kit"

const TABS = ["overview", "leave", "documents"] as const
type Tab = (typeof TABS)[number]

/**
 * One employee: details, leave and documents, with the actions you'd take.
 * Shown in the right-hand panel from the Employees and Documents pages.
 */
export function EmployeeProfile({ id, onClose }: { id: string; onClose: () => void }) {
  const { toast } = useToast()
  const queryClient = useQueryClient()
  const [tab, setTabState] = useState<Tab>("overview")
  const setTab = (t: string) => setTabState((TABS as readonly string[]).includes(t) ? (t as Tab) : "overview")

  const employeeQuery = useQuery<Employee>({
    queryKey: ["employee", id],
    queryFn: () => fetchWithAuth(`/api/employees/${encodeURIComponent(id)}`),
    retry: 1,
  })
  const leaveQuery = useQuery<LeaveRequest[]>({
    queryKey: ["leaveRequests", "employee", id],
    queryFn: () => fetchWithAuth(`/api/leave-requests?employeeId=${encodeURIComponent(id)}`),
  })
  const docsQuery = useQuery<EmployeeDocument[]>({
    queryKey: ["documents", "employee", id],
    queryFn: () => fetchWithAuth(`/api/documents?employeeId=${encodeURIComponent(id)}`),
  })
  const { data: periods = [] } = useQuery<StoredPeriod[]>({
    queryKey: ["leavePeriods"],
    queryFn: () => fetchWithAuth("/api/leave-periods"),
  })

  const employee = employeeQuery.data
  const leaves = useMemo(() => leaveQuery.data ?? [], [leaveQuery.data])
  const record = docsQuery.data?.[0] ?? null
  const doc: TrackerDocument | null = record
    ? { ...record, recordId: record.id, employeeCode: employee?.employeeCode ?? null, noRecord: false }
    : null

  const today = todayUtc()
  const years = useMemo(() => buildLeaveYears(periods, leaves, today), [periods, leaves, today])
  const currentYear = years.find((y) => y.isCurrent)
  const [allYears, setAllYears] = useState(false)
  const approved = leaves.filter((l) => l.status === "Approved")
  const { awayNow, nextLeave } = leaveAround(approved, today)
  const usedThisYear = currentYear
    ? (daysUsedInYear(
        approved.map((l) => ({ ...l, employeeId: id })),
        currentYear,
      ).get(id)?.days ?? 0)
    : 0
  const shownLeave = (allYears || !currentYear ? leaves : leaves.filter((l) => inYear(l, currentYear))).sort((a, b) =>
    b.startDate.split("/").reverse().join("") > a.startDate.split("/").reverse().join("") ? 1 : -1,
  )
  const rtw = doc
    ? { state: rtwState(doc), date: doc.rightToWorkExpiry, days: doc.rightToWorkDaysLeft }
    : { state: "missing" as const, date: null, days: null }
  const missing = employee
    ? missingDetails({
        email: employee.email ?? null,
        hours: employee.hours ?? null,
        jobTitle: employee.jobTitle,
        hasDocuments: !!record,
      })
    : []

  // Dialogs
  const [addLeave, setAddLeave] = useState(false)
  const [addDocs, setAddDocs] = useState(false)
  const [editOpen, setEditOpen] = useState(false)
  const [editDocs, setEditDocs] = useState<DocKind | null>(null)
  const [cell, setCell] = useState<{ doc: TrackerDocument; kind: DocKind } | null>(null)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [busy, setBusy] = useState(false)

  const refresh = () => {
    for (const key of ["employee", "employees", "dashboard", "documents-tracker", "leaveRequests", "documents"]) {
      queryClient.invalidateQueries({ queryKey: [key] })
    }
  }
  const setLeaver = async (leaver: boolean) => {
    setBusy(true)
    try {
      await fetchWithAuth("/api/employees/bulk", {
        method: "POST",
        body: JSON.stringify({ ids: [id], action: leaver ? "leaver" : "current" }),
      })
      toast({
        title: leaver ? `${employee?.name} marked as left` : `${employee?.name} is current staff again`,
        description: leaver ? "Their history is kept. Find them under Employees → Leavers." : undefined,
      })
      refresh()
    } catch (err) {
      console.error("Couldn't change status:", err)
      toast({ title: "Couldn't update", description: handleApiError(err), variant: "destructive" })
    } finally {
      setBusy(false)
    }
  }
  const remove = async () => {
    setConfirmDelete(false)
    try {
      await fetchWithAuth(`/api/employees/${id}`, { method: "DELETE" })
      toast({ title: `${employee?.name} deleted` })
      refresh()
      onClose()
    } catch (err) {
      console.error("Couldn't delete:", err)
      toast({ title: "Couldn't delete", description: handleApiError(err), variant: "destructive" })
    }
  }

  if (employeeQuery.isLoading) {
    return (
      <div className="space-y-6">
        <SheetTitle className="sr-only">Loading employee</SheetTitle>
        <ListSkeleton rows={2} />
        <ListSkeleton rows={4} />
      </div>
    )
  }
  if (employeeQuery.isError || !employee?.id) {
    return (
      <div className="space-y-6">
        <SheetTitle className="sr-only">Employee</SheetTitle>
        <ErrorState
          title="Couldn't open this employee"
          message={employeeQuery.isError ? handleApiError(employeeQuery.error) : "They may have been deleted."}
          onRetry={() => employeeQuery.refetch()}
        />
      </div>
    )
  }

  const leaver = isLeaver(employee)
  const job = shownJobTitle(employee.jobTitle)

  return (
    <div className="space-y-6">
      <div className="space-y-4">
        {/* Header: who they are, and what you'd do next */}
        <header className="space-y-4 pr-8">
          <div className="flex items-center gap-4">
            <Avatar name={employee.name} className="h-14 w-14 text-lg" />
            <div className="min-w-0 flex-1">
              <SheetTitle asChild>
                <h2 className="flex flex-wrap items-center gap-2 font-display text-[24px] font-semibold leading-tight tracking-[-0.03em]">
                  {employee.name}
                  {leaver && <Badge variant="secondary">Left</Badge>}
                </h2>
              </SheetTitle>
              <SheetDescription className="text-sm text-muted-foreground">
                {[job, employee.branch, employee.employeeCode].filter(Boolean).join(" · ")}
              </SheetDescription>
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            {!leaver && (
              <Button onClick={() => setAddLeave(true)}>
                <CalendarPlus />
                Add leave
              </Button>
            )}
            <Button variant="outline" onClick={() => setEditOpen(true)}>
              <Pencil />
              Edit details
            </Button>
            {leaver ? (
              <Button variant="outline" onClick={() => setLeaver(false)} disabled={busy}>
                {busy ? <Loader2 className="animate-spin" /> : <RotateCcw />}
                Back to current
              </Button>
            ) : (
              <Button variant="outline" onClick={() => setLeaver(true)} disabled={busy}>
                {busy ? <Loader2 className="animate-spin" /> : <UserMinus />}
                Mark as left
              </Button>
            )}
          </div>
        </header>
      </div>

      {/* At a glance */}
      <section aria-label="At a glance" className="grid grid-cols-2 gap-3">
        <StatCard
          label="Leave left"
          icon={CalendarDays}
          value={<LeaveLeft days={employee.daysRemaining} large />}
          detail={`of ${STANDARD_ENTITLEMENT} days this leave year`}
          tone={employee.daysRemaining < 0 ? "danger" : "default"}
        />
        <StatCard
          label="Used this year"
          value={usedThisYear}
          detail={currentYear ? `Annual leave in ${currentYear.label}` : "Annual leave"}
          loading={leaveQuery.isLoading}
        />
        <StatCard
          label="Away / next leave"
          value={<LeaveCell e={{ awayNow, nextLeave }} wrap />}
          loading={leaveQuery.isLoading}
        />
        <StatCard
          label="Right to work"
          icon={ShieldCheck}
          value={<RtwChip rtw={rtw} />}
          detail={rtw.state === "due" && rtw.date ? `Expires ${formatDisplayDate(rtw.date)}` : undefined}
          loading={docsQuery.isLoading}
        />
      </section>

      <Tabs value={tab} onValueChange={setTab}>
        <TabsList aria-label="Employee sections">
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="leave">
            Leave
            {leaves.length ? (
              <span className="ml-1.5 text-xs text-muted-foreground tabular">{leaves.length}</span>
            ) : null}
          </TabsTrigger>
          <TabsTrigger value="documents">Documents</TabsTrigger>
        </TabsList>

        {/* Overview */}
        <TabsContent value="overview" className="mt-5 space-y-4">
          {missing.length > 0 && (
            <div className="flex flex-col gap-3 rounded-2xl bg-warning-soft px-5 py-4 sm:flex-row sm:items-center">
              <p className="flex-1 text-sm text-warning">
                <span className="font-semibold">Missing:</span> {missing.join(", ").toLowerCase()}. Complete their
                record so reminders and reports work.
              </p>
              <Button
                size="sm"
                variant="outline"
                onClick={() =>
                  missing.length === 1 && missing[0] === "Documents" ? setAddDocs(true) : setEditOpen(true)
                }
              >
                Complete record
              </Button>
            </div>
          )}
          <div className="surface p-5 sm:p-6">
            <dl className="grid grid-cols-1 gap-x-6 gap-y-5 sm:grid-cols-2 lg:grid-cols-3">
              <Field label="Job title">{job || "Not recorded"}</Field>
              <Field label="Branch">{employee.branch}</Field>
              <Field label="Employee code">{employee.employeeCode || "—"}</Field>
              <Field label="Email">
                {employee.email ? (
                  <a href={`mailto:${employee.email}`} className="text-primary hover:underline">
                    {employee.email}
                  </a>
                ) : (
                  "Not recorded"
                )}
              </Field>
              <Field label="Phone">
                {employee.phone ? (
                  <a href={`tel:${employee.phone}`} className="text-primary hover:underline">
                    {employee.phone}
                  </a>
                ) : (
                  "Not recorded"
                )}
              </Field>
              <Field label="Hours a week">{employee.hours ?? "Not recorded"}</Field>
              <Field label="Status">
                <Badge variant={leaver ? "secondary" : "success"} dot>
                  {leaver ? "Left" : "Current"}
                </Badge>
              </Field>
              <Field label="Immigration status">{record ? friendlyStatus(record.status) : "Not recorded"}</Field>
              <Field label="Sponsored">
                {record ? (record.isSponsored ? `Yes${record.is20Hours ? " · 20 hours a week cap" : ""}` : "No") : "—"}
              </Field>
            </dl>
          </div>
          <div className="flex justify-end">
            <Button
              variant="ghost"
              className="text-destructive hover:text-destructive"
              onClick={() => setConfirmDelete(true)}
            >
              <Trash2 />
              Delete employee
            </Button>
          </div>
        </TabsContent>

        {/* Leave */}
        <TabsContent value="leave" className="mt-5">
          <div className="surface overflow-hidden">
            <div className="flex flex-wrap items-center gap-2 border-b border-border/70 px-4 py-3 sm:px-5">
              <div
                className="mr-auto flex rounded-full bg-secondary p-0.5 text-xs font-semibold"
                role="group"
                aria-label="Which leave"
              >
                {[
                  { all: false, label: currentYear ? currentYear.label : "This year" },
                  { all: true, label: "All years" },
                ].map((o) => (
                  <button
                    key={String(o.all)}
                    onClick={() => setAllYears(o.all)}
                    aria-pressed={allYears === o.all}
                    className={cn(
                      "h-8 rounded-full px-3 transition-colors",
                      allYears === o.all
                        ? "bg-card text-foreground shadow-raised"
                        : "text-muted-foreground hover:text-foreground",
                    )}
                  >
                    {o.label}
                  </button>
                ))}
              </div>
              {!leaver && (
                <Button size="sm" onClick={() => setAddLeave(true)}>
                  <CalendarPlus />
                  Add leave
                </Button>
              )}
            </div>
            {leaveQuery.isLoading ? (
              <ListSkeleton rows={4} />
            ) : shownLeave.length === 0 ? (
              <EmptyState
                icon={CalendarDays}
                title={allYears ? "No leave recorded" : `No leave in ${currentYear?.label ?? "this year"}`}
                description={allYears ? undefined : "Older leave is under All years."}
              />
            ) : (
              <ul className="divide-y divide-border/70">
                {shownLeave.map((l) => (
                  <li key={l.id}>
                    <Link
                      href={`/dashboard/leave-management?request=${l.id}`}
                      className="flex items-center gap-3 px-4 py-3 transition-colors hover:bg-muted/50 sm:px-5"
                    >
                      <span
                        className="h-2.5 w-2.5 shrink-0 rounded-full"
                        style={{ backgroundColor: leaveTypeColour(l.type) }}
                        aria-hidden
                      />
                      <span className="min-w-0 flex-1">
                        <span className="block text-sm font-semibold">{l.type}</span>
                        <span className="block text-xs text-muted-foreground tabular">
                          {formatDisplayRange(l.startDate, l.endDate)} · {plural(l.duration, "day")}
                        </span>
                      </span>
                      <Badge
                        dot
                        variant={
                          l.status === "Approved" ? "success" : l.status === "Pending" ? "warning" : "destructive"
                        }
                      >
                        {l.status}
                      </Badge>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </TabsContent>

        {/* Documents */}
        <TabsContent value="documents" className="mt-5">
          {docsQuery.isLoading ? (
            <div className="surface">
              <ListSkeleton rows={4} />
            </div>
          ) : !doc ? (
            <div className="surface">
              <EmptyState
                icon={FileText}
                title="No documents on file"
                description="Record their right to work, passport, BRP or other documents and when they expire."
                action={
                  <Button onClick={() => setAddDocs(true)}>
                    <FilePlus2 />
                    Add documents
                  </Button>
                }
              />
            </div>
          ) : (
            <div className="surface overflow-hidden">
              <div className="flex items-center gap-2 border-b border-border/70 px-4 py-3 sm:px-5">
                <p className="mr-auto text-sm text-muted-foreground">
                  {friendlyStatus(doc.status)}
                  {doc.country ? ` · ${doc.country}` : ""}
                  {doc.isSponsored ? " · Sponsored" : ""}
                </p>
                <Button size="sm" variant="outline" onClick={() => setEditDocs("rightToWork")}>
                  <Pencil />
                  Edit documents
                </Button>
              </div>
              <ul className="divide-y divide-border/70">
                {DOC_KINDS.map((k) => {
                  const entry = entriesFor(doc, k.id)[0]
                  const u = entry ? urgencyOf(entry.days) : null
                  return (
                    <li key={k.id}>
                      <button
                        onClick={() => setCell({ doc, kind: k.id })}
                        className="flex w-full items-center gap-3 px-4 py-3.5 text-left transition-colors hover:bg-muted/50 sm:px-5"
                      >
                        <span className="min-w-0 flex-1">
                          <span className="block text-sm font-semibold">
                            {k.id === "other" && doc.otherDocumentType ? doc.otherDocumentType : k.label}
                          </span>
                          <span className="block text-xs text-muted-foreground tabular">
                            {entry ? `Expires ${formatDisplayDate(entry.date)}` : "No expiry recorded · Add"}
                          </span>
                        </span>
                        {entry && u && (
                          <Badge
                            dot={u !== "valid"}
                            variant={
                              u === "expired" || u === "d7"
                                ? "destructive"
                                : u === "d30"
                                  ? "warning"
                                  : u === "d90"
                                    ? "default"
                                    : "success"
                            }
                          >
                            {daysLabel(entry.days)}
                          </Badge>
                        )}
                      </button>
                    </li>
                  )
                })}
              </ul>
            </div>
          )}
        </TabsContent>
      </Tabs>

      <AddLeaveModal open={addLeave} onOpenChange={setAddLeave} initialEmployeeId={id} />
      <AddDocumentModal open={addDocs} onOpenChange={setAddDocs} initialEmployeeId={id} />
      {editOpen && <EditEmployeeModal employeeId={id} isOpen onClose={() => setEditOpen(false)} />}
      {doc && editDocs && (
        <EditDocumentModal document={doc} initialTab={editDocs} open onOpenChange={(o) => !o && setEditDocs(null)} />
      )}
      <DocumentDateDialog target={cell} onOpenChange={(o) => !o && setCell(null)} />
      <DeleteConfirmationDialog
        isOpen={confirmDelete}
        onClose={() => setConfirmDelete(false)}
        onConfirm={remove}
        title="Delete employee"
        description={`Delete ${employee.name}? This can't be undone. If they've left, "Mark as left" keeps their history instead.`}
        confirmLabel="Delete"
        cancelLabel="Cancel"
      />
    </div>
  )
}

/** "NON-EU" → "Non-EU", as people say it */
function friendlyStatus(status: string | null | undefined) {
  const s = (status || "").toUpperCase()
  if (s === "NON-EU") return "Non-EU"
  if (s === "EU") return "EU"
  if (s === "BRITISH") return "British"
  return status || "Not recorded"
}

/** The right-hand panel that holds an employee's profile */
export function EmployeePanel({ id, onClose }: { id: string | null; onClose: () => void }) {
  return (
    <Sheet open={!!id} onOpenChange={(open) => !open && onClose()}>
      <SheetContent side="right" className="w-full overflow-y-auto p-5 sm:max-w-[640px] sm:p-6">
        {id && <EmployeeProfile key={id} id={id} onClose={onClose} />}
      </SheetContent>
    </Sheet>
  )
}
