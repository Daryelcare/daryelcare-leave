"use client"

import { useState } from "react"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { useQuery } from "@tanstack/react-query"
import { fetchWithAuth, handleApiError } from "@/lib/api-utils"
import { Skeleton } from "@/components/ui/skeleton"
import { Badge } from "@/components/ui/badge"
import { cn } from "@/lib/utils"
import { Download, FileSpreadsheet, FileText, HelpCircle } from "lucide-react"
import type { LeaveRequest } from "@/lib/types"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"
import { useToast } from "@/components/ui/use-toast"
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"
import { Label } from "@/components/ui/label"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip"

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
  const [dateFilterMode, setDateFilterMode] = useState<string>("overlap")
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
        title: "Export Successful",
        description: `Your ${exportFormat.toUpperCase()} file has been downloaded.`,
      })
    } catch (error) {
      toast({
        title: "Export Failed",
        description: "There was an error exporting the data. Please try again.",
        variant: "destructive",
      })
      console.error("Export error:", error)
    } finally {
      setIsExporting(false)
    }
  }

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[700px]">
        <DialogHeader>
          <div className="flex justify-between items-center">
            <DialogTitle>Leave History - {employeeName}</DialogTitle>
          </div>
        </DialogHeader>

        {isLoading ? (
          <div className="space-y-4">
            <Skeleton className="h-12 w-full" />
            <Skeleton className="h-12 w-full" />
            <Skeleton className="h-12 w-full" />
          </div>
        ) : isError ? (
          <div className="text-destructive">Error loading leave history: {handleApiError(error)}</div>
        ) : leaveRequests.length > 0 ? (
          <div className="space-y-4">
            <div className="flex items-center gap-2">
              <div className="text-sm font-medium">Date Filter Mode</div>
              <TooltipProvider delayDuration={0}>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button variant="ghost" size="icon" className="h-5 w-5 rounded-full p-0">
                      <HelpCircle className="h-4 w-4" />
                      <span className="sr-only">Date filter mode help</span>
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent side="right" align="start" className="max-w-xs">
                    <div className="space-y-2 text-sm">
                      <p>
                        <strong>Overlapping:</strong> Includes leaves that overlap with the selected period (e.g., a
                        leave from 01/04 to 20/04 will be included when filtering for 03/04 to 30/04).
                      </p>
                      <p>
                        <strong>Restrictive:</strong> Only includes leaves that fall completely within the selected
                        period.
                      </p>
                    </div>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            </div>
            <RadioGroup
              defaultValue="overlap"
              value={dateFilterMode}
              onValueChange={setDateFilterMode}
              className="flex space-x-4 mb-4"
            >
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="overlap" id="overlap-employee" />
                <Label htmlFor="overlap-employee">Overlapping</Label>
              </div>
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="restrictive" id="restrictive-employee" />
                <Label htmlFor="restrictive-employee">Restrictive</Label>
              </div>
            </RadioGroup>

            <div className="flex justify-end mb-4">
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline" size="sm" className="gap-2" disabled={isExporting}>
                    <Download className="h-4 w-4" />
                    Export
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem onClick={() => handleExport("csv")} disabled={isExporting}>
                    <FileText className="h-4 w-4 mr-2" />
                    Export as CSV
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => handleExport("excel")} disabled={isExporting}>
                    <FileSpreadsheet className="h-4 w-4 mr-2" />
                    Export as Excel
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full border-collapse">
                <thead>
                  <tr className="border-b">
                    <th className="py-2 px-4 text-left">Type</th>
                    <th className="py-2 px-4 text-left">Start Date</th>
                    <th className="py-2 px-4 text-left">End Date</th>
                    <th className="py-2 px-4 text-left">Duration</th>
                    <th className="py-2 px-4 text-left">Status</th>
                    <th className="py-2 px-4 text-left">Submitted</th>
                  </tr>
                </thead>
                <tbody>
                  {leaveRequests.map((leave) => (
                    <tr key={leave.id} className="border-b hover:bg-muted/50">
                      <td className="py-2 px-4">{leave.type}</td>
                      <td className="py-2 px-4">{leave.startDate}</td>
                      <td className="py-2 px-4">{leave.endDate}</td>
                      <td className="py-2 px-4">{leave.duration} days</td>
                      <td className="py-2 px-4">
                        <Badge
                          className={cn(
                            "text-white",
                            leave.status === "Approved"
                              ? "bg-green-500 hover:bg-green-600"
                              : leave.status === "Pending"
                                ? "bg-yellow-500 hover:bg-yellow-600"
                                : "bg-red-500 hover:bg-red-600",
                          )}
                        >
                          {leave.status}
                        </Badge>
                      </td>
                      <td className="py-2 px-4">{leave.submittedDate}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        ) : (
          <div className="text-center py-8 text-muted-foreground">No leave history found for this employee</div>
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
