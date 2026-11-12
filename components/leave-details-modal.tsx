"use client"

import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { useQuery } from "@tanstack/react-query"
import { fetchWithAuth, handleApiError } from "@/lib/api-utils"
import { Skeleton } from "@/components/ui/skeleton"
import { Badge } from "@/components/ui/badge"
import { useLeaveTypes } from "@/hooks/use-leave-types"
import { formatDisplayDate, formatDisplayRange } from "@/lib/dates"
import { Avatar, EmptyState, ErrorState, Field, plural } from "./page-kit"
import type { LeaveRequest } from "@/lib/types"

interface LeaveDetailsModalProps {
  leaveId: string
  isOpen: boolean
  onClose: () => void
}

export function LeaveDetailsModal({ leaveId, isOpen, onClose }: LeaveDetailsModalProps) {
  const {
    data: leave,
    isLoading,
    isError,
    error,
  } = useQuery<LeaveRequest>({
    queryKey: ["leaveRequest", leaveId],
    queryFn: async () => {
      return fetchWithAuth(`/api/leave-requests/${leaveId}`)
    },
    enabled: isOpen && !!leaveId,
  })

  const { data: leaveTypes = [] } = useLeaveTypes()
  const color = leaveTypes.find((t) => t.name === leave?.type)?.color || "#64748b"

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[520px]">
        <DialogHeader>
          <DialogTitle>Leave details</DialogTitle>
        </DialogHeader>

        {isLoading ? (
          <div className="space-y-4">
            <Skeleton className="h-14 w-full rounded-xl" />
            <Skeleton className="h-20 w-full rounded-xl" />
            <Skeleton className="h-24 w-full" />
          </div>
        ) : isError ? (
          <ErrorState title="Couldn't load this leave entry" message={handleApiError(error)} />
        ) : leave ? (
          <div className="space-y-5">
            <div className="flex items-center gap-3">
              <Avatar name={leave.employee} className="h-11 w-11" />
              <div className="min-w-0 flex-1">
                <p className="truncate font-semibold">{leave.employee}</p>
                <p className="truncate text-sm text-muted-foreground">
                  {leave.branch}
                  {leave.employeeCode && leave.employeeCode !== leave.employeeId ? ` · ${leave.employeeCode}` : ""}
                </p>
              </div>
              <Badge dot variant={leave.status === "Approved" ? "success" : leave.status === "Pending" ? "warning" : "destructive"}>
                {leave.status}
              </Badge>
            </div>

            <div className="flex items-center gap-4 rounded-xl border border-border/80 bg-muted/40 p-4">
              <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl" style={{ backgroundColor: `${color}1f` }}>
                <span className="h-3 w-3 rounded-full" style={{ backgroundColor: color }} />
              </span>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold">{leave.type}</p>
                <p className="text-sm text-muted-foreground tabular">{formatDisplayRange(leave.startDate, leave.endDate)}</p>
              </div>
              <div className="text-right">
                <p className="font-display text-2xl font-semibold leading-none tracking-[-0.03em] tabular">{leave.duration}</p>
                <p className="text-xs text-muted-foreground">{leave.duration === 1 ? "day" : "days"}</p>
              </div>
            </div>

            <dl className="grid gap-4 sm:grid-cols-2">
              <Field label="Start">{formatDisplayDate(leave.startDate, { weekday: true })}</Field>
              <Field label="End">{formatDisplayDate(leave.endDate, { weekday: true })}</Field>
              <Field label="Recorded">{leave.submittedDate ? formatDisplayDate(leave.submittedDate) : "—"}</Field>
              <Field label="Added by">{leave.addedBy || "System"}</Field>
              {leave.remaining !== undefined && leave.remaining !== null && (
                <Field label="Balance after">{plural(leave.remaining, "day")}</Field>
              )}
            </dl>

            {leave.reason && (
              <div className="space-y-1.5">
                <p className="text-xs font-semibold text-muted-foreground">Reason</p>
                <p className="rounded-xl bg-muted/50 px-4 py-3 text-sm leading-relaxed">{leave.reason}</p>
              </div>
            )}
          </div>
        ) : (
          <EmptyState title="Leave entry not found" compact />
        )}

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Close
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
