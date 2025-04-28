"use client"

import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { useQuery } from "@tanstack/react-query"
import { fetchWithAuth, handleApiError } from "@/lib/api-utils"
import { Skeleton } from "@/components/ui/skeleton"
import { Badge } from "@/components/ui/badge"
import { cn } from "@/lib/utils"
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

  const getStatusColor = (status: string) => {
    switch (status) {
      case "Approved":
        return "bg-green-500 hover:bg-green-600"
      case "Pending":
        return "bg-yellow-500 hover:bg-yellow-600"
      case "Rejected":
        return "bg-red-500 hover:bg-red-600"
      default:
        return "bg-gray-500 hover:bg-gray-600"
    }
  }

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[550px]">
        <DialogHeader>
          <DialogTitle>Leave Request Details</DialogTitle>
        </DialogHeader>

        {isLoading ? (
          <div className="space-y-4">
            <Skeleton className="h-8 w-3/4" />
            <Skeleton className="h-6 w-1/2" />
            <Skeleton className="h-6 w-2/3" />
            <Skeleton className="h-6 w-1/2" />
            <Skeleton className="h-6 w-3/4" />
          </div>
        ) : isError ? (
          <div className="text-destructive">Error loading leave details: {handleApiError(error)}</div>
        ) : leave ? (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1">
                <p className="text-sm font-medium text-muted-foreground">Employee</p>
                <p className="font-medium">{leave.employee}</p>
              </div>
              <div className="space-y-1">
                <p className="text-sm font-medium text-muted-foreground">Employee Code</p>
                <p>{leave.employeeCode}</p>
              </div>
              <div className="space-y-1">
                <p className="text-sm font-medium text-muted-foreground">Employee ID</p>
                <p>{leave.employeeId}</p>
              </div>
              <div className="space-y-1">
                <p className="text-sm font-medium text-muted-foreground">Branch</p>
                <p>{leave.branch}</p>
              </div>
              <div className="space-y-1">
                <p className="text-sm font-medium text-muted-foreground">Type</p>
                <p>{leave.type}</p>
              </div>
              <div className="space-y-1">
                <p className="text-sm font-medium text-muted-foreground">Start Date</p>
                <p>{leave.startDate}</p>
              </div>
              <div className="space-y-1">
                <p className="text-sm font-medium text-muted-foreground">End Date</p>
                <p>{leave.endDate}</p>
              </div>
              <div className="space-y-1">
                <p className="text-sm font-medium text-muted-foreground">Duration</p>
                <p>{leave.duration} days</p>
              </div>
              <div className="space-y-1">
                <p className="text-sm font-medium text-muted-foreground">Remaining</p>
                <p>{leave.remaining} days</p>
              </div>
              <div className="space-y-1">
                <p className="text-sm font-medium text-muted-foreground">Status</p>
                <Badge className={cn("text-white", getStatusColor(leave.status))}>{leave.status}</Badge>
              </div>
              <div className="space-y-1">
                <p className="text-sm font-medium text-muted-foreground">Submitted Date</p>
                <p>{leave.submittedDate}</p>
              </div>
              <div className="space-y-1">
                <p className="text-sm font-medium text-muted-foreground">Added By</p>
                <p>{leave.addedBy || "System"}</p>
              </div>
            </div>

            {leave.reason && (
              <div className="space-y-1">
                <p className="text-sm font-medium text-muted-foreground">Reason</p>
                <p className="text-sm">{leave.reason}</p>
              </div>
            )}
          </div>
        ) : (
          <div className="text-muted-foreground">No leave request data found</div>
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
