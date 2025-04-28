"use client"

import { useState, useEffect } from "react"
import { useQuery, useQueryClient } from "@tanstack/react-query"
import {
  type ColumnDef,
  type ColumnFiltersState,
  type SortingState,
  flexRender,
  getCoreRowModel,
  getFilteredRowModel,
  useReactTable,
} from "@tanstack/react-table"
import { MoreHorizontal, Plus, Upload, Search, Trash2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
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
  const [sorting, setSorting] = useState<SortingState>([])
  const [columnFilters, setColumnFilters] = useState<ColumnFiltersState>([])
  const [searchQuery, setSearchQuery] = useState("")
  const [debouncedSearchQuery, setDebouncedSearchQuery] = useState("")
  const [pageIndex, setPageIndex] = useState(0)
  const [pageSize, setPageSize] = useState(60)

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
  } = useQuery({
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
    keepPreviousData: true,
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

  const columns: ColumnDef<Employee>[] = [
    {
      id: "select",
      header: ({ table }) =>
        isAdmin ? (
          <Checkbox
            checked={selectedEmployeeIds.length === employees.length && employees.length > 0}
            onCheckedChange={toggleSelectAll}
            aria-label="Select all"
          />
        ) : null,
      cell: ({ row }) =>
        isAdmin ? (
          <Checkbox
            checked={selectedEmployeeIds.includes(row.original.id)}
            onCheckedChange={() => toggleSelectEmployee(row.original.id)}
            aria-label={`Select ${row.original.name}`}
          />
        ) : null,
      enableSorting: false,
      enableHiding: false,
    },
    {
      accessorKey: "name",
      header: ({ column }) => (
        <Button variant="ghost" onClick={() => handleServerSort("name")} className="flex items-center gap-1">
          Name
          {serverSortColumn === "name" && <span className="ml-1">{serverSortOrder === "asc" ? "↑" : "↓"}</span>}
        </Button>
      ),
      cell: ({ row }) => <div className="font-medium">{row.getValue("name")}</div>,
    },
    {
      accessorKey: "employeeCode",
      header: ({ column }) => (
        <Button variant="ghost" onClick={() => handleServerSort("employee_code")} className="flex items-center gap-1">
          Employee Code
          {serverSortColumn === "employee_code" && (
            <span className="ml-1">{serverSortOrder === "asc" ? "↑" : "↓"}</span>
          )}
        </Button>
      ),
      cell: ({ row }) => <div>{row.getValue("employeeCode")}</div>,
    },
    {
      accessorKey: "jobTitle",
      header: ({ column }) => (
        <Button variant="ghost" onClick={() => handleServerSort("job_title")} className="flex items-center gap-1">
          Job Title
          {serverSortColumn === "job_title" && <span className="ml-1">{serverSortOrder === "asc" ? "↑" : "↓"}</span>}
        </Button>
      ),
      cell: ({ row }) => <div>{row.getValue("jobTitle")}</div>,
    },
    {
      accessorKey: "branch",
      header: ({ column }) => (
        <Button variant="ghost" onClick={() => handleServerSort("branch")} className="flex items-center gap-1">
          Branch
          {serverSortColumn === "branch" && <span className="ml-1">{serverSortOrder === "asc" ? "↑" : "↓"}</span>}
        </Button>
      ),
      cell: ({ row }) => <div>{row.getValue("branch")}</div>,
    },
    {
      accessorKey: "hours",
      header: ({ column }) => (
        <Button variant="ghost" onClick={() => handleServerSort("hours")} className="flex items-center gap-1">
          Hours
          {serverSortColumn === "hours" && <span className="ml-1">{serverSortOrder === "asc" ? "↑" : "↓"}</span>}
        </Button>
      ),
      cell: ({ row }) => <div className="text-center">{row.original.hours || "N/A"}</div>,
    },
    {
      accessorKey: "daysTaken",
      header: ({ column }) => (
        <Button variant="ghost" onClick={() => handleServerSort("days_taken")} className="flex items-center gap-1">
          Days Taken
          {serverSortColumn === "days_taken" && <span className="ml-1">{serverSortOrder === "asc" ? "↑" : "↓"}</span>}
        </Button>
      ),
      cell: ({ row }) => <div className="text-center">{row.getValue("daysTaken")}</div>,
    },
    {
      accessorKey: "daysRemaining",
      header: ({ column }) => (
        <Button variant="ghost" onClick={() => handleServerSort("days_remaining")} className="flex items-center gap-1">
          Days Remaining
          {serverSortColumn === "days_remaining" && (
            <span className="ml-1">{serverSortOrder === "asc" ? "↑" : "↓"}</span>
          )}
        </Button>
      ),
      cell: ({ row }) => <div className="text-center">{row.getValue("daysRemaining")}</div>,
    },
    // Only include the actions column for admin users
    ...(isAdmin
      ? [
          {
            id: "actions",
            header: "Actions",
            cell: ({ row }) => {
              const employee = row.original

              return (
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="ghost" className="h-8 w-8 p-0">
                      <span className="sr-only">Open menu</span>
                      <MoreHorizontal className="h-4 w-4" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuLabel>Actions</DropdownMenuLabel>
                    <DropdownMenuItem onClick={() => handleViewDetails(employee)}>View Details</DropdownMenuItem>
                    <DropdownMenuItem onClick={() => handleEditEmployee(employee)}>Edit Employee</DropdownMenuItem>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem onClick={() => handleViewLeaveHistory(employee)}>
                      View Leave History
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => handleManageDocuments(employee)}>
                      Manage Documents
                    </DropdownMenuItem>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem className="text-destructive" onClick={() => handleDeleteEmployee(employee)}>
                      Delete Employee
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              )
            },
          },
        ]
      : []),
  ]

  const table = useReactTable({
    data: employees,
    columns,
    onColumnFiltersChange: setColumnFilters,
    getCoreRowModel: getCoreRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    state: {
      columnFilters,
    },
    manualPagination: true,
    pageCount: Math.ceil(totalEmployees / pageSize),
  })

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

  if (isError) {
    return (
      <div className="rounded-md bg-destructive/15 p-4 text-destructive">
        <p>Error loading employees: {handleApiError(error)}</p>
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

  return (
    <div className="space-y-4 w-full">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="relative w-full sm:max-w-xs">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search employees..."
            className="w-full pl-8"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {isAdmin && selectedEmployeeIds.length > 0 && (
            <Button variant="destructive" size="sm" className="gap-1" onClick={() => setIsBatchDeleteDialogOpen(true)}>
              <Trash2 className="h-4 w-4" />
              Delete Selected ({selectedEmployeeIds.length})
            </Button>
          )}
          <Select value={selectedBranch} onValueChange={handleBranchChange}>
            <SelectTrigger className="w-[180px]">
              <SelectValue placeholder="All Branches" />
            </SelectTrigger>
            <SelectContent>
              {/* Only show "All Branches" option if user is admin or has multiple branches */}
              {(isAdmin || (user?.branches && user.branches.length > 1)) && (
                <SelectItem value="all">All Branches</SelectItem>
              )}
              {/* Filter branches based on user role */}
              {branches
                .filter((branch) => isAdmin || (user?.branches && user.branches.includes(branch.name)))
                .map((branch) => (
                  <SelectItem key={branch.id} value={branch.name}>
                    {branch.name}
                  </SelectItem>
                ))}
            </SelectContent>
          </Select>
          {isAdmin && (
            <>
              <Button variant="outline" size="sm" className="gap-1" onClick={() => setIsImportModalOpen(true)}>
                <Upload className="h-4 w-4" />
                Import
              </Button>
              <ExportButton
                endpoint="employees"
                filters={{
                  branch: selectedBranch,
                  search: searchQuery,
                  exportAll: "true",
                }}
                sortColumn={serverSortColumn}
                sortOrder={serverSortOrder}
                size="sm"
              />
              <Button
                size="sm"
                className="gap-1 bg-gradient-to-r from-purple-600 to-blue-500 hover:from-purple-700 hover:to-blue-600"
                onClick={() => setIsAddModalOpen(true)}
              >
                <Plus className="h-4 w-4" />
                Add Employee
              </Button>
            </>
          )}
        </div>
      </div>

      {isBatchDeleting && (
        <div className="w-full">
          <Progress value={deleteProgress} />
          <p className="text-sm text-muted-foreground mt-1 text-center">Deleting employees... {deleteProgress}%</p>
        </div>
      )}

      <div className="rounded-md border overflow-hidden w-full">
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              {table.getHeaderGroups().map((headerGroup) => (
                <TableRow key={headerGroup.id}>
                  {headerGroup.headers.map((header) => (
                    <TableHead key={header.id}>
                      {header.isPlaceholder ? null : flexRender(header.column.columnDef.header, header.getContext())}
                    </TableHead>
                  ))}
                </TableRow>
              ))}
            </TableHeader>
            <TableBody>
              {isLoading ? (
                Array.from({ length: Math.min(10, pageSize) }).map((_, index) => (
                  <TableRow key={index}>
                    {columns.map((_, cellIndex) => (
                      <TableCell key={cellIndex}>
                        <Skeleton className="h-6 w-full" />
                      </TableCell>
                    ))}
                  </TableRow>
                ))
              ) : employees.length > 0 ? (
                employees.map((employee) => (
                  <TableRow key={employee.id}>
                    {isAdmin && (
                      <TableCell>
                        <Checkbox
                          checked={selectedEmployeeIds.includes(employee.id)}
                          onCheckedChange={() => toggleSelectEmployee(employee.id)}
                          aria-label={`Select ${employee.name}`}
                        />
                      </TableCell>
                    )}
                    <TableCell>
                      <div className="font-medium">{employee.name}</div>
                    </TableCell>
                    <TableCell>{employee.employeeCode}</TableCell>
                    <TableCell>{employee.jobTitle}</TableCell>
                    <TableCell>{employee.branch}</TableCell>
                    <TableCell className="text-center">{employee.hours || "N/A"}</TableCell>
                    <TableCell className="text-center">{employee.daysTaken}</TableCell>
                    <TableCell className="text-center">{employee.daysRemaining}</TableCell>
                    {isAdmin && (
                      <TableCell>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" className="h-8 w-8 p-0">
                              <span className="sr-only">Open menu</span>
                              <MoreHorizontal className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuLabel>Actions</DropdownMenuLabel>
                            <DropdownMenuItem onClick={() => handleViewDetails(employee)}>
                              View Details
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => handleEditEmployee(employee)}>
                              Edit Employee
                            </DropdownMenuItem>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem onClick={() => handleViewLeaveHistory(employee)}>
                              View Leave History
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => handleManageDocuments(employee)}>
                              Manage Documents
                            </DropdownMenuItem>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem
                              className="text-destructive"
                              onClick={() => handleDeleteEmployee(employee)}
                            >
                              Delete Employee
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </TableCell>
                    )}
                  </TableRow>
                ))
              ) : (
                <TableRow>
                  <TableCell colSpan={columns.length} className="h-24 text-center">
                    No employees found.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>
      </div>
      <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
        <div className="flex items-center gap-2">
          <span className="text-sm text-muted-foreground">Show</span>
          <Select value={pageSize === 500 ? "all" : pageSize.toString()} onValueChange={handlePageSizeChange}>
            <SelectTrigger className="w-[80px]">
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
          <span className="text-sm text-muted-foreground">per page</span>
        </div>
        <div className="flex items-center justify-end gap-2">
          <div className="text-sm text-muted-foreground">
            Showing {employees.length > 0 ? pageIndex * pageSize + 1 : 0}-
            {Math.min((pageIndex + 1) * pageSize, totalEmployees)} of {totalEmployees} employees
          </div>
          <div className="space-x-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setPageIndex(Math.max(0, pageIndex - 1))}
              disabled={pageIndex === 0 || isLoading}
            >
              Previous
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setPageIndex(pageIndex + 1)}
              disabled={(pageIndex + 1) * pageSize >= totalEmployees || isLoading}
            >
              Next
            </Button>
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
            <DialogTitle>Delete Multiple Employees</DialogTitle>
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
              {isBatchDeleting ? "Deleting..." : "Delete Employees"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
