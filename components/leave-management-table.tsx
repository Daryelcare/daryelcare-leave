"use client"

import { useState, useEffect } from "react"
import { useQuery, useQueryClient } from "@tanstack/react-query"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Badge } from "@/components/ui/badge"
import {
  AlertTriangle,
  ArrowDown,
  ArrowUp,
  ArrowUpDown,
  CalendarDays,
  Download,
  Eye,
  FileSpreadsheet,
  FileText,
  Loader2,
  MoreHorizontal,
  Pencil,
  Plus,
  Search,
  Trash2,
  X,
} from "lucide-react"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { formatDisplayRange } from "@/lib/dates"
import { Avatar, EmptyState, ErrorState, ListSkeleton, PageHeader, Toolbar, plural } from "./page-kit"
import { Skeleton } from "@/components/ui/skeleton"
import { useToast } from "@/components/ui/use-toast"
import { fetchWithAuth, handleApiError } from "@/lib/api-utils"
import { cn } from "@/lib/utils"
import { useBranches } from "@/hooks/use-branches"
import { useLeaveTypes } from "@/hooks/use-leave-types"
import { DeleteConfirmationDialog } from "./delete-confirmation-dialog"
import { LeaveDetailsModal } from "./leave-details-modal"
import { AddLeaveModal } from "./add-leave-modal"
import { EditLeaveModal } from "./edit-leave-modal"
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
  const [leaveToEdit, setLeaveToEdit] = useState<LeaveRequest | null>(null)
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
      queryClient.invalidateQueries({ queryKey: ["employees"] })
      queryClient.invalidateQueries({ queryKey: ["dashboard"] })
      queryClient.invalidateQueries({ queryKey: ["leave-calendar"] })
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

  const typeColor = (type: string) => leaveTypes.find((t) => t.name === type)?.color || "#64748b"
  const canAdd = user?.role === "admin" || (user?.role === "normal" && user?.branches && user?.branches.length > 0)
  const filtersActive = employeeSearch !== "" || selectedType !== "all" || (isAdmin && selectedBranch !== "all")

  const statusBadge = (status: string) => (
    <Badge dot variant={status === "Approved" ? "success" : status === "Pending" ? "warning" : "destructive"}>
      {status}
    </Badge>
  )

  const sortHeader = (label: string, column: string, className?: string) => (
    <TableHead className={className}>
      <button
        onClick={() => handleSort(column)}
        className={cn("inline-flex items-center gap-1 transition-colors hover:text-foreground", sortColumn === column && "text-foreground")}
      >
        {label}
        {sortColumn !== column ? (
          <ArrowUpDown className="h-3.5 w-3.5 opacity-40" />
        ) : sortDirection === "asc" ? (
          <ArrowUp className="h-3.5 w-3.5" />
        ) : (
          <ArrowDown className="h-3.5 w-3.5" />
        )}
      </button>
    </TableHead>
  )

  const rowActions = (row: LeaveRequest) => (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" className="h-8 w-8" onClick={(e) => e.stopPropagation()}>
          <span className="sr-only">Actions for {row.employee}</span>
          <MoreHorizontal />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" onClick={(e) => e.stopPropagation()}>
        <DropdownMenuItem onClick={() => handleViewDetails(row.id)}>
          <Eye />
          View details
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => setLeaveToEdit(row)}>
          <Pencil />
          Edit
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem
          className="text-destructive focus:text-destructive [&_svg]:!text-destructive"
          onClick={() => handleDeleteLeaveRequest(row)}
        >
          <Trash2 />
          Delete
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )

  const isMockData = branches.length > 0 && branches[0].id === "1" && branches[0].name === "London"

  return (
    <div className="space-y-6 sm:space-y-8">
      <PageHeader
        title="Leave"
        description={isAdmin ? "Every leave entry across your organisation." : "Leave for employees in your branches."}
        actions={
          <>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" disabled={isExporting}>
                  {isExporting ? <Loader2 className="animate-spin" /> : <Download />}
                  {isExporting ? `Exporting ${exportFormat === "csv" ? "CSV" : "Excel"}…` : "Export"}
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={() => handleExport("csv")}>
                  <FileText />
                  CSV file
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => handleExport("excel")}>
                  <FileSpreadsheet />
                  Excel workbook
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
            {canAdd && (
              <Button onClick={() => setIsAddModalOpen(true)}>
                <Plus />
                Add leave
              </Button>
            )}
          </>
        }
      />

      {isMockData && (
        <Alert variant="warning">
          <AlertTriangle />
          <AlertTitle>Using mock branch data</AlertTitle>
          <AlertDescription>Supabase environment variables are missing. Set up the Supabase integration to use real data.</AlertDescription>
        </Alert>
      )}
      {isError && <ErrorState title="Couldn't load leave" message={handleApiError(error)} onRetry={() => refetch()} />}
      {isBranchesError && <ErrorState title="Couldn't load branches" message={handleApiError(branchesError)} onRetry={() => window.location.reload()} />}
      {isLeaveTypesError && (
        <ErrorState title="Couldn't load leave types" message={handleApiError(leaveTypesError)} onRetry={() => window.location.reload()} />
      )}

      <div className="surface overflow-hidden">
        <Toolbar className="border-b border-border/70 p-3 sm:p-4">
          <div className="relative flex-1 sm:max-w-xs">
            <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Search employee"
              aria-label="Search employee name"
              className="pl-10"
              value={employeeSearch}
              onChange={(e) => setEmployeeSearch(e.target.value)}
            />
          </div>
          <div className="grid grid-cols-2 gap-2.5 sm:flex">
            <Select value={selectedBranch} onValueChange={setSelectedBranch} disabled={isLoadingBranches}>
              <SelectTrigger className="sm:w-[180px]" aria-label="Branch">
                <SelectValue placeholder="All branches" />
              </SelectTrigger>
              <SelectContent>
                {(isAdmin || (user?.branches && user.branches.length > 1)) && <SelectItem value="all">All branches</SelectItem>}
                {branches
                  .filter((branch) => isAdmin || (user?.branches && user.branches.includes(branch.name)))
                  .map((branch) => (
                    <SelectItem key={branch.id} value={branch.name}>
                      {branch.name}
                    </SelectItem>
                  ))}
              </SelectContent>
            </Select>
            <Select value={selectedType} onValueChange={setSelectedType} disabled={isLoadingLeaveTypes}>
              <SelectTrigger className="sm:w-[180px]" aria-label="Leave type">
                <SelectValue placeholder="All types" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All types</SelectItem>
                {leaveTypes.map((type) => (
                  <SelectItem key={type.id} value={type.name}>
                    {type.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          {filtersActive && (
            <Button variant="ghost" onClick={resetFilters} disabled={isLoading} className="sm:ml-auto">
              <X />
              Clear filters
            </Button>
          )}
        </Toolbar>

        {/* Desktop and tablet: table */}
        <div className="hidden md:block">
          <Table>
            <TableHeader>
              <TableRow className="hover:bg-transparent">
                {sortHeader("Employee", "employee")}
                {sortHeader("Type", "type")}
                {sortHeader("Dates", "startDate")}
                {sortHeader("Days", "duration", "text-right")}
                {sortHeader("Balance after", "remaining", "hidden text-right lg:table-cell")}
                {sortHeader("Status", "status")}
                <TableHead className="w-12">
                  <span className="sr-only">Actions</span>
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                Array.from({ length: 6 }).map((_, index) => (
                  <TableRow key={index} className="hover:bg-transparent">
                    <TableCell colSpan={7} className="py-3">
                      <div className="flex items-center gap-3">
                        <Skeleton className="h-9 w-9 rounded-full" />
                        <Skeleton className="h-4 w-1/5" />
                        <Skeleton className="ml-auto h-4 w-1/3" />
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              ) : leaveRequests.length > 0 ? (
                leaveRequests.map((row) => (
                  <TableRow key={row.id} className="cursor-pointer" onClick={() => handleViewDetails(row.id)}>
                    <TableCell>
                      <div className="flex items-center gap-3">
                        <Avatar name={row.employee} />
                        <div className="min-w-0">
                          <p className="truncate font-semibold text-foreground">{row.employee}</p>
                          <p className="truncate text-xs text-muted-foreground">
                            {row.branch}
                            {row.employeeCode && row.employeeCode !== row.employeeId ? ` · ${row.employeeCode}` : ""}
                          </p>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>
                      <span className="inline-flex items-center gap-2 whitespace-nowrap">
                        <span className="h-2 w-2 rounded-full" style={{ backgroundColor: typeColor(row.type) }} aria-hidden />
                        {row.type}
                      </span>
                    </TableCell>
                    <TableCell className="whitespace-nowrap tabular">{formatDisplayRange(row.startDate, row.endDate)}</TableCell>
                    <TableCell className="text-right tabular">{row.duration}</TableCell>
                    <TableCell className={cn("hidden text-right tabular lg:table-cell", (row.remaining ?? 0) < 0 && "font-semibold text-destructive")}>
                      {row.remaining ?? "—"}
                    </TableCell>
                    <TableCell>{statusBadge(row.status)}</TableCell>
                    <TableCell className="text-right" onClick={(e) => e.stopPropagation()}>
                      {rowActions(row)}
                    </TableCell>
                  </TableRow>
                ))
              ) : (
                <TableRow className="hover:bg-transparent">
                  <TableCell colSpan={7}>
                    <EmptyState
                      icon={CalendarDays}
                      title={filtersActive ? "No leave matches these filters" : "No leave recorded yet"}
                      description={filtersActive ? "Try clearing the filters." : "Add a leave entry to get started."}
                    />
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>

        {/* Phones: cards */}
        <div className="md:hidden">
          {isLoading ? (
            <ListSkeleton rows={5} />
          ) : leaveRequests.length > 0 ? (
            <ul className="divide-y divide-border/70">
              {leaveRequests.map((row) => (
                <li key={row.id} className="flex items-start gap-3 px-4 py-3.5">
                  <button className="flex min-w-0 flex-1 items-start gap-3 text-left" onClick={() => handleViewDetails(row.id)}>
                    <Avatar name={row.employee} />
                    <span className="min-w-0 flex-1 space-y-1">
                      <span className="flex items-center justify-between gap-2">
                        <span className="truncate text-[15px] font-semibold">{row.employee}</span>
                        {statusBadge(row.status)}
                      </span>
                      <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
                        <span className="h-2 w-2 shrink-0 rounded-full" style={{ backgroundColor: typeColor(row.type) }} aria-hidden />
                        <span className="truncate">
                          {row.type} · {row.branch}
                        </span>
                      </span>
                      <span className="block text-[13px] font-medium tabular">
                        {formatDisplayRange(row.startDate, row.endDate)} · {plural(row.duration, "day")}
                      </span>
                    </span>
                  </button>
                  {rowActions(row)}
                </li>
              ))}
            </ul>
          ) : (
            <EmptyState icon={CalendarDays} title={filtersActive ? "No leave matches these filters" : "No leave recorded yet"} />
          )}
        </div>

        {!isLoading && leaveRequests.length > 0 && (
          <div className="border-t border-border/70 px-4 py-3 text-sm text-muted-foreground sm:px-5">
            {plural(leaveRequests.length, "entry", "entries")}
          </div>
        )}
      </div>

      <AddLeaveModal open={isAddModalOpen} onOpenChange={setIsAddModalOpen} />

      <EditLeaveModal leave={leaveToEdit} open={!!leaveToEdit} onOpenChange={(open) => !open && setLeaveToEdit(null)} />

      {selectedLeaveId && (
        <LeaveDetailsModal leaveId={selectedLeaveId} isOpen={isDetailsModalOpen} onClose={() => setIsDetailsModalOpen(false)} />
      )}

      <DeleteConfirmationDialog
        isOpen={isDeleteDialogOpen}
        onClose={() => setIsDeleteDialogOpen(false)}
        onConfirm={confirmDeleteLeaveRequest}
        title="Delete leave entry"
        description={`Delete this ${leaveToDelete?.type ?? "leave"} entry for ${leaveToDelete?.employee}? Any days it used go back to their balance. This can't be undone.`}
        confirmLabel="Delete"
        cancelLabel="Cancel"
      />
    </div>
  )
}
