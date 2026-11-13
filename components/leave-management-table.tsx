"use client"

import { useState, useEffect, useMemo } from "react"
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
  CalendarRange,
  List,
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
  Users,
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
import { TeamCalendar } from "./team-calendar"
import { WhosOnLeaveDialog } from "./whos-on-leave-dialog"
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { useRouter, useSearchParams } from "next/navigation"
import { LEAVE_CALENDAR_HREF, LEAVE_PATH } from "@/lib/navigation"
import { parseDateToUtc, toIsoDate, todayUtc } from "@/lib/dates"
import {
  type StoredPeriod,
  buildLeaveYears,
  crossesYear,
  daysInYear,
  inYear,
  summariseYear,
  yearRange,
} from "@/lib/leave-years"

type LeaveView = "list" | "calendar"

export function LeaveManagementTable() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const view: LeaveView = searchParams.get("view") === "calendar" ? "calendar" : "list"
  const setView = (next: LeaveView) =>
    router.replace(next === "calendar" ? LEAVE_CALENDAR_HREF : LEAVE_PATH, { scroll: false })
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
  const [onLeaveOpen, setOnLeaveOpen] = useState(false)
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
      } else if (!isAdmin && user?.branches && user.branches.length > 0) {
        if (user.branches.length === 1) {
          params.append("branch", user.branches[0])
        } else {
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

  // Leave years: the periods stored in Settings, plus older years that have
  // records. The current year is shown by default; ?year= picks another (or
  // "all"). Only the list view uses it; the calendar is browsed by month.
  const { data: periods = [], isError: isPeriodsError } = useQuery<StoredPeriod[]>({
    queryKey: ["leavePeriods"],
    queryFn: () => fetchWithAuth("/api/leave-periods"),
  })
  const today = useMemo(() => todayUtc(), [])
  const years = useMemo(() => buildLeaveYears(periods, leaveRequests, today), [periods, leaveRequests, today])
  const currentYear = years.find((y) => y.isCurrent) ?? years[0]
  const yearParam = searchParams.get("year")
  const selectedYear = yearParam === "all" ? null : (years.find((y) => y.key === yearParam) ?? currentYear ?? null)
  const yearValue = yearParam === "all" ? "all" : (selectedYear?.key ?? "all")
  const setYear = (key: string) => {
    const next = new URLSearchParams(searchParams.toString())
    if (key === currentYear?.key) next.delete("year")
    else next.set("year", key)
    const qs = next.toString()
    router.replace(qs ? `${LEAVE_PATH}?${qs}` : LEAVE_PATH, { scroll: false })
  }
  const isPastSelection = !!selectedYear && !!currentYear && selectedYear.end < currentYear.start

  // The records for the selected year (any that fall partly inside it count)
  const rows = useMemo(
    () => (selectedYear ? leaveRequests.filter((r) => inYear(r, selectedYear)) : leaveRequests),
    [leaveRequests, selectedYear],
  )
  const summary = useMemo(() => (selectedYear ? summariseYear(rows, selectedYear) : null), [rows, selectedYear])

  // Leave that ended before the current leave year is view only here: changing
  // it would adjust the employee's current balance, not that year's
  const isReadOnly = (row: LeaveRequest) => {
    const end = parseDateToUtc(row.endDate)
    return !!currentYear && end !== null && end < currentYear.start
  }

  // When the list is one employee's leave, show their entitlement for the
  // current year. Past years' entitlement was never stored, so none is shown.
  const singleEmployeeId =
    employeeSearch.trim() && rows.length > 0 && rows.every((r) => r.employeeId === rows[0].employeeId)
      ? rows[0].employeeId
      : null
  const { data: singleEmployee } = useQuery<{ name: string; daysTaken: number; daysRemaining: number }>({
    queryKey: ["employee", singleEmployeeId],
    queryFn: () => fetchWithAuth(`/api/employees/${singleEmployeeId}`),
    enabled: !!singleEmployeeId && !!selectedYear?.isCurrent,
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
    } catch {
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
      if (selectedYear) {
        formData.append("startDate", toIsoDate(selectedYear.start))
        formData.append("endDate", toIsoDate(selectedYear.end))
        formData.append("dateFilterMode", "overlap")
      }

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
        title: "Export ready",
        description: `Your ${format.toUpperCase()} file has been downloaded.`,
      })
    } catch (error) {
      console.error("Export error:", error)
      toast({
        title: "Export failed",
        description: "There was an error exporting the data. Please try again.",
        variant: "destructive",
      })
    } finally {
      setIsExporting(false)
      setExportFormat(null)
    }
  }

  const resetFilters = () => {
    if (yearParam) setYear(currentYear?.key ?? "all")
    setEmployeeSearch("")
    setSelectedBranch("all")
    setSelectedType("all")
    setSortColumn("submittedDate")
    setSortDirection("desc")
  }

  const typeColor = (type: string) => leaveTypes.find((t) => t.name === type)?.color || "#64748b"
  const canAdd = user?.role === "admin" || (user?.role === "normal" && user?.branches && user?.branches.length > 0)
  const filtersActive =
    employeeSearch !== "" ||
    selectedType !== "all" ||
    (isAdmin && selectedBranch !== "all") ||
    (!!yearParam && yearValue !== currentYear?.key)

  const statusBadge = (status: string) => (
    <Badge dot variant={status === "Approved" ? "success" : status === "Pending" ? "warning" : "destructive"}>
      {status}
    </Badge>
  )

  const sortHeader = (label: string, column: string, className?: string) => (
    <TableHead className={className}>
      <button
        onClick={() => handleSort(column)}
        className={cn(
          "inline-flex items-center gap-1 transition-colors hover:text-foreground",
          sortColumn === column && "text-foreground",
        )}
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
        {isReadOnly(row) ? (
          <p className="px-2.5 py-1.5 text-xs text-muted-foreground">From a past leave year, so view only.</p>
        ) : (
          <>
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
          </>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  )

  // "Spans 2 leave years · 2 of 14 days in this year"
  const spansNote = (row: LeaveRequest) =>
    selectedYear && crossesYear(row, selectedYear)
      ? `Spans 2 leave years · ${daysInYear(row, selectedYear)} of ${plural(row.duration, "day")} in this year`
      : null

  const otherFilters = employeeSearch !== "" || selectedType !== "all" || (isAdmin && selectedBranch !== "all")
  const emptyCopy = otherFilters
    ? { title: "No leave matches these filters", description: "Try clearing the filters." }
    : selectedYear && leaveRequests.length > 0
      ? {
          title: `No leave in ${selectedYear.label}`,
          description: `Nothing was recorded between ${yearRange(selectedYear).replace(" – ", " and ")}.`,
        }
      : { title: "No leave recorded yet", description: "Add a leave entry to get started." }

  // View switch and page actions sit in the filter row (list) or the calendar's
  // controls (calendar), not in the page header
  const pageActions = (
    <>
      <Tabs
        value={view}
        onValueChange={(v) => setView(v === "calendar" ? "calendar" : "list")}
        className="w-full sm:w-auto"
      >
        <TabsList className="w-full sm:w-auto" aria-label="Leave view">
          <TabsTrigger value="list" className="flex-1 sm:flex-none">
            <List />
            List
          </TabsTrigger>
          <TabsTrigger value="calendar" className="flex-1 sm:flex-none">
            <CalendarRange />
            Calendar
          </TabsTrigger>
        </TabsList>
      </Tabs>
      <Button variant="outline" onClick={() => setOnLeaveOpen(true)}>
        <Users />
        Who&apos;s on leave
      </Button>
      {view === "list" && (
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
      )}
      {canAdd && (
        <Button onClick={() => setIsAddModalOpen(true)}>
          <Plus />
          Add leave
        </Button>
      )}
    </>
  )

  const isMockData = branches.length > 0 && branches[0].id === "1" && branches[0].name === "London"

  return (
    <div className="space-y-6 sm:space-y-8">
      <PageHeader
        title="Leave"
        description={
          view === "calendar"
            ? "Who is off, by branch, with a warning when too many people are away at once."
            : isAdmin
              ? "Every leave entry across your organisation."
              : "Leave for employees in your branches."
        }
      />

      <div key={view} className="page-enter space-y-6 sm:space-y-8">
        {view === "calendar" ? (
          <TeamCalendar onOpen={handleViewDetails} actions={pageActions} />
        ) : (
          <>
            {isMockData && (
              <Alert variant="warning">
                <AlertTriangle />
                <AlertTitle>Using mock branch data</AlertTitle>
                <AlertDescription>
                  Supabase environment variables are missing. Set up the Supabase integration to use real data.
                </AlertDescription>
              </Alert>
            )}
            {isError && (
              <ErrorState title="Couldn't load leave" message={handleApiError(error)} onRetry={() => refetch()} />
            )}
            {isBranchesError && (
              <ErrorState
                title="Couldn't load branches"
                message={handleApiError(branchesError)}
                onRetry={() => window.location.reload()}
              />
            )}
            {isLeaveTypesError && (
              <ErrorState
                title="Couldn't load leave types"
                message={handleApiError(leaveTypesError)}
                onRetry={() => window.location.reload()}
              />
            )}

            <div className="surface overflow-hidden">
              <Toolbar className="border-b border-border/70 p-3 sm:p-4">
                <Select value={yearValue} onValueChange={setYear}>
                  <SelectTrigger className="sm:w-[200px]" aria-label="Leave year">
                    <SelectValue placeholder="Leave year" />
                  </SelectTrigger>
                  <SelectContent>
                    {years.map((y) => (
                      <SelectItem key={y.key} value={y.key}>
                        {y.label}
                        {y.isCurrent ? " (Current)" : ""}
                      </SelectItem>
                    ))}
                    <SelectItem value="all">All leave years</SelectItem>
                  </SelectContent>
                </Select>
                <div className="relative flex-1 sm:min-w-[220px] sm:max-w-xs">
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
                      {(isAdmin || (user?.branches && user.branches.length > 1)) && (
                        <SelectItem value="all">All branches</SelectItem>
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
                  <Button variant="ghost" onClick={resetFilters} disabled={isLoading}>
                    <X />
                    Clear filters
                  </Button>
                )}
                <div className="flex flex-wrap items-center gap-2 sm:ml-auto [&>*]:flex-1 sm:[&>*]:flex-none">
                  {pageActions}
                </div>
              </Toolbar>

              {/* Which leave year is showing, and its figures */}
              <div
                className="flex flex-col gap-1.5 border-b border-border/70 bg-muted/40 px-4 py-2.5 text-sm sm:flex-row sm:flex-wrap sm:items-center sm:gap-x-4 sm:px-5"
                aria-live="polite"
              >
                {selectedYear ? (
                  <p className="flex flex-wrap items-center gap-x-2 gap-y-1">
                    <span className="font-semibold tabular text-foreground">{yearRange(selectedYear)}</span>
                    {selectedYear.isCurrent ? (
                      <Badge variant="default" className="px-2 text-[11px] leading-[18px]">
                        Current leave year
                      </Badge>
                    ) : (
                      <Badge variant="secondary" className="px-2 text-[11px] leading-[18px]">
                        {isPastSelection ? "Past leave year · view only" : "Future leave year"}
                      </Badge>
                    )}
                  </p>
                ) : (
                  <p className="font-semibold text-foreground">All leave years</p>
                )}
                {isPeriodsError && (
                  <p className="text-xs text-muted-foreground">
                    Couldn&apos;t load the leave years from Settings, so 1 April is assumed.
                  </p>
                )}
                {summary && !isLoading && (
                  <p className="text-muted-foreground sm:ml-auto">
                    <span className="font-semibold tabular text-foreground">{summary.taken}</span> days annual leave
                    taken · <span className="font-semibold tabular text-foreground">{summary.pending}</span> days
                    pending
                    {summary.other > 0 && (
                      <>
                        {" "}
                        · <span className="font-semibold tabular text-foreground">{summary.other}</span> days other
                        leave
                      </>
                    )}
                    {singleEmployeeId &&
                      (selectedYear?.isCurrent ? (
                        singleEmployee && (
                          <>
                            {" "}
                            · {singleEmployee.name}: entitlement{" "}
                            <span className="font-semibold tabular text-foreground">
                              {singleEmployee.daysTaken + singleEmployee.daysRemaining}
                            </span>
                            , remaining{" "}
                            <span
                              className={cn(
                                "font-semibold tabular",
                                singleEmployee.daysRemaining < 0 ? "text-destructive" : "text-foreground",
                              )}
                            >
                              {singleEmployee.daysRemaining}
                            </span>
                          </>
                        )
                      ) : (
                        <> · Entitlement wasn&apos;t recorded for past years</>
                      ))}
                  </p>
                )}
              </div>

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
                    ) : rows.length > 0 ? (
                      rows.map((row) => (
                        <TableRow key={row.id} className="cursor-pointer" onClick={() => handleViewDetails(row.id)}>
                          <TableCell>
                            <div className="flex items-center gap-3">
                              <Avatar name={row.employee} />
                              <div className="min-w-0">
                                <p className="truncate font-semibold text-foreground">{row.employee}</p>
                                <p className="truncate text-xs text-muted-foreground">
                                  {row.branch}
                                  {row.employeeCode && row.employeeCode !== row.employeeId
                                    ? ` · ${row.employeeCode}`
                                    : ""}
                                </p>
                              </div>
                            </div>
                          </TableCell>
                          <TableCell>
                            <span className="inline-flex items-center gap-2 whitespace-nowrap">
                              <span
                                className="h-2 w-2 rounded-full"
                                style={{ backgroundColor: typeColor(row.type) }}
                                aria-hidden
                              />
                              {row.type}
                            </span>
                          </TableCell>
                          <TableCell className="whitespace-nowrap tabular">
                            {formatDisplayRange(row.startDate, row.endDate)}
                            {spansNote(row) && (
                              <span className="block text-xs text-muted-foreground">{spansNote(row)}</span>
                            )}
                          </TableCell>
                          <TableCell className="text-right tabular">{row.duration}</TableCell>
                          <TableCell
                            className={cn(
                              "hidden text-right tabular lg:table-cell",
                              (row.remaining ?? 0) < 0 && "font-semibold text-destructive",
                            )}
                          >
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
                          <EmptyState icon={CalendarDays} title={emptyCopy.title} description={emptyCopy.description} />
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
                ) : rows.length > 0 ? (
                  <ul className="divide-y divide-border/70">
                    {rows.map((row) => (
                      <li key={row.id} className="flex items-start gap-3 px-4 py-3.5">
                        <button
                          className="flex min-w-0 flex-1 items-start gap-3 text-left"
                          onClick={() => handleViewDetails(row.id)}
                        >
                          <Avatar name={row.employee} />
                          <span className="min-w-0 flex-1 space-y-1">
                            <span className="flex items-center justify-between gap-2">
                              <span className="truncate text-[15px] font-semibold">{row.employee}</span>
                              {statusBadge(row.status)}
                            </span>
                            <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
                              <span
                                className="h-2 w-2 shrink-0 rounded-full"
                                style={{ backgroundColor: typeColor(row.type) }}
                                aria-hidden
                              />
                              <span className="truncate">
                                {row.type} · {row.branch}
                              </span>
                            </span>
                            <span className="block text-[13px] font-medium tabular">
                              {formatDisplayRange(row.startDate, row.endDate)} · {plural(row.duration, "day")}
                            </span>
                            {spansNote(row) && (
                              <span className="block text-xs text-muted-foreground">{spansNote(row)}</span>
                            )}
                          </span>
                        </button>
                        {rowActions(row)}
                      </li>
                    ))}
                  </ul>
                ) : (
                  <EmptyState icon={CalendarDays} title={emptyCopy.title} description={emptyCopy.description} />
                )}
              </div>

              {!isLoading && rows.length > 0 && (
                <div className="border-t border-border/70 px-4 py-3 text-sm text-muted-foreground sm:px-5">
                  {plural(rows.length, "entry", "entries")}
                  {selectedYear && ` in ${selectedYear.label}`}
                </div>
              )}
            </div>
          </>
        )}
      </div>

      <AddLeaveModal open={isAddModalOpen} onOpenChange={setIsAddModalOpen} />

      <WhosOnLeaveDialog open={onLeaveOpen} onOpenChange={setOnLeaveOpen} />

      <EditLeaveModal leave={leaveToEdit} open={!!leaveToEdit} onOpenChange={(open) => !open && setLeaveToEdit(null)} />

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
        title="Delete leave entry"
        description={`Delete this ${leaveToDelete?.type ?? "leave"} entry for ${leaveToDelete?.employee}? Any days it used go back to their balance. This can't be undone.`}
        confirmLabel="Delete"
        cancelLabel="Cancel"
      />
    </div>
  )
}
