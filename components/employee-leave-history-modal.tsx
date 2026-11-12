"use client"

import { useState } from "react"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { useQuery } from "@tanstack/react-query"
import { fetchWithAuth, handleApiError } from "@/lib/api-utils"
import { Skeleton } from "@/components/ui/skeleton"
import { Badge } from "@/components/ui/badge"
import { CalendarDays, Download, FileSpreadsheet, FileText, Loader2 } from "lucide-react"
import { useLeaveTypes } from "@/hooks/use-leave-types"
import { formatDisplayRange } from "@/lib/dates"
import { EmptyState, ErrorState, plural } from "./page-kit"
import type { LeaveRequest } from "@/lib/types"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"
import { useToast } from "@/components/ui/use-toast"

interface EmployeeLeaveHistoryModalProps {
  employeeId: string
  employeeName: string
  isOpen: boolean
  onClose: () => void
}

export function EmployeeLeaveHistoryModal({
  employeeId,
  employeeName,
  isOpen,
  onClose,
}: EmployeeLeaveHistoryModalProps) {
  const [isExporting, setIsExporting] = useState(false)
  // Only used in the export file name: this dialog has no date range
  const dateFilterMode = "overlap"
  const { toast } = useToast()

  const {
    data: leaveRequests = [],
    isLoading,
    isError,
    error,
  } = useQuery<LeaveRequest[]>({
    queryKey: ["employeeLeaves", employeeId],
    queryFn: async () => {
      return fetchWithAuth(`/api/leave-requests?employeeId=${employeeId}`)
    },
    enabled: isOpen && !!employeeId,
  })

  // Handle export
  const handleExport = async (exportFormat: string) => {
    setIsExporting(true)

    try {
      // Create form data with employee filter
      const formData = new FormData()
      formData.append("format", exportFormat)
      formData.append("employeeId", employeeId)
      formData.append("dateFilterMode", dateFilterMode)

      // Use fetch directly to download the file
      const response = await fetch("/api/export/leave-requests", {
        method: "POST",
        body: formData,
      })

      if (!response.ok) {
        throw new Error("Export failed")
      }

      // Get the filename from the Content-Disposition header if available
      let filename = `leave-history-${employeeId}.${exportFormat === "csv" ? "csv" : "xls"}`
      const contentDisposition = response.headers.get("Content-Disposition")
      if (contentDisposition) {
        const filenameMatch = contentDisposition.match(/filename="(.+)"/)
        if (filenameMatch && filenameMatch[1]) {
          filename = filenameMatch[1]
        }
      }

      // Create a blob from the response
      const blob = await response.blob()

      // Create a download link and trigger the download
      const url = window.URL.createObjectURL(blob)
      const a = document.createElement("a")
      a.style.display = "none"
      a.href = url
      a.download = filename
      document.body.appendChild(a)
      a.click()

      // Clean up
      window.URL.revokeObjectURL(url)
      document.body.removeChild(a)

      toast({
        title: "Export ready",
        description: `Your ${exportFormat.toUpperCase()} file has been downloaded.`,
      })
    } catch (error) {
      toast({
        title: "Export failed",
        description: "There was an error exporting the data. Please try again.",
        variant: "destructive",
      })
      console.error("Export error:", error)
    } finally {
      setIsExporting(false)
    }
  }

  const { data: leaveTypes = [] } = useLeaveTypes()
  const typeColor = (type: string) => leaveTypes.find((t) => t.name === type)?.color || "#64748b"
  const totalDays = leaveRequests.filter((l) => l.status === "Approved").reduce((sum, l) => sum + (l.duration || 0), 0)

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[600px]">
        <DialogHeader>
          <DialogTitle>Leave history</DialogTitle>
          <DialogDescription>
            {employeeName}
            {!isLoading && leaveRequests.length > 0 && ` · ${plural(leaveRequests.length, "entry", "entries")} · ${plural(totalDays, "day")} approved`}
          </DialogDescription>
        </DialogHeader>

        {isLoading ? (
          <div className="space-y-2">
            {[0, 1, 2].map((i) => (
              <Skeleton key={i} className="h-16 w-full rounded-xl" />
            ))}
          </div>
        ) : isError ? (
          <ErrorState title="Couldn't load leave history" message={handleApiError(error)} />
        ) : leaveRequests.length > 0 ? (
          <ul className="divide-y divide-border/70 overflow-hidden rounded-xl border border-border/80">
            {leaveRequests.map((leave) => (
              <li key={leave.id} className="flex items-center gap-3 px-4 py-3">
                <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ backgroundColor: typeColor(leave.type) }} aria-hidden />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold">{leave.type}</p>
                  <p className="text-xs text-muted-foreground tabular">
                    {formatDisplayRange(leave.startDate, leave.endDate)} · {plural(leave.duration, "day")}
                  </p>
                </div>
                <Badge dot variant={leave.status === "Approved" ? "success" : leave.status === "Pending" ? "warning" : "destructive"}>
                  {leave.status}
                </Badge>
              </li>
            ))}
          </ul>
        ) : (
          <EmptyState icon={CalendarDays} title="No leave recorded" description="Leave added for this employee will appear here." compact />
        )}

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Close
          </Button>
          {leaveRequests.length > 0 && (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button disabled={isExporting}>
                  {isExporting ? <Loader2 className="animate-spin" /> : <Download />}
                  Export
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={() => handleExport("csv")} disabled={isExporting}>
                  <FileText />
                  CSV file
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => handleExport("excel")} disabled={isExporting}>
                  <FileSpreadsheet />
                  Excel workbook
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
