"use client"

import { useState, useEffect } from "react"
import { useQuery, useQueryClient } from "@tanstack/react-query"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Badge } from "@/components/ui/badge"
import { X, Eye, Trash2, Plus, FileSpreadsheet, FileText, Loader2, ArrowUpDown, ArrowUp, ArrowDown } from "lucide-react"
import { Skeleton } from "@/components/ui/skeleton"
import { useToast } from "@/components/ui/use-toast"
import { fetchWithAuth, handleApiError } from "@/lib/api-utils"
import { cn } from "@/lib/utils"
import { useBranches } from "@/hooks/use-branches"
import { useLeaveTypes } from "@/hooks/use-leave-types"
import { DeleteConfirmationDialog } from "./delete-confirmation-dialog"
import { LeaveDetailsModal } from "./leave-details-modal"
import { AddLeaveModal } from "./add-leave-modal"
import type { LeaveRequest } from "@/lib/types"
import { useApp } from "./app-provider"

export function LeaveManagementTable() {
  const [employeeSearch, setEmployeeSearch] = useState("")
  const [selectedType, setSelectedType] = useState<string>("all")
  const [debouncedEmployeeSearch, setDebouncedEmployeeSearch] = useState("")
  const [debouncedBranch, setDebouncedBranch] = useState<string>("all")
  const [debouncedType, setDebouncedType] = useState<string>("all")

  const [sortColumn, setSortColumn] = useState<string | null>("submittedDate")
  const [sortDirection, setSortDirection] = useState<"asc" | "desc">("desc")

  const [isAddModalOpen, setIsAddModalOpen] = useState(false)
  const [isDetailsModalOpen, setIsDetailsModalOpen] = useState(false)
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false)
  const [selectedLeaveId, setSelectedLeaveId] = useState<string | null>(null)
  const [leaveToDelete, setLeaveToDelete] = useState<LeaveRequest | null>(null)
  const [isExporting, setIsExporting] = useState(false)
  const [exportFormat, setExportFormat] = useState<string | null>(null)

  const { toast } = useToast()
  const queryClient = useQueryClient()
  const {
    data: branches = [],
    isLoading: isLoadingBranches,
    isError: isBranchesError,
    error: branchesError,
  } = useBranches()

  const {
    data: leaveTypes = [],
    isLoading: isLoadingLeaveTypes,
    isError: isLeaveTypesError,
    error: leaveTypesError,
  } = useLeaveTypes()

  const { user } = useApp()
  const isAdmin = user?.role === "admin"

  const [selectedBranch, setSelectedBranch] = useState<string>(
    !isAdmin && user?.branches && user.branches.length === 1 ? user.branches[0] : "all",
  )

  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedEmployeeSearch(employeeSearch)
    }, 300)
    return () => clearTimeout(timer)
  }, [employeeSearch])

  useEffect(() => {
    setDebouncedBranch(selectedBranch)
  }, [selectedBranch])

  useEffect(() => {
    setDebouncedType(selectedType)
  }, [selectedType])

  const handleSort = (column: string) => {
    if (sortColumn === column) {
      setSortDirection(sortDirection === "asc" ? "desc" : "asc")
    } else {
      setSortColumn(column)
      setSortDirection("asc")
    }
  }

  const {
    data: leaveRequests = [],
    isLoading,
    isError,
    error,
    refetch,
  } = useQuery<LeaveRequest[]>({
    queryKey: ["leaveRequests", debouncedBranch, debouncedType, debouncedEmployeeSearch, sortColumn, sortDirection],
    queryFn: async () => {
      const params = new URLSearchParams()

      if (debouncedBranch !== "all") {
        params.append("branch", debouncedBranch)
      }
      else if (!isAdmin && user?.branches && user.branches.length > 0) {
        if (user.branches.length === 1) {
          params.append("branch", user.branches[0])
        }
        else {
          params.append("branches", user.branches.join(","))
        }
      }

      if (debouncedType !== "all") {
        params.append("type", debouncedType)
      }
      if (debouncedEmployeeSearch) {
        params.append("employee", debouncedEmployeeSearch)
      }
      if (sortColumn) {
        params.append("sortColumn", sortColumn)
        params.append("sortDirection", sortDirection)
      }
      return fetchWithAuth(`/api/leave-requests?${params.toString()}`)
    },
  })

  const deleteLeaveRequest = async (id: string) => {
    try {
      await fetchWithAuth(`/api/leave-requests/${id}`, {
        method: "DELETE",
      })

      toast({
        title: "Success",
        description: "Leave request deleted successfully",
      })

      queryClient.invalidateQueries({ queryKey: ["leaveRequests"] })
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to delete leave request. Please try again.",
        variant: "destructive",
      })
    }
  }

  const handleViewDetails = (leaveId: string) => {
    setSelectedLeaveId(leaveId)
    setIsDetailsModalOpen(true)
  }

  const handleDeleteLeaveRequest = (leave: LeaveRequest) => {
    setLeaveToDelete(leave)
    setIsDeleteDialogOpen(true)
  }

  const confirmDeleteLeaveRequest = () => {
    if (leaveToDelete) {
      deleteLeaveRequest(leaveToDelete.id)
      setIsDeleteDialogOpen(false)
      setLeaveToDelete(null)
    }
  }

  const handleExport = async (format: string) => {
    setIsExporting(true)
    setExportFormat(format)

    try {
      const formData = new FormData()
      formData.append("format", format)
      formData.append("branch", selectedBranch)
      formData.append("type", selectedType)
      formData.append("employee", employeeSearch)
      formData.append("exportAll", "true")

      if (sortColumn) {
        formData.append("sortColumn", sortColumn)
        formData.append("sortDirection", sortDirection)
      }

      const response = await fetch("/api/export/leave-requests", {
        method: "POST",
        body: formData,
      })

      if (!response.ok) {
        throw new Error(`Export failed with status ${response.status}`)
      }

      let filename = `leave-requests.${format === "csv" ? "csv" : "xlsx"}`
      const contentDisposition = response.headers.get("Content-Disposition")
      if (contentDisposition) {
        const filenameMatch = contentDisposition.match(/filename="(.+)"/)
        if (filenameMatch && filenameMatch[1]) {
          filename = filenameMatch[1]
        }
      }

      const blob = await response.blob()

      const url = window.URL.createObjectURL(blob)
      const a = document.createElement("a")
      a.style.display = "none"
      a.href = url
      a.download = filename
      document.body.appendChild(a)
      a.click()

      window.URL.revokeObjectURL(url)
      document.body.removeChild(a)

      toast({
        title: "Export Successful",
        description: `Your ${format.toUpperCase()} file has been downloaded.`,
      })
    } catch (error) {
      console.error("Export error:", error)
      toast({
        title: "Export Failed",
        description: "There was an error exporting the data. Please try again.",
        variant: "destructive",
      })
    } finally {
      setIsExporting(false)
      setExportFormat(null)
    }
  }

  const resetFilters = () => {
    setEmployeeSearch("")
    setSelectedBranch("all")
    setSelectedType("all")
    setSortColumn("submittedDate")
    setSortDirection("desc")
  }

  const renderSortIndicator = (column: string) => {
    if (sortColumn !== column) {
      return <ArrowUpDown className="ml-2 h-4 w-4" />
    }
    return sortDirection === "asc" ? <ArrowUp className="ml-2 h-4 w-4" /> : <ArrowDown className="ml-2 h-4 w-4" />
  }

  if (isError) {
    return (
      <div className="rounded-md bg-destructive/15 p-4 text-destructive">
        <p>Error loading leave requests: {handleApiError(error)}</p>
        <Button variant="outline" size="sm" onClick={() => refetch()} className="mt-2">
          Try Again
        </Button>
      </div>
    )
  }

  if (isBranchesError) {
    return (
      <div className="rounded-md bg-destructive/15 p-4 text-destructive">
        <p>Error loading branches: {handleApiError(branchesError)}</p>
        <div className="mt-2 text-sm">
          <p>Please ensure that:</p>
          <ul className="list-disc pl-5 mt-1">
            <li>The Supabase integration is properly set up</li>
            <li>The branches table exists in your database</li>
            <li>The API route is correctly configured</li>
          </ul>
        </div>
        <Button variant="outline" size="sm" onClick={() => window.location.reload()} className="mt-2">
          Try Again
        </Button>
      </div>
    )
  }

  if (isLeaveTypesError) {
    return (
      <div className="rounded-md bg-destructive/15 p-4 text-destructive">
        <p>Error loading leave types: {handleApiError(leaveTypesError)}</p>
        <div className="mt-2 text-sm">
          <p>Please ensure that:</p>
          <ul className="list-disc pl-5 mt-1">
            <li>The Supabase integration is properly set up</li>
            <li>The leave_types table exists in your database</li>
            <li>The API route is correctly configured</li>
          </ul>
        </div>
        <Button variant="outline" size="sm" onClick={() => window.location.reload()} className="mt-2">
          Try Again
        </Button>
      </div>
    )
  }

  const isMockData = branches.length > 0 && branches[0].id === "1" && branches[0].name === "London"

  return (
    <div className="space-y-6">
      {isMockData && (
        <div className="rounded-md bg-yellow-50 p-4 text-yellow-800 border border-yellow-200">
          <p className="font-medium">Using mock branch data</p>
          <p className="text-sm mt-1">
            Supabase environment variables are missing. To use real data, please set up the Supabase integration.
          </p>
        </div>
      )}

      <div className="flex justify-between items-center">
        <h2 className="text-xl font-semibold">Leave Requests</h2>
        <div className="flex gap-2">
          <div className="flex gap-2">
            <Button variant="outline" className="gap-2" onClick={() => handleExport("csv")} disabled={isExporting}>
              {isExporting && exportFormat === "csv" ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Exporting CSV...
                </>
              ) : (
                <>
                  <FileText className="h-4 w-4" />
                  Export CSV
                </>
              )}
            </Button>

            <Button variant="outline" className="gap-2" onClick={() => handleExport("excel")} disabled={isExporting}>
              {isExporting && exportFormat === "excel" ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Exporting Excel...
                </>
              ) : (
                <>
                  <FileSpreadsheet className="h-4 w-4" />
                  Export Excel
                </>
              )}
            </Button>
          </div>

          {(user?.role === "admin" || (user?.role === "normal" && user?.branches && user?.branches.length > 0)) && (
            <Button
              className="gap-2 bg-gradient-to-r from-purple-600 to-blue-500 hover:from-purple-700 hover:to-blue-600"
              onClick={() => setIsAddModalOpen(true)}
            >
              <Plus className="h-4 w-4" />
              Add Leave Request
            </Button>
          )}
        </div>
      </div>

      <div className="grid gap-6 md:grid-cols-3">
        <div className="space-y-2">
          <label className="text-sm font-medium">Search employee name</label>
          <Input
            placeholder="Employee name"
            value={employeeSearch}
            onChange={(e) => setEmployeeSearch(e.target.value)}
          />
        </div>
        <div className="space-y-2">
          <label className="text-sm font-medium">Branch</label>
          <Select value={selectedBranch} onValueChange={setSelectedBranch} disabled={isLoadingBranches}>
            <SelectTrigger>
              <SelectValue placeholder="All Branches" />
            </SelectTrigger>
            <SelectContent>
              {(isAdmin || (user?.branches && user.branches.length > 1)) && (
                <SelectItem value="all">All Branches</SelectItem>
              )}
              {branches
                .filter((branch) => isAdmin || (user?.branches && user.branches.includes(branch.name)))
                .map((branch) => (
                  <SelectItem key={branch.id} value={branch.name}>
                    {branch.name}
                  </SelectItem>
                ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-2">
          <label className="text-sm font-medium">Leave Type</label>
          <Select value={selectedType} onValueChange={setSelectedType} disabled={isLoadingLeaveTypes}>
            <SelectTrigger>
              <SelectValue placeholder="All Types" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Types</SelectItem>
              {leaveTypes.map((type) => (
                <SelectItem key={type.id} value={type.name}>
                  {type.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="flex gap-2">
        <Button variant="outline" onClick={resetFilters} disabled={isLoading}>
          <X className="mr-2 h-4 w-4" />
          Reset Filters
        </Button>
      </div>

      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>
                <Button variant="ghost" onClick={() => handleSort("employee")} className="flex items-center">
                  Employee
                  {renderSortIndicator("employee")}
                </Button>
              </TableHead>
              <TableHead>
                <Button variant="ghost" onClick={() => handleSort("branch")} className="flex items-center">
                  Branch
                  {renderSortIndicator("branch")}
                </Button>
              </TableHead>
              <TableHead>
                <Button variant="ghost" onClick={() => handleSort("type")} className="flex items-center">
                  Type
                  {renderSortIndicator("type")}
                </Button>
              </TableHead>
              <TableHead>
                <Button variant="ghost" onClick={() => handleSort("startDate")} className="flex items-center">
                  Dates
                  {renderSortIndicator("startDate")}
                </Button>
              </TableHead>
              <TableHead>
                <Button variant="ghost" onClick={() => handleSort("duration")} className="flex items-center">
                  Duration
                  {renderSortIndicator("duration")}
                </Button>
              </TableHead>
              <TableHead>
                <Button variant="ghost" onClick={() => handleSort("remaining")} className="flex items-center">
                  Remaining
                  {renderSortIndicator("remaining")}
                </Button>
              </TableHead>
              <TableHead>
                <Button variant="ghost" onClick={() => handleSort("status")} className="flex items-center">
                  Status
                  {renderSortIndicator("status")}
                </Button>
              </TableHead>
              <TableHead>Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              Array.from({ length: 3 }).map((_, index) => (
                <TableRow key={index}>
                  <TableCell>
                    <Skeleton className="h-6 w-32" />
                  </TableCell>
                  <TableCell>
                    <Skeleton className="h-6 w-20" />
                  </TableCell>
                  <TableCell>
                    <Skeleton className="h-6 w-20" />
                  </TableCell>
                  <TableCell>
                    <Skeleton className="h-6 w-40" />
                  </TableCell>
                  <TableCell>
                    <Skeleton className="h-6 w-16" />
                  </TableCell>
                  <TableCell>
                    <Skeleton className="h-6 w-16" />
                  </TableCell>
                  <TableCell>
                    <Skeleton className="h-6 w-24" />
                  </TableCell>
                  <TableCell>
                    <Skeleton className="h-6 w-24" />
                  </TableCell>
                </TableRow>
              ))
            ) : leaveRequests.length > 0 ? (
              leaveRequests.map((row) => (
                <TableRow key={row.id}>
                  <TableCell>
                    <div className="font-medium">{row.employee}</div>
                    <div className="text-sm text-muted-foreground">{row.employeeCode || "N/A"}</div>
                  </TableCell>
                  <TableCell>{row.branch}</TableCell>
                  <TableCell>{row.type}</TableCell>
                  <TableCell>
                    {row.startDate} - {row.endDate}
                  </TableCell>
                  <TableCell>{row.duration} days</TableCell>
                  <TableCell>{row.remaining} days</TableCell>
                  <TableCell>
                    <Badge
                      className={cn(
                        "text-white",
                        row.status === "Approved"
                          ? "bg-green-500 hover:bg-green-600"
                          : row.status === "Pending"
                            ? "bg-yellow-500 hover:bg-yellow-600"
                            : "bg-red-500 hover:bg-red-600",
                      )}
                    >
                      {row.status}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <div className="flex space-x-2">
                      <Button variant="ghost" size="sm" onClick={() => handleViewDetails(row.id)}>
                        <Eye className="h-4 w-4 mr-1" />
                        View
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="text-destructive"
                        onClick={() => handleDeleteLeaveRequest(row)}
                      >
                        <Trash2 className="h-4 w-4 mr-1" />
                        Delete
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))
            ) : (
              <TableRow>
                <TableCell colSpan={8} className="h-24 text-center">
                  No leave requests found.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>

      <AddLeaveModal open={isAddModalOpen} onOpenChange={setIsAddModalOpen} />

      {selectedLeaveId && (
        <LeaveDetailsModal
          leaveId={selectedLeaveId}
          isOpen={isDetailsModalOpen}
          onClose={() => setIsDetailsModalOpen(false)}
        />
      )}

      <DeleteConfirmationDialog
        isOpen={isDeleteDialogOpen}
        onClose={() => setIsDeleteDialogOpen(false)}
        onConfirm={confirmDeleteLeaveRequest}
        title="Delete Leave Request"
        description={`Are you sure you want to delete this leave request for ${leaveToDelete?.employee}? This action cannot be undone.`}
        confirmLabel="Delete"
        cancelLabel="Cancel"
      />
    </div>
  )
}
