"use client"

import { useEffect, useMemo, useState } from "react"
import { format } from "date-fns"
import { useQuery, useQueryClient } from "@tanstack/react-query"
import { AlertTriangle, Loader2 } from "lucide-react"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { DatePicker } from "@/components/ui/date-picker"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { useToast } from "@/hooks/use-toast"
import { useLeaveTypes } from "@/hooks/use-leave-types"
import { fetchWithAuth, handleApiError } from "@/lib/api-utils"
import { inclusiveDays, localDateToUtc, parseDateToUtc, utcToLocalDate } from "@/lib/dates"
import { shouldDeductFromBalance } from "@/lib/utils"
import type { LeaveRequest } from "@/lib/types"

interface EditLeaveModalProps {
  leave: LeaveRequest | null
  open: boolean
  onOpenChange: (open: boolean) => void
}

function toLocal(ukDate: string): Date | undefined {
  const time = parseDateToUtc(ukDate)
  return time === null ? undefined : utcToLocalDate(time)
}

export function EditLeaveModal({ leave, open, onOpenChange }: EditLeaveModalProps) {
  const { toast } = useToast()
  const queryClient = useQueryClient()
  const { data: leaveTypes = [] } = useLeaveTypes()

  const [type, setType] = useState("")
  const [startDate, setStartDate] = useState<Date | undefined>()
  const [endDate, setEndDate] = useState<Date | undefined>()
  const [reason, setReason] = useState("")
  const [isSaving, setIsSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Load the entry's current values each time the modal opens
  useEffect(() => {
    if (open && leave) {
      setType(leave.type)
      setStartDate(toLocal(leave.startDate))
      setEndDate(toLocal(leave.endDate))
      setReason(leave.reason || "")
      setError(null)
    }
  }, [open, leave])

  // The employee's other leave, to warn about overlaps
  const { data: otherLeave = [] } = useQuery<LeaveRequest[]>({
    queryKey: ["leaveRequests", "employee", leave?.employeeId],
    queryFn: () => fetchWithAuth(`/api/leave-requests?employeeId=${leave?.employeeId}`),
    enabled: open && !!leave?.employeeId,
  })

  const typeOptions = useMemo(() => {
    const names = leaveTypes.filter((t) => t.isActive !== false).map((t) => t.name)
    if (leave && !names.includes(leave.type)) names.unshift(leave.type)
    return names
  }, [leaveTypes, leave])

  if (!leave) return null

  const start = startDate ? localDateToUtc(startDate) : null
  const end = endDate ? localDateToUtc(endDate) : null
  const datesValid = start !== null && end !== null && end >= start
  const duration = datesValid ? inclusiveDays(start, end) : 0

  // Same rule as the server: only approved Annual Leave / Working Holiday use the balance
  const counts = (t: string, days: number) =>
    leave.status === "Approved" && shouldDeductFromBalance(t) ? days : 0
  const balanceChange = datesValid ? counts(leave.type, leave.duration) - counts(type, duration) : 0

  const overlaps = datesValid
    ? otherLeave.filter((other) => {
        if (other.id === leave.id) return false
        const os = parseDateToUtc(other.startDate)
        const oe = parseDateToUtc(other.endDate) ?? os
        return os !== null && oe !== null && os <= end && oe >= start
      })
    : []

  const unchanged =
    type === leave.type &&
    start === parseDateToUtc(leave.startDate) &&
    end === parseDateToUtc(leave.endDate) &&
    reason.trim() === (leave.reason || "").trim()

  const handleSave = async () => {
    if (!type || !datesValid) return
    setIsSaving(true)
    setError(null)
    try {
      await fetchWithAuth(`/api/leave-requests/${leave.id}`, {
        method: "PATCH",
        body: JSON.stringify({
          type,
          startDate: format(startDate!, "dd/MM/yyyy"),
          endDate: format(endDate!, "dd/MM/yyyy"),
          reason,
        }),
      })

      toast({
        title: "Leave updated",
        description:
          balanceChange === 0
            ? `${leave.employee}'s leave was updated.`
            : `${leave.employee}'s leave was updated and their balance ${balanceChange > 0 ? "got back" : "used"} ${Math.abs(balanceChange)} ${Math.abs(balanceChange) === 1 ? "day" : "days"}.`,
      })

      for (const key of ["leaveRequests", "leaveRequest", "employees", "dashboard", "leave-calendar"]) {
        queryClient.invalidateQueries({ queryKey: [key] })
      }
      onOpenChange(false)
    } catch (err) {
      setError(handleApiError(err))
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[520px]">
        <DialogHeader>
          <DialogTitle>Edit leave</DialogTitle>
          <DialogDescription>
            {leave.employee} · {leave.branch}
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-4 py-2">
          <div className="space-y-2">
            <Label htmlFor="edit-leave-type">Leave type</Label>
            <Select value={type} onValueChange={setType}>
              <SelectTrigger id="edit-leave-type">
                <SelectValue placeholder="Select leave type" />
              </SelectTrigger>
              <SelectContent>
                {typeOptions.map((name) => (
                  <SelectItem key={name} value={name}>
                    {name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="edit-leave-start">Start date</Label>
              <DatePicker id="edit-leave-start" value={startDate} onChange={(d) => d && setStartDate(d)} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-leave-end">End date</Label>
              <DatePicker id="edit-leave-end" value={endDate} min={startDate} onChange={(d) => d && setEndDate(d)} />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="edit-leave-reason">Reason</Label>
            <Textarea
              id="edit-leave-reason"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="Optional"
              rows={3}
            />
          </div>

          {/* What will change */}
          <div className="rounded-xl border border-border/80 bg-muted/40 p-3.5 text-sm">
            {!datesValid ? (
              <p className="text-destructive">The end date can&apos;t be before the start date.</p>
            ) : (
              <>
                <p>
                  <span className="font-medium">{duration}</span> {duration === 1 ? "day" : "days"}
                  {duration !== leave.duration && (
                    <span className="text-muted-foreground"> (was {leave.duration})</span>
                  )}
                </p>
                <p className="text-muted-foreground">
                  {balanceChange === 0
                    ? "No change to the employee's leave balance."
                    : balanceChange > 0
                      ? `${balanceChange} ${balanceChange === 1 ? "day goes" : "days go"} back to the employee's balance.`
                      : `${Math.abs(balanceChange)} more ${Math.abs(balanceChange) === 1 ? "day comes" : "days come"} off the employee's balance.`}
                </p>
              </>
            )}
          </div>

          {overlaps.length > 0 && (
            <div className="flex gap-2.5 rounded-xl border border-warning/25 bg-warning-soft p-3 text-sm">
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-warning" />
              <span>
                Overlaps with other leave for {leave.employee}:{" "}
                {overlaps.map((o) => `${o.type} ${o.startDate}–${o.endDate}`).join("; ")}
              </span>
            </div>
          )}

          {error && <p className="text-sm text-destructive">{error}</p>}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isSaving}>
            Cancel
          </Button>
          <Button onClick={handleSave} disabled={isSaving || !type || !datesValid || unchanged}>
            {isSaving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Save changes
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
