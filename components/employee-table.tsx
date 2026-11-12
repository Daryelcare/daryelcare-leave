"use client"

import { useState, useEffect } from "react"
import { keepPreviousData, useQuery, useQueryClient } from "@tanstack/react-query"
import {
  ArrowDown,
  ArrowUp,
  ArrowUpDown,
  ChevronLeft,
  ChevronRight,
  Eye,
  FileText,
  History,
  MoreHorizontal,
  Pencil,
  Plus,
  Search,
  Trash2,
  Upload,
  Users,
} from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { cn } from "@/lib/utils"
import { Avatar, EmptyState, ErrorState, ListSkeleton, PageHeader, Toolbar, plural } from "./page-kit"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Skeleton } from "@/components/ui/skeleton"
import { useToast } from "@/components/ui/use-toast"
import { fetchWithAuth, handleApiError } from "@/lib/api-utils"
import type { Employee } from "@/lib/types"
import { AddEmployeeModal } from "./add-employee-modal"
import { useBranches } from "@/hooks/use-branches"
import { DeleteConfirmationDialog } from "./delete-confirmation-dialog"
import { EmployeeDetailsModal } from "./employee-details-modal"
import { EditEmployeeModal } from "./edit-employee-modal"
import { EmployeeLeaveHistoryModal } from "./employee-leave-history-modal"
import { EmployeeDocumentsModal } from "./employee-documents-modal"
import { ImportEmployeesModal } from "./import-employees-modal"
import { Progress } from "@/components/ui/progress"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Checkbox } from "@/components/ui/checkbox"
import { ExportButton } from "./export-button"
import { useApp } from "./app-provider"

export function EmployeeTable() {
  const [searchQuery, setSearchQuery] = useState("")
  const [debouncedSearchQuery, setDebouncedSearchQuery] = useState("")
  const [pageIndex, setPageIndex] = useState(0)
  const [pageSize, setPageSize] = useState(50)

  const [serverSortColumn, setServerSortColumn] = useState<string>("name")
  const [serverSortOrder, setServerSortOrder] = useState<"asc" | "desc">("asc")

  const [isAddModalOpen, setIsAddModalOpen] = useState(false)
  const [isImportModalOpen, setIsImportModalOpen] = useState(false)
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false)
  const [isDetailsModalOpen, setIsDetailsModalOpen] = useState(false)
  const [isEditModalOpen, setIsEditModalOpen] = useState(false)
  const [isLeaveHistoryModalOpen, setIsLeaveHistoryModalOpen] = useState(false)
  const [isDocumentsModalOpen, setIsDocumentsModalOpen] = useState(false)
  const [selectedEmployee, setSelectedEmployee] = useState<Employee | null>(null)
  const [employeeToDelete, setEmployeeToDelete] = useState<string | null>(null)

  const { user } = useApp()
  const isAdmin = user?.role === "admin"

  const { toast } = useToast()
  const queryClient = useQueryClient()

  const {
    data: branches = [],
    isLoading: isLoadingBranches,
    isError: isBranchesError,
    error: branchesError,
  } = useBranches()

  // Initialize selectedBranch based on user's assigned branches
  const [selectedBranch, setSelectedBranch] = useState<string>(
    !isAdmin && user?.branches && user.branches.length === 1 ? user.branches[0] : "all",
  )

  useEffect(() => {
    const timeoutId = setTimeout(() => {
      setDebouncedSearchQuery(searchQuery)
    }, 500)
    return () => clearTimeout(timeoutId)
  }, [searchQuery])

  const {
    data: employeesResponse = { data: [], total: 0 },
    isLoading,
    isError,
    error,
    refetch,
  } = useQuery<{ data: Employee[]; total: number }>({
    queryKey: [
      "employees",
      selectedBranch,
      debouncedSearchQuery,
      pageIndex,
      pageSize,
      serverSortColumn,
      serverSortOrder,
    ],
    queryFn: async () => {
      try {
        const params = new URLSearchParams()

        // If a specific branch is selected, use that
        if (selectedBranch !== "all") {
          params.append("branch", selectedBranch)
        }
        // If no specific branch is selected but user is not admin and has assigned branches
        else if (!isAdmin && user?.branches && user.branches.length > 0) {
          // For API compatibility, if user has only one branch, send it as a single parameter
          if (user.branches.length === 1) {
            params.append("branch", user.branches[0])
          }
          // Otherwise, send a comma-separated list of branches
          else {
            params.append("branches", user.branches.join(","))
          }
        }

        if (debouncedSearchQuery) {
          params.append("search", debouncedSearchQuery)
        }
        params.append("page", pageIndex.toString())
        params.append("pageSize", pageSize.toString())
        params.append("sortColumn", serverSortColumn)
        params.append("sortOrder", serverSortOrder)

        const response = await fetchWithAuth(`/api/employees?${params.toString()}`)

        if (!response || !response.data) {
          console.log("No data received from API, using empty array")
          return { data: [], total: 0 }
        }

        console.log(
          `Received ${response.data.length} employees out of ${response.total} total with page size ${pageSize}`,
        )

        return response
      } catch (error) {
        console.error("Error fetching employees:", error)
        throw error
      }
    },
    placeholderData: keepPreviousData,
  })

  const employees = employeesResponse?.data || []
  const totalEmployees = employeesResponse?.total || 0

  const deleteEmployee = async (id: string) => {
    try {
      await fetchWithAuth(`/api/employees/${id}`, {
        method: "DELETE",
      })

      toast({
        title: "Success",
        description: "Employee deleted successfully",
      })

      queryClient.invalidateQueries({ queryKey: ["employees"] })
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to delete employee. Please try again.",
        variant: "destructive",
      })
    }
  }

  const handleViewDetails = (employee: Employee) => {
    setSelectedEmployee(employee)
    setIsDetailsModalOpen(true)
  }

  const handleEditEmployee = (employee: Employee) => {
    setSelectedEmployee(employee)
    setIsEditModalOpen(true)
  }

  const handleViewLeaveHistory = (employee: Employee) => {
    setSelectedEmployee(employee)
    setIsLeaveHistoryModalOpen(true)
  }

  const handleManageDocuments = (employee: Employee) => {
    setSelectedEmployee(employee)
    setIsDocumentsModalOpen(true)
  }

  const handleDeleteEmployee = (employee: Employee) => {
    setEmployeeToDelete(employee.id)
    setSelectedEmployee(employee)
    setIsDeleteDialogOpen(true)
  }

  const confirmDeleteEmployee = () => {
    if (employeeToDelete) {
      deleteEmployee(employeeToDelete)
      setIsDeleteDialogOpen(false)
      setEmployeeToDelete(null)
    }
  }

  const [selectedEmployeeIds, setSelectedEmployeeIds] = useState<string[]>([])
  const [isBatchDeleting, setIsBatchDeleting] = useState(false)
  const [deleteProgress, setDeleteProgress] = useState(0)
  const [isBatchDeleteDialogOpen, setIsBatchDeleteDialogOpen] = useState(false)

  const handleBatchDelete = async () => {
    if (selectedEmployeeIds.length === 0) return

    setIsBatchDeleting(true)
    setDeleteProgress(0)

    try {
      const progressIncrement = 100 / selectedEmployeeIds.length
      let currentProgress = 0
      let successCount = 0

      const BATCH_SIZE = 10
      for (let i = 0; i < selectedEmployeeIds.length; i += BATCH_SIZE) {
        const batch = selectedEmployeeIds.slice(i, i + BATCH_SIZE)

        const response = await fetchWithAuth("/api/employees/batch-delete", {
          method: "POST",
          body: JSON.stringify({ ids: batch }),
        })

        if (response?.success) {
          successCount += response.deleted
        } else {
          console.error("Batch delete failed:", response?.error)
          toast({
            title: "Error",
            description: `Failed to delete some employees: ${response?.error || "Unknown error"}`,
            variant: "destructive",
          })
        }

        currentProgress += progressIncrement * batch.length
        setDeleteProgress(Math.min(Math.round(currentProgress), 99))
      }

      setDeleteProgress(100)

      toast({
        title: "Success",
        description: `Successfully deleted ${successCount} employees`,
      })

      setSelectedEmployeeIds([])

      queryClient.invalidateQueries({ queryKey: ["employees"] })
    } catch (error) {
      toast({
        title: "Error",
        description: `Failed to delete employees: ${handleApiError(error)}`,
        variant: "destructive",
      })
    } finally {
      setTimeout(() => {
        setIsBatchDeleting(false)
        setIsBatchDeleteDialogOpen(false)
      }, 500)
    }
  }

  const toggleSelectAll = () => {
    if (selectedEmployeeIds.length === employees.length) {
      setSelectedEmployeeIds([])
    } else {
      setSelectedEmployeeIds(employees.map((emp) => emp.id))
    }
  }

  const toggleSelectEmployee = (id: string) => {
    setSelectedEmployeeIds((prev) => (prev.includes(id) ? prev.filter((empId) => empId !== id) : [...prev, id]))
  }

  const handlePageSizeChange = (value: string) => {
    setPageIndex(0)

    if (value === "all") {
      setPageSize(500)
      toast({
        title: "Large Data Set",
        description:
          "Showing up to 500 records to maintain performance. Use search or filters for more specific results.",
      })
    } else {
      setPageSize(Number.parseInt(value, 10))
    }
  }

  const handleServerSort = (column: string) => {
    if (column === serverSortColumn) {
      setServerSortOrder(serverSortOrder === "asc" ? "desc" : "asc")
    } else {
      setServerSortColumn(column)
      setServerSortOrder("asc")
    }
    setPageIndex(0)
  }

  const handleBranchChange = (value: string) => {
    // If user is not admin and tries to select "all" but has assigned branches,
    // prevent this by setting to their first assigned branch
    if (!isAdmin && value === "all" && user?.branches && user.branches.length > 0) {
      setSelectedBranch(user.branches[0])
    } else {
      setSelectedBranch(value)
    }
    setPageIndex(0)
  }

  const branchOptions = branches.filter((branch) => isAdmin || (user?.branches && user.branches.includes(branch.name)))
  const canChooseAll = isAdmin || (user?.branches && user.branches.length > 1)
  const allSelected = employees.length > 0 && selectedEmployeeIds.length === employees.length
  const firstRow = employees.length > 0 ? pageIndex * pageSize + 1 : 0
  const lastRow = Math.min((pageIndex + 1) * pageSize, totalEmployees)

  const sortHeader = (label: string, column: string, align: "left" | "right" = "left", className?: string) => (
    <TableHead className={cn(align === "right" && "text-right", className)}>
      <button
        onClick={() => handleServerSort(column)}
        className={cn(
          "inline-flex items-center gap-1 rounded-md transition-colors hover:text-foreground",
          serverSortColumn === column && "text-foreground",
        )}
      >
        {label}
        {serverSortColumn === column ? (
          serverSortOrder === "asc" ? (
            <ArrowUp className="h-3.5 w-3.5" />
          ) : (
            <ArrowDown className="h-3.5 w-3.5" />
          )
        ) : (
          <ArrowUpDown className="h-3.5 w-3.5 opacity-40" />
        )}
      </button>
    </TableHead>
  )

  const rowActions = (employee: Employee) => (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" className="h-8 w-8" onClick={(e) => e.stopPropagation()}>
          <span className="sr-only">Actions for {employee.name}</span>
          <MoreHorizontal />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" onClick={(e) => e.stopPropagation()}>
        <DropdownMenuItem onClick={() => handleViewDetails(employee)}>
          <Eye />
          View details
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => handleEditEmployee(employee)}>
          <Pencil />
          Edit employee
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={() => handleViewLeaveHistory(employee)}>
          <History />
          Leave history
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => handleManageDocuments(employee)}>
          <FileText />
          Documents
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem
          className="text-destructive focus:text-destructive [&_svg]:!text-destructive"
          onClick={() => handleDeleteEmployee(employee)}
        >
          <Trash2 />
          Delete employee
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )

  const balanceBadge = (days: number) => (
    <Badge
      variant={days < 0 ? "destructive" : days <= 5 ? "warning" : "secondary"}
      className="tabular"
      dot={days <= 5}
    >
      {days}
    </Badge>
  )

  return (
    <div className="space-y-6 sm:space-y-8">
      <PageHeader
        title="Employees"
        description={
          isLoading ? "Staff across your branches." : `${plural(totalEmployees, "person", "people")} across ${selectedBranch === "all" ? (isAdmin ? "all branches" : "your branches") : selectedBranch}.`
        }
        actions={
          isAdmin && (
            <>
              <Button variant="outline" onClick={() => setIsImportModalOpen(true)}>
                <Upload />
                Import
              </Button>
              <ExportButton
                endpoint="employees"
                filters={{ branch: selectedBranch, search: searchQuery, exportAll: "true" }}
                sortColumn={serverSortColumn}
                sortOrder={serverSortOrder}
                size="default"
              />
              <Button onClick={() => setIsAddModalOpen(true)}>
                <Plus />
                Add employee
              </Button>
            </>
          )
        }
      />

      {isError && <ErrorState title="Couldn't load employees" message={handleApiError(error)} onRetry={() => refetch()} />}
      {isBranchesError && (
        <ErrorState title="Couldn't load branches" message={handleApiError(branchesError)} onRetry={() => window.location.reload()} />
      )}

      <div className="surface overflow-hidden">
        {/* Filters */}
        <Toolbar className="border-b border-border/70 p-3 sm:p-4">
          <div className="relative flex-1 sm:max-w-sm">
            <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Search by name or code"
              aria-label="Search employees"
              className="pl-10"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>
          <Select value={selectedBranch} onValueChange={handleBranchChange}>
            <SelectTrigger className="sm:w-[200px]" aria-label="Branch">
              <SelectValue placeholder="All branches" />
            </SelectTrigger>
            <SelectContent>
              {canChooseAll && <SelectItem value="all">All branches</SelectItem>}
              {branchOptions.map((branch) => (
                <SelectItem key={branch.id} value={branch.name}>
                  {branch.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {isLoadingBranches && <span className="sr-only">Loading branches</span>}
        </Toolbar>

        {/* Selection bar */}
        {isAdmin && selectedEmployeeIds.length > 0 && (
          <div className="page-enter flex items-center justify-between gap-3 border-b border-border/70 bg-primary-soft/60 px-4 py-2.5 sm:px-5">
            <p className="text-sm font-semibold text-primary">{selectedEmployeeIds.length} selected</p>
            <div className="flex items-center gap-2">
              <Button variant="ghost" size="sm" onClick={() => setSelectedEmployeeIds([])}>
                Clear
              </Button>
              <Button variant="destructive" size="sm" onClick={() => setIsBatchDeleteDialogOpen(true)}>
                <Trash2 />
                Delete
              </Button>
            </div>
          </div>
        )}

        {isBatchDeleting && (
          <div className="space-y-1.5 border-b border-border/70 px-5 py-3">
            <Progress value={deleteProgress} />
            <p className="text-xs text-muted-foreground">Deleting employees… {deleteProgress}%</p>
          </div>
        )}

        {/* Desktop and tablet: table */}
        <div className="hidden md:block">
          <Table>
            <TableHeader>
              <TableRow className="hover:bg-transparent">
                {isAdmin && (
                  <TableHead>
                    <Checkbox checked={allSelected} onCheckedChange={toggleSelectAll} aria-label="Select all" />
                  </TableHead>
                )}
                {sortHeader("Name", "name")}
                {sortHeader("Code", "employee_code", "left", "hidden lg:table-cell")}
                {sortHeader("Branch", "branch")}
                {sortHeader("Hours", "hours", "right")}
                {sortHeader("Taken", "days_taken", "right")}
                {sortHeader("Remaining", "days_remaining", "right")}
                {isAdmin && <TableHead className="w-12"><span className="sr-only">Actions</span></TableHead>}
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                Array.from({ length: 8 }).map((_, index) => (
                  <TableRow key={index} className="hover:bg-transparent">
                    <TableCell colSpan={isAdmin ? 8 : 6} className="py-3">
                      <div className="flex items-center gap-3">
                        <Skeleton className="h-9 w-9 rounded-full" />
                        <Skeleton className="h-4 w-1/4" />
                        <Skeleton className="ml-auto h-4 w-1/3" />
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              ) : employees.length > 0 ? (
                employees.map((employee) => (
                  <TableRow
                    key={employee.id}
                    data-state={selectedEmployeeIds.includes(employee.id) ? "selected" : undefined}
                    className="cursor-pointer"
                    onClick={() => handleViewDetails(employee)}
                  >
                    {isAdmin && (
                      <TableCell onClick={(e) => e.stopPropagation()}>
                        <Checkbox
                          checked={selectedEmployeeIds.includes(employee.id)}
                          onCheckedChange={() => toggleSelectEmployee(employee.id)}
                          aria-label={`Select ${employee.name}`}
                        />
                      </TableCell>
                    )}
                    <TableCell>
                      <div className="flex items-center gap-3">
                        <Avatar name={employee.name} />
                        <div className="min-w-0">
                          <p className="truncate font-semibold text-foreground">{employee.name}</p>
                          <p className="truncate text-xs text-muted-foreground">
                            {employee.jobTitle}
                            {employee.status !== "active" && " · Inactive"}
                          </p>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell className="hidden tabular text-muted-foreground lg:table-cell">{employee.employeeCode}</TableCell>
                    <TableCell>{employee.branch}</TableCell>
                    <TableCell className="text-right tabular">{employee.hours ?? "—"}</TableCell>
                    <TableCell className="text-right tabular">{employee.daysTaken}</TableCell>
                    <TableCell className="text-right">{balanceBadge(employee.daysRemaining)}</TableCell>
                    {isAdmin && (
                      <TableCell className="text-right" onClick={(e) => e.stopPropagation()}>
                        {rowActions(employee)}
                      </TableCell>
                    )}
                  </TableRow>
                ))
              ) : (
                <TableRow className="hover:bg-transparent">
                  <TableCell colSpan={isAdmin ? 8 : 6}>
                    <EmptyState
                      icon={Users}
                      title={searchQuery ? "No matching employees" : "No employees yet"}
                      description={searchQuery ? "Try a different name or code." : "Add employees or import a spreadsheet."}
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
            <ListSkeleton rows={6} />
          ) : employees.length > 0 ? (
            <ul className="divide-y divide-border/70">
              {employees.map((employee) => (
                <li key={employee.id} className="flex items-center gap-3 px-4 py-3">
                  {isAdmin && (
                    <Checkbox
                      checked={selectedEmployeeIds.includes(employee.id)}
                      onCheckedChange={() => toggleSelectEmployee(employee.id)}
                      aria-label={`Select ${employee.name}`}
                    />
                  )}
                  <button
                    className="flex min-w-0 flex-1 items-center gap-3 text-left"
                    onClick={() => handleViewDetails(employee)}
                  >
                    <Avatar name={employee.name} />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-[15px] font-semibold">{employee.name}</span>
                      <span className="block truncate text-xs text-muted-foreground">
                        {employee.jobTitle} · {employee.branch}
                      </span>
                    </span>
                    <span className="flex shrink-0 flex-col items-end gap-0.5">
                      {balanceBadge(employee.daysRemaining)}
                      <span className="text-[11px] text-muted-foreground">days left</span>
                    </span>
                  </button>
                  {isAdmin && rowActions(employee)}
                </li>
              ))}
            </ul>
          ) : (
            <EmptyState
              icon={Users}
              title={searchQuery ? "No matching employees" : "No employees yet"}
              description={searchQuery ? "Try a different name or code." : undefined}
            />
          )}
        </div>

        {/* Pagination */}
        <div className="flex flex-col gap-3 border-t border-border/70 px-4 py-3 sm:flex-row sm:items-center sm:justify-between sm:px-5">
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <span>Rows</span>
            <Select value={pageSize === 500 ? "all" : pageSize.toString()} onValueChange={handlePageSizeChange}>
              <SelectTrigger className="h-9 w-[84px]" aria-label="Rows per page">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="10">10</SelectItem>
                <SelectItem value="50">50</SelectItem>
                <SelectItem value="100">100</SelectItem>
                <SelectItem value="200">200</SelectItem>
                <SelectItem value="all">All</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="flex items-center justify-between gap-3 sm:justify-end">
            <p className="text-sm tabular text-muted-foreground">
              {firstRow}–{lastRow} of {totalEmployees}
            </p>
            <div className="flex gap-1.5">
              <Button
                variant="outline"
                size="icon"
                className="h-9 w-9"
                onClick={() => setPageIndex(Math.max(0, pageIndex - 1))}
                disabled={pageIndex === 0 || isLoading}
                aria-label="Previous page"
              >
                <ChevronLeft />
              </Button>
              <Button
                variant="outline"
                size="icon"
                className="h-9 w-9"
                onClick={() => setPageIndex(pageIndex + 1)}
                disabled={(pageIndex + 1) * pageSize >= totalEmployees || isLoading}
                aria-label="Next page"
              >
                <ChevronRight />
              </Button>
            </div>
          </div>
        </div>
      </div>
      <AddEmployeeModal open={isAddModalOpen} onOpenChange={setIsAddModalOpen} />
      <ImportEmployeesModal open={isImportModalOpen} onOpenChange={setIsImportModalOpen} />

      {selectedEmployee && (
        <>
          <EmployeeDetailsModal
            employeeId={selectedEmployee.id}
            isOpen={isDetailsModalOpen}
            onClose={() => setIsDetailsModalOpen(false)}
          />

          <EditEmployeeModal
            employeeId={selectedEmployee.id}
            isOpen={isEditModalOpen}
            onClose={() => setIsEditModalOpen(false)}
          />

          <EmployeeLeaveHistoryModal
            employeeId={selectedEmployee.id}
            employeeName={selectedEmployee.name}
            isOpen={isLeaveHistoryModalOpen}
            onClose={() => setIsLeaveHistoryModalOpen(false)}
          />

          <EmployeeDocumentsModal
            employeeId={selectedEmployee.id}
            employeeName={selectedEmployee.name}
            isOpen={isDocumentsModalOpen}
            onClose={() => setIsDocumentsModalOpen(false)}
          />
        </>
      )}

      <DeleteConfirmationDialog
        isOpen={isDeleteDialogOpen}
        onClose={() => setIsDeleteDialogOpen(false)}
        onConfirm={confirmDeleteEmployee}
        title="Delete Employee"
        description={`Are you sure you want to delete ${selectedEmployee?.name}? This action cannot be undone.`}
        confirmLabel="Delete"
        cancelLabel="Cancel"
      />

      <Dialog open={isBatchDeleteDialogOpen} onOpenChange={setIsBatchDeleteDialogOpen}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>Delete selected employees</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete {selectedEmployeeIds.length} selected employees? This action cannot be
              undone.
            </DialogDescription>
          </DialogHeader>

          {isBatchDeleting && (
            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span>Deleting...</span>
                <span>{Math.round(deleteProgress)}%</span>
              </div>
              <Progress value={deleteProgress} className="h-2" />
            </div>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={() => setIsBatchDeleteDialogOpen(false)} disabled={isBatchDeleting}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={handleBatchDelete} disabled={isBatchDeleting}>
              {isBatchDeleting ? "Deleting..." : "Delete employees"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
