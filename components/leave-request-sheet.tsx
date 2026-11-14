"use client"

// The request panel on the Leave page (as on CarerHR's client admin Leave
// page): the entry's details, the employee's balance, who else is off on the
// same days, and the decision: approve, reject with a reason, or reset to
// pending. Leave from a past leave year is view only.

import { useEffect, useMemo, useState } from "react"
import { useQuery } from "@tanstack/react-query"
import { Check, Loader2, Pencil, RotateCcw, Trash2, Users, X } from "lucide-react"
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Avatar, Field, plural } from "./page-kit"
import { fetchWithAuth } from "@/lib/api-utils"
import { formatDisplayDate, formatDisplayRange, formatLocalDate, parseDateToUtc, toIsoDate } from "@/lib/dates"
import { shouldDeductFromBalance } from "@/lib/utils"
import type { LeaveRequest } from "@/lib/types"
import type { Decision } from "@/hooks/use-leave-actions"

type CalendarEntry = {
  id: string
  employeeId: string
  employeeName: string
  branch: string
  type: string
  start: string
  end: string
  status: string
}

export function LeaveRequestSheet({
  leave,
  open,
  onOpenChange,
  readOnly,
  busy,
  focusReject,
  typeColor,
  onDecide,
  onEdit,
  onDelete,
}: {
  leave: LeaveRequest | null
  open: boolean
  onOpenChange: (open: boolean) => void
  /** From a past leave year: no decisions or edits here */
  readOnly: boolean
  busy: boolean
  /** Opened from a row's Reject: land in the reason box */
  focusReject?: boolean
  typeColor: (type: string) => string
  onDecide: (status: Decision, note: string) => Promise<boolean>
  onEdit: () => void
  onDelete: () => void
}) {
  const [note, setNote] = useState("")
  const [noteError, setNoteError] = useState(false)
  useEffect(() => {
    setNote("")
    setNoteError(false)
  }, [leave?.id, open])

  // The employee's current balance (balances only exist for the current year)
  const { data: employee } = useQuery<{ daysTaken: number; daysRemaining: number }>({
    queryKey: ["employee", leave?.employeeId],
    queryFn: () => fetchWithAuth(`/api/employees/${leave!.employeeId}`),
    enabled: open && !!leave && !readOnly,
  })

  // Everyone else off on any of the same days (approved or still pending)
  const from = leave ? toIsoDate(parseDateToUtc(leave.startDate) ?? 0) : ""
  const to = leave ? toIsoDate(parseDateToUtc(leave.endDate) ?? 0) : ""
  const { data: overlapData, isLoading: overlapLoading } = useQuery<{ leaves: CalendarEntry[] }>({
    queryKey: ["leave-calendar", "overlap", from, to],
    queryFn: () => fetchWithAuth(`/api/leave-calendar?from=${from}&to=${to}&branch=all`),
    enabled: open && !!leave && !!from && !!to,
  })
  const others = useMemo(
    () =>
      (overlapData?.leaves || [])
        .filter((l) => l.employeeId !== leave?.employeeId && l.status !== "Rejected")
        .sort((a, b) => a.start.localeCompare(b.start) || a.employeeName.localeCompare(b.employeeName)),
    [overlapData, leave?.employeeId],
  )
  const sameBranch = others.filter((o) => o.branch === leave?.branch).length

  if (!leave) return null
  const usesBalance = shouldDeductFromBalance(leave.type)
  const status = leave.status
  const colour = typeColor(leave.type)

  const submit = async (next: Decision) => {
    if (next === "Rejected" && !note.trim()) {
      setNoteError(true)
      return
    }
    if (await onDecide(next, note)) onOpenChange(false)
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="flex w-full flex-col gap-0 overflow-y-auto p-0 sm:max-w-[480px]">
        <SheetHeader className="space-y-3 border-b border-border/70 p-5 pr-12 text-left sm:p-6 sm:pr-12">
          <div className="flex items-center gap-3">
            <Avatar name={leave.employee} className="h-11 w-11" />
            <div className="min-w-0">
              <SheetTitle className="truncate text-lg">{leave.employee}</SheetTitle>
              <SheetDescription className="truncate">
                {leave.branch}
                {leave.employeeCode && leave.employeeCode !== leave.employeeId ? ` · ${leave.employeeCode}` : ""}
              </SheetDescription>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <span
              className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-semibold"
              style={{ backgroundColor: `${colour}1f`, color: colour }}
            >
              <span className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: colour }} aria-hidden />
              {leave.type}
            </span>
            <Badge dot variant={status === "Approved" ? "success" : status === "Pending" ? "warning" : "destructive"}>
              {status}
            </Badge>
            {readOnly && <Badge variant="secondary">Past leave year · view only</Badge>}
          </div>
        </SheetHeader>

        <div className="flex-1 space-y-5 p-5 sm:p-6">
          {/* Balance, current year only */}
          {!readOnly && usesBalance && employee && (
            <div className="grid grid-cols-3 gap-2">
              {[
                { label: "Entitlement", value: employee.daysTaken + employee.daysRemaining },
                { label: "Used", value: employee.daysTaken },
                { label: "Remaining", value: employee.daysRemaining },
              ].map((b) => (
                <div key={b.label} className="rounded-xl bg-muted/60 px-3 py-2.5">
                  <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">{b.label}</p>
                  <p
                    className={`font-display text-xl font-semibold tabular ${b.label === "Remaining" && b.value < 0 ? "text-destructive" : ""}`}
                  >
                    {b.value}
                  </p>
                </div>
              ))}
            </div>
          )}

          <dl className="grid grid-cols-2 gap-x-4 gap-y-4">
            <Field label="Start">{formatDisplayDate(leave.startDate, { weekday: true })}</Field>
            <Field label="End">{formatDisplayDate(leave.endDate, { weekday: true })}</Field>
            <Field label="Days">{plural(leave.duration, "day")}</Field>
            <Field label="Uses balance">{usesBalance ? "Yes" : "No"}</Field>
            <Field label="Added">{leave.submittedDate ? formatDisplayDate(leave.submittedDate) : "—"}</Field>
            <Field label="Added by">{leave.addedBy || "—"}</Field>
          </dl>

          {leave.reason && (
            <div className="space-y-1.5">
              <p className="eyebrow">Reason</p>
              <p className="rounded-xl bg-muted/60 px-3.5 py-3 text-sm">{leave.reason}</p>
            </div>
          )}

          {status !== "Pending" && (leave.adminNotes || leave.decidedBy) && (
            <div className="space-y-1.5">
              <p className="eyebrow">{status === "Approved" ? "Approved" : "Rejected"}</p>
              <div className="rounded-xl bg-muted/60 px-3.5 py-3 text-sm">
                {leave.adminNotes && <p>{leave.adminNotes}</p>}
                {leave.decidedBy && (
                  <p className="mt-1 text-xs text-muted-foreground">
                    {leave.decidedBy}
                    {leave.decidedAt ? ` · ${formatLocalDate(leave.decidedAt)}` : ""}
                  </p>
                )}
              </div>
            </div>
          )}

          {/* Who else is off on these days */}
          <div className="space-y-2">
            <p className="eyebrow flex items-center gap-1.5">
              <Users className="h-3.5 w-3.5" />
              Who else is off · {formatDisplayRange(leave.startDate, leave.endDate)}
            </p>
            {overlapLoading ? (
              <p className="flex items-center gap-2 text-sm text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" />
                Checking cover…
              </p>
            ) : others.length === 0 ? (
              <p className="rounded-xl bg-success-soft px-3.5 py-2.5 text-sm font-medium text-success">
                Nobody else is off on these days.
              </p>
            ) : (
              <>
                {sameBranch > 0 && (
                  <p className="text-xs font-medium text-warning">
                    {plural(sameBranch, "other person", "other people")} in {leave.branch} off at the same time
                  </p>
                )}
                <ul className="space-y-1.5">
                  {others.slice(0, 8).map((o) => (
                    <li key={o.id} className="flex items-center gap-2.5 rounded-xl bg-muted/50 px-3 py-2">
                      <Avatar name={o.employeeName} className="h-7 w-7 text-[11px]" />
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-semibold">{o.employeeName}</p>
                        <p className="truncate text-xs text-muted-foreground">
                          {o.branch} · {o.type} · {formatDisplayRange(o.start, o.end)}
                        </p>
                      </div>
                      {o.status === "Pending" && (
                        <Badge variant="warning" className="shrink-0 px-2 text-[11px] leading-[18px]">
                          Pending
                        </Badge>
                      )}
                    </li>
                  ))}
                </ul>
                {others.length > 8 && <p className="text-xs text-muted-foreground">and {others.length - 8} more</p>}
              </>
            )}
          </div>
        </div>

        {/* Decision */}
        {!readOnly && (
          <div className="space-y-3 border-t border-border/70 bg-muted/30 p-5 sm:p-6">
            <div className="space-y-1.5">
              <Label htmlFor={`leave-note-${leave.id}`}>
                Note <span className="font-normal text-muted-foreground">(needed to reject, optional to approve)</span>
              </Label>
              <Textarea
                id={`leave-note-${leave.id}`}
                value={note}
                autoFocus={focusReject}
                onChange={(e) => {
                  setNote(e.target.value)
                  if (e.target.value.trim()) setNoteError(false)
                }}
                rows={2}
                aria-invalid={noteError}
                placeholder={status === "Pending" ? "Add a note for the record" : "Why are you changing this decision?"}
              />
              {noteError && (
                <p className="text-xs font-medium text-destructive">Give a reason for rejecting this leave.</p>
              )}
            </div>
            <div className="flex flex-wrap gap-2">
              {status !== "Approved" && (
                <Button onClick={() => submit("Approved")} disabled={busy} className="flex-1 sm:flex-none">
                  {busy ? <Loader2 className="animate-spin" /> : <Check />}
                  Approve
                </Button>
              )}
              {status !== "Rejected" && (
                <Button
                  variant="outline"
                  onClick={() => submit("Rejected")}
                  disabled={busy}
                  className="flex-1 text-destructive hover:text-destructive sm:flex-none"
                >
                  <X />
                  Reject
                </Button>
              )}
              {status !== "Pending" && (
                <Button
                  variant="outline"
                  onClick={() => submit("Pending")}
                  disabled={busy}
                  className="flex-1 sm:flex-none"
                >
                  <RotateCcw />
                  Reset to pending
                </Button>
              )}
            </div>
            <div className="flex flex-wrap gap-2 border-t border-border/70 pt-3">
              <Button variant="ghost" size="sm" onClick={onEdit} disabled={busy}>
                <Pencil />
                Edit dates or type
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={onDelete}
                disabled={busy}
                className="text-destructive hover:text-destructive"
              >
                <Trash2 />
                Delete
              </Button>
            </div>
          </div>
        )}
      </SheetContent>
    </Sheet>
  )
}
