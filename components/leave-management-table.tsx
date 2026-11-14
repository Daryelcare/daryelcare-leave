"use client"

import { createPortal } from "react-dom"

// The Leave page (admin side), modelled on CarerHR's client admin Leave page:
// summary tiles, filters kept in the address, a list with selection and bulk
// decisions, a request panel, and the team calendar.

import { useState, useEffect, useMemo } from "react"
import { useQuery } from "@tanstack/react-query"
import { useRouter, useSearchParams } from "next/navigation"
import {
  AlertTriangle,
  CalendarCheck,
  CalendarRange,
  Check,
  Clock,
  Download,
  Eye,
  FileSpreadsheet,
  FileText,
  List,
  Loader2,
  MoreHorizontal,
  Pencil,
  PlaneTakeoff,
  Plus,
  RotateCcw,
  Search,
  SlidersHorizontal,
  Trash2,
  Users,
  UsersRound,
  X,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Badge } from "@/components/ui/badge"
import { Checkbox } from "@/components/ui/checkbox"
import { Skeleton } from "@/components/ui/skeleton"
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { DatePicker } from "@/components/ui/date-picker"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { useToast } from "@/components/ui/use-toast"
import { Avatar, EmptyState, ErrorState, ListSkeleton, PageHeader, StatCard, plural } from "./page-kit"
import { DeleteConfirmationDialog } from "./delete-confirmation-dialog"
import { AddLeaveModal } from "./add-leave-modal"
import { EditLeaveModal } from "./edit-leave-modal"
import { LeaveRequestSheet } from "./leave-request-sheet"
import { RejectLeaveDialog } from "./reject-leave-dialog"
import { OverEntitlementDialog } from "./over-entitlement-dialog"
import { TablePagination } from "./table-pagination"
import { TeamCalendar } from "./team-calendar"
import { WhosOnLeaveDialog } from "./whos-on-leave-dialog"
import { useApp } from "./app-provider"
import { fetchWithAuth, handleApiError } from "@/lib/api-utils"
import { cn } from "@/lib/utils"
import { useBranches } from "@/hooks/use-branches"
import { useLeaveTypes } from "@/hooks/use-leave-types"
import { type Decision, useLeaveActions } from "@/hooks/use-leave-actions"
import type { LeaveRequest } from "@/lib/types"
import { LEAVE_PATH } from "@/lib/navigation"
import { formatDisplayRange, localDateToUtc, parseDateToUtc, toIsoDate, todayUtc, utcToLocalDate } from "@/lib/dates"
import {
  type StoredPeriod,
  buildLeaveYears,
  crossesYear,
  daysInYear,
  inYear,
  summariseYear,
  yearRange,
} from "@/lib/leave-years"
import {
  DATE_PRESETS,
  LEAVE_SORTS,
  STATUS_FILTERS,
  type PageSize,
  dateWindow,
  inWindow,
  leaveCounts,
  overEntitlement,
  paginate,
  sortLeave,
  toDatePreset,
  toLeaveSort,
  toStatusFilter,
} from "@/lib/leave-list"

type LeaveView = "list" | "calendar"
type EmployeeBalance = {
  id: string
  name: string
  branch: string
  status?: string
  daysRemaining: number
  daysTaken: number
}

export function LeaveManagementTable() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const { toast } = useToast()
  const { user } = useApp()
  const isAdmin = user?.role === "admin"
  const canManage = isAdmin || (user?.role === "normal" && !!user?.branches && user.branches.length > 0)

  // ------------------------------------------------------------ address state
  // View, leave year, status, dates and sort live in the address so a link
  // (or a summary tile) can open the page already filtered.
  const view: LeaveView = searchParams.get("view") === "calendar" ? "calendar" : "list"
  const status = toStatusFilter(searchParams.get("status"))
  const datePreset = toDatePreset(searchParams.get("dates"))
  const sort = toLeaveSort(searchParams.get("sort"))
  const customFrom = parseDateToUtc(searchParams.get("from"))
  const customTo = parseDateToUtc(searchParams.get("to"))
  const yearParam = searchParams.get("year")

  const setParams = (patch: Record<string, string | null>) => {
    const next = new URLSearchParams(searchParams.toString())
    for (const [key, value] of Object.entries(patch)) {
      if (value === null || value === "") next.delete(key)
      else next.set(key, value)
    }
    const qs = next.toString()
    router.replace(qs ? `${LEAVE_PATH}?${qs}` : LEAVE_PATH, { scroll: false })
  }
  const setView = (next: LeaveView) => setParams({ view: next === "calendar" ? "calendar" : null })

  // ------------------------------------------------------------ local filters
  const [employeeSearch, setEmployeeSearch] = useState("")
  const [debouncedSearch, setDebouncedSearch] = useState("")
  const [selectedType, setSelectedType] = useState<string>("all")
  const [selectedBranch, setSelectedBranch] = useState<string>(
    !isAdmin && user?.branches && user.branches.length === 1 ? user.branches[0] : "all",
  )
  const [filtersOpen, setFiltersOpen] = useState(false)
  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(employeeSearch), 300)
    return () => clearTimeout(timer)
  }, [employeeSearch])

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

  // The branches this person can see, as API parameters
  const branchParams = (params: URLSearchParams) => {
    if (selectedBranch !== "all") params.append("branch", selectedBranch)
    else if (!isAdmin && user?.branches && user.branches.length > 0) {
      if (user.branches.length === 1) params.append("branch", user.branches[0])
      else params.append("branches", user.branches.join(","))
    }
  }

  // ------------------------------------------------------------ data
  const {
    data: leaveRequests = [],
    isLoading,
    isFetching,
    isError,
    error,
    refetch,
  } = useQuery<LeaveRequest[]>({
    queryKey: ["leaveRequests", selectedBranch, selectedType, debouncedSearch],
    queryFn: () => {
      const params = new URLSearchParams()
      branchParams(params)
      if (selectedType !== "all") params.append("type", selectedType)
      if (debouncedSearch) params.append("employee", debouncedSearch)
      return fetchWithAuth(`/api/leave-requests?${params.toString()}`)
    },
  })

  // The tiles count everything in the chosen branch, whatever the other filters
  const { data: allLeave = [], isLoading: isLoadingAll } = useQuery<LeaveRequest[]>({
    queryKey: ["leaveRequestsAll", selectedBranch],
    queryFn: () => {
      const params = new URLSearchParams()
      branchParams(params)
      return fetchWithAuth(`/api/leave-requests?${params.toString()}`)
    },
  })
  const { data: employeesData, isLoading: isLoadingEmployees } = useQuery<{ data: EmployeeBalance[] }>({
    queryKey: ["employees", "balances", selectedBranch],
    queryFn: () => {
      const params = new URLSearchParams({ pageSize: "1000" })
      branchParams(params)
      return fetchWithAuth(`/api/employees?${params.toString()}`)
    },
  })

  const { data: periods = [], isError: isPeriodsError } = useQuery<StoredPeriod[]>({
    queryKey: ["leavePeriods"],
    queryFn: () => fetchWithAuth("/api/leave-periods"),
  })
  const today = useMemo(() => todayUtc(), [])

  // ------------------------------------------------------------ leave years
  const years = useMemo(() => buildLeaveYears(periods, leaveRequests, today), [periods, leaveRequests, today])
  const currentYear = years.find((y) => y.isCurrent) ?? years[0]
  const selectedYear = yearParam === "all" ? null : (years.find((y) => y.key === yearParam) ?? currentYear ?? null)
  const yearValue = yearParam === "all" ? "all" : (selectedYear?.key ?? "all")
  const setYear = (key: string) => setParams({ year: key === currentYear?.key ? null : key })
  const isPastSelection = !!selectedYear && !!currentYear && selectedYear.end < currentYear.start

  // Leave that ended before the current leave year is view only here: changing
  // it would adjust the employee's current balance, not that year's
  const isReadOnly = (row: LeaveRequest) => {
    const end = parseDateToUtc(row.endDate)
    return !!currentYear && end !== null && end < currentYear.start
  }

  // ------------------------------------------------------------ the list
  const yearRows = useMemo(
    () => (selectedYear ? leaveRequests.filter((r) => inYear(r, selectedYear)) : leaveRequests),
    [leaveRequests, selectedYear],
  )
  const summary = useMemo(() => (selectedYear ? summariseYear(yearRows, selectedYear) : null), [yearRows, selectedYear])
  const dateRange = useMemo(
    () => dateWindow(datePreset, today, { from: customFrom, to: customTo }),
    [datePreset, today, customFrom, customTo],
  )
  const filtered = useMemo(
    () =>
      sortLeave(
        yearRows.filter((r) => (status === "all" || r.status === status) && inWindow(r, dateRange)),
        sort,
      ),
    [yearRows, status, sort, dateRange],
  )

  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState<PageSize>(50)
  const filterKey = JSON.stringify([
    yearValue,
    status,
    datePreset,
    customFrom,
    customTo,
    sort,
    selectedBranch,
    selectedType,
    debouncedSearch,
  ])
  useEffect(() => setPage(1), [filterKey, pageSize])
  const paged = paginate(filtered, page, pageSize)

  // ------------------------------------------------------------ summary tiles
  const counts = useMemo(() => leaveCounts(allLeave, today), [allLeave, today])
  const overPeople = useMemo(() => overEntitlement(employeesData?.data || []), [employeesData])

  // The tiles are shortcuts to the list behind their numbers
  const showList = (patch: Record<string, string | null>) => {
    setEmployeeSearch("")
    setSelectedType("all")
    setParams({ view: null, year: "all", status: null, dates: null, from: null, to: null, sort: null, ...patch })
  }

  // ------------------------------------------------------------ selection
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  useEffect(() => setSelectedIds(new Set()), [filterKey, page, pageSize, view])
  const selectable = paged.items.filter((r) => !isReadOnly(r))
  const selectedRows = filtered.filter((r) => selectedIds.has(r.id))
  const allSelected = selectable.length > 0 && selectable.every((r) => selectedIds.has(r.id))
  const toggleOne = (id: string) =>
    setSelectedIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  const toggleAll = () => setSelectedIds(allSelected ? new Set() : new Set(selectable.map((r) => r.id)))

  // ------------------------------------------------------------ decisions
  const { decide, remove, busyIds } = useLeaveActions()
  const [openId, setOpenId] = useState<string | null>(null)
  const [focusReject, setFocusReject] = useState(false)
  const openLeave = leaveRequests.find((r) => r.id === openId) ?? allLeave.find((r) => r.id === openId) ?? null
  const openRequest = (id: string, reject = false) => {
    setFocusReject(reject)
    setOpenId(id)
  }
  const [rejectTargets, setRejectTargets] = useState<LeaveRequest[]>([])
  const [deleteTargets, setDeleteTargets] = useState<LeaveRequest[]>([])
  const [leaveToEdit, setLeaveToEdit] = useState<LeaveRequest | null>(null)

  const decideRows = async (rows: LeaveRequest[], next: Decision, note?: string) => {
    const ok = await decide(rows, next, note)
    if (ok) setSelectedIds(new Set())
    return ok
  }

  // ------------------------------------------------------------ dialogs and links
  const [isAddModalOpen, setIsAddModalOpen] = useState(false)
  const [onLeaveOpen, setOnLeaveOpen] = useState(false)
  const [overOpen, setOverOpen] = useState(false)

  // Links (?request=<id>, ?record=1) act once, then leave the address
  const linkedRequest = searchParams.get("request")
  const linkedRecord = searchParams.get("record") === "1"
  useEffect(() => {
    if (!linkedRequest && !linkedRecord) return
    if (linkedRequest) openRequest(linkedRequest)
    if (linkedRecord && canManage) setIsAddModalOpen(true)
    setParams({ request: null, record: null })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [linkedRequest, linkedRecord])

  // ------------------------------------------------------------ export
  const [isExporting, setIsExporting] = useState(false)
  const [exportFormat, setExportFormat] = useState<string | null>(null)
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
      // The date filter if one is set, otherwise the leave year
      const range = dateRange ?? (selectedYear ? { from: selectedYear.start, to: selectedYear.end } : null)
      if (range) {
        formData.append("startDate", toIsoDate(range.from))
        formData.append("endDate", toIsoDate(range.to))
        formData.append("dateFilterMode", "overlap")
      }
      const response = await fetch("/api/export/leave-requests", { method: "POST", body: formData })
      if (!response.ok) throw new Error(`Export failed with status ${response.status}`)
      let filename = `leave-requests.${format === "csv" ? "csv" : "xlsx"}`
      const match = response.headers.get("Content-Disposition")?.match(/filename="(.+)"/)
      if (match?.[1]) filename = match[1]
      const url = URL.createObjectURL(await response.blob())
      const a = Object.assign(document.createElement("a"), { href: url, download: filename })
      document.body.appendChild(a)
      a.click()
      a.remove()
      URL.revokeObjectURL(url)
      toast({
        title: "Export ready",
        description: filtersActive
          ? "Only the leave matching your filters."
          : `Your ${format === "csv" ? "CSV" : "Excel"} file has been downloaded.`,
      })
    } catch (err) {
      console.error("Export error:", err)
      toast({ title: "Export failed", description: "Please try again in a moment.", variant: "destructive" })
    } finally {
      setIsExporting(false)
      setExportFormat(null)
    }
  }

  // ------------------------------------------------------------ filters state
  const yearFiltered = !!yearParam && yearValue !== currentYear?.key
  const activeFilters = [
    employeeSearch !== "",
    selectedType !== "all",
    isAdmin && selectedBranch !== "all",
    yearFiltered,
    status !== "all",
    datePreset !== "any",
  ].filter(Boolean).length
  const filtersActive = activeFilters > 0
  const resetFilters = () => {
    setEmployeeSearch("")
    setSelectedBranch(!isAdmin && user?.branches && user.branches.length === 1 ? user.branches[0] : "all")
    setSelectedType("all")
    setParams({ year: null, status: null, dates: null, from: null, to: null, sort: null })
  }

  const typeColor = (type: string) => leaveTypes.find((t) => t.name === type)?.color || "#64748b"
  const statusBadge = (s: string) => (
    <Badge dot variant={s === "Approved" ? "success" : s === "Pending" ? "warning" : "destructive"}>
      {s}
    </Badge>
  )

  const rowActions = (row: LeaveRequest) => (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className="h-8 w-8"
          disabled={busyIds.has(row.id)}
          onClick={(e) => e.stopPropagation()}
        >
          <span className="sr-only">Actions for {row.employee}</span>
          {busyIds.has(row.id) ? <Loader2 className="animate-spin" /> : <MoreHorizontal />}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" onClick={(e) => e.stopPropagation()}>
        <DropdownMenuItem onClick={() => openRequest(row.id)}>
          <Eye />
          View details
        </DropdownMenuItem>
        {isReadOnly(row) ? (
          <p className="px-2.5 py-1.5 text-xs text-muted-foreground">From a past leave year, so view only.</p>
        ) : (
          <>
            {row.status !== "Approved" && (
              <DropdownMenuItem onClick={() => decideRows([row], "Approved")}>
                <Check />
                Approve
              </DropdownMenuItem>
            )}
            {row.status !== "Rejected" && (
              <DropdownMenuItem onClick={() => setRejectTargets([row])}>
                <X />
                Reject…
              </DropdownMenuItem>
            )}
            {row.status !== "Pending" && (
              <DropdownMenuItem onClick={() => decideRows([row], "Pending")}>
                <RotateCcw />
                Reset to pending
              </DropdownMenuItem>
            )}
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={() => setLeaveToEdit(row)}>
              <Pencil />
              Edit
            </DropdownMenuItem>
            <DropdownMenuItem
              className="text-destructive focus:text-destructive [&_svg]:!text-destructive"
              onClick={() => setDeleteTargets([row])}
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

  const narrowing = activeFilters > (yearFiltered ? 1 : 0) || filtersActive
  const emptyCopy =
    leaveRequests.length === 0 && !employeeSearch && selectedType === "all"
      ? {
          title: "No leave recorded yet",
          description: canManage ? "Add leave to get started." : "Leave for your branches will appear here.",
          action: canManage ? (
            <Button onClick={() => setIsAddModalOpen(true)}>
              <Plus />
              Add leave
            </Button>
          ) : undefined,
        }
      : narrowing && (status !== "all" || datePreset !== "any" || employeeSearch || selectedType !== "all")
        ? {
            title: "No leave matches these filters",
            description: "Clear the filters or try another search.",
            action: (
              <Button variant="outline" onClick={resetFilters}>
                <X />
                Clear filters
              </Button>
            ),
          }
        : selectedYear
          ? {
              title: `No leave in ${selectedYear.label}`,
              description: `Nothing was recorded between ${yearRange(selectedYear).replace(" – ", " and ")}.`,
              action: undefined,
            }
          : { title: "No leave matches these filters", description: "Clear the filters.", action: undefined }

  // ------------------------------------------------------------ page actions
  const pageActions = (
    <>
      <Tabs value={view} onValueChange={(v) => setView(v === "calendar" ? "calendar" : "list")} className="w-auto">
        <TabsList aria-label="Leave view">
          <TabsTrigger value="list">
            <List />
            <span className="max-sm:sr-only">List</span>
          </TabsTrigger>
          <TabsTrigger value="calendar">
            <CalendarRange />
            <span className="max-sm:sr-only">Calendar</span>
          </TabsTrigger>
        </TabsList>
      </Tabs>
      <Button variant="outline" onClick={() => setOnLeaveOpen(true)} aria-label="Who's on leave" title="Who's on leave">
        <Users />
        <span className="max-sm:sr-only">Who&apos;s on leave</span>
      </Button>
      {view === "list" && (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline" disabled={isExporting} aria-label="Export" title="Export">
              {isExporting ? <Loader2 className="animate-spin" /> : <Download />}
              <span className="max-sm:sr-only">
                {isExporting ? `Exporting ${exportFormat === "csv" ? "CSV" : "Excel"}…` : "Export"}
              </span>
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
      {canManage && (
        <Button onClick={() => setIsAddModalOpen(true)} className="max-sm:flex-1">
          <Plus />
          Add leave
        </Button>
      )}
    </>
  )

  const isMockData = branches.length > 0 && branches[0].id === "1" && branches[0].name === "London"
  const filterSelect = "w-full sm:w-[170px]"

  return (
    // Room under the list while the bulk bar floats over the bottom
    <div className={cn("space-y-6 sm:space-y-8", canManage && view === "list" && selectedRows.length > 0 && "pb-20")}>
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

      {/* Summary tiles: each is a shortcut to the list or people behind it */}
      <section aria-label="Leave at a glance" className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard
          label="Pending approval"
          icon={Clock}
          value={counts.pending}
          detail="Requests needing a decision"
          tone={counts.pending > 0 ? "warning" : "default"}
          loading={isLoadingAll}
          onClick={() => showList({ status: "Pending" })}
          actionLabel="Show the pending requests"
        />
        <StatCard
          label="Away today"
          icon={UsersRound}
          value={counts.awayToday}
          detail="People on approved leave"
          loading={isLoadingAll}
          onClick={() => setOnLeaveOpen(true)}
          actionLabel="See who is away"
        />
        <StatCard
          label="Upcoming leave"
          icon={PlaneTakeoff}
          value={counts.upcoming}
          detail="Starting in the next 30 days"
          loading={isLoadingAll}
          onClick={() => showList({ status: "Approved", dates: "next30", sort: "start_soonest" })}
          actionLabel="Show approved leave starting soon"
        />
        <StatCard
          label="Over entitlement"
          icon={AlertTriangle}
          value={overPeople.length}
          detail="Current staff below zero"
          tone={overPeople.length > 0 ? "danger" : "default"}
          loading={isLoadingEmployees}
          onClick={() => setOverOpen(true)}
          actionLabel="See who is over"
        />
      </section>

      <div key={view} className="page-enter space-y-6 sm:space-y-8">
        {view === "calendar" ? (
          <TeamCalendar
            onOpen={(id) => openRequest(id)}
            actions={pageActions}
            typeFilter={selectedType}
            search={debouncedSearch}
          />
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
                onRetry={() => location.reload()}
              />
            )}
            {isLeaveTypesError && (
              <ErrorState
                title="Couldn't load leave types"
                message={handleApiError(leaveTypesError)}
                onRetry={() => location.reload()}
              />
            )}

            <div className="surface overflow-hidden">
              {/* Filters and page actions */}
              <div className="space-y-2.5 border-b border-border/70 p-3 sm:p-4">
                <div className="flex flex-col gap-2.5 sm:flex-row sm:flex-wrap sm:items-center">
                  <div className="flex gap-2 sm:contents">
                    <div className="relative min-w-0 flex-1 sm:min-w-[220px] sm:max-w-xs sm:flex-1">
                      <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                      <Input
                        placeholder="Search employee"
                        aria-label="Search employee name"
                        className="pl-10"
                        value={employeeSearch}
                        onChange={(e) => setEmployeeSearch(e.target.value)}
                      />
                    </div>
                    {/* Phones: the filters fold away behind one button */}
                    <Button
                      variant="outline"
                      className="shrink-0 sm:hidden"
                      onClick={() => setFiltersOpen((o) => !o)}
                      aria-expanded={filtersOpen}
                      aria-controls="leave-filters"
                    >
                      <SlidersHorizontal />
                      Filters
                      {activeFilters > 0 && (
                        <span className="rounded-full bg-primary px-1.5 text-[11px] font-bold leading-5 text-primary-foreground">
                          {activeFilters}
                        </span>
                      )}
                    </Button>
                  </div>

                  <div
                    id="leave-filters"
                    className={cn(
                      filtersOpen ? "grid" : "hidden",
                      "grid-cols-2 gap-2 sm:flex sm:flex-wrap sm:items-center",
                    )}
                  >
                    <Select value={yearValue} onValueChange={setYear}>
                      <SelectTrigger className={cn(filterSelect, "sm:w-[190px]")} aria-label="Leave year">
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
                    <Select value={selectedBranch} onValueChange={setSelectedBranch} disabled={isLoadingBranches}>
                      <SelectTrigger className={filterSelect} aria-label="Branch">
                        <SelectValue placeholder="All branches" />
                      </SelectTrigger>
                      <SelectContent>
                        {(isAdmin || (user?.branches && user.branches.length > 1)) && (
                          <SelectItem value="all">All branches</SelectItem>
                        )}
                        {branches
                          .filter((b) => isAdmin || (user?.branches && user.branches.includes(b.name)))
                          .map((b) => (
                            <SelectItem key={b.id} value={b.name}>
                              {b.name}
                            </SelectItem>
                          ))}
                      </SelectContent>
                    </Select>
                    <Select value={selectedType} onValueChange={setSelectedType} disabled={isLoadingLeaveTypes}>
                      <SelectTrigger className={filterSelect} aria-label="Leave type">
                        <SelectValue placeholder="All types" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">All types</SelectItem>
                        {leaveTypes.map((t) => (
                          <SelectItem key={t.id} value={t.name}>
                            {t.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <Select value={status} onValueChange={(v) => setParams({ status: v === "all" ? null : v })}>
                      <SelectTrigger className={filterSelect} aria-label="Status">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {STATUS_FILTERS.map((s) => (
                          <SelectItem key={s.value} value={s.value}>
                            {s.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <Select
                      value={datePreset}
                      onValueChange={(v) =>
                        setParams({
                          dates: v === "any" ? null : v,
                          ...(v === "custom" ? {} : { from: null, to: null }),
                        })
                      }
                    >
                      <SelectTrigger className={filterSelect} aria-label="Dates">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {DATE_PRESETS.map((d) => (
                          <SelectItem key={d.value} value={d.value}>
                            {d.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <Select value={sort} onValueChange={(v) => setParams({ sort: v === "pending_first" ? null : v })}>
                      <SelectTrigger className={filterSelect} aria-label="Sort">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {LEAVE_SORTS.map((s) => (
                          <SelectItem key={s.value} value={s.value}>
                            {s.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    {filtersActive && (
                      <Button variant="ghost" onClick={resetFilters} className="col-span-2 sm:col-span-1">
                        <X />
                        Clear filters
                      </Button>
                    )}
                  </div>

                  <div className="flex items-center gap-2 sm:ml-auto">{pageActions}</div>
                </div>

                {datePreset === "custom" && (
                  <div
                    className={cn(filtersOpen ? "flex" : "hidden", "flex-wrap items-end gap-2 sm:flex")}
                    aria-label="Custom dates"
                  >
                    <div className="space-y-1">
                      <Label htmlFor="leave-from" className="text-xs text-muted-foreground">
                        Leave touching, from
                      </Label>
                      <DatePicker
                        id="leave-from"
                        value={customFrom !== null ? utcToLocalDate(customFrom) : undefined}
                        onChange={(d) => setParams({ from: d ? toIsoDate(localDateToUtc(d)) : null })}
                      />
                    </div>
                    <div className="space-y-1">
                      <Label htmlFor="leave-to" className="text-xs text-muted-foreground">
                        to
                      </Label>
                      <DatePicker
                        id="leave-to"
                        value={customTo !== null ? utcToLocalDate(customTo) : undefined}
                        min={customFrom !== null ? utcToLocalDate(customFrom) : undefined}
                        onChange={(d) => setParams({ to: d ? toIsoDate(localDateToUtc(d)) : null })}
                      />
                    </div>
                    {!dateRange && (
                      <p className="pb-2 text-xs font-medium text-muted-foreground" role="status">
                        Pick both dates, with the end on or after the start, to filter.
                      </p>
                    )}
                  </div>
                )}
              </div>

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
                  </p>
                )}
              </div>

              {/* Desktop and tablet: table */}
              <div className={cn("hidden md:block", isFetching && !isLoading && "opacity-70 transition-opacity")}>
                <Table>
                  <TableHeader>
                    <TableRow className="hover:bg-transparent">
                      {canManage && (
                        <TableHead className="w-12">
                          <Checkbox
                            checked={allSelected}
                            onCheckedChange={toggleAll}
                            disabled={selectable.length === 0}
                            aria-label="Select all on this page"
                          />
                        </TableHead>
                      )}
                      <TableHead>Employee</TableHead>
                      <TableHead>Type</TableHead>
                      <TableHead>Dates</TableHead>
                      <TableHead className="text-right">Days</TableHead>
                      <TableHead className="hidden text-right lg:table-cell">Balance after</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead className="w-12">
                        <span className="sr-only">Actions</span>
                      </TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {isLoading ? (
                      Array.from({ length: 6 }).map((_, i) => (
                        <TableRow key={i} className="hover:bg-transparent">
                          <TableCell colSpan={8} className="py-3">
                            <div className="flex items-center gap-3">
                              <Skeleton className="h-9 w-9 rounded-full" />
                              <Skeleton className="h-4 w-1/5" />
                              <Skeleton className="ml-auto h-4 w-1/3" />
                            </div>
                          </TableCell>
                        </TableRow>
                      ))
                    ) : paged.items.length > 0 ? (
                      paged.items.map((row) => (
                        <TableRow
                          key={row.id}
                          className="cursor-pointer"
                          data-state={selectedIds.has(row.id) ? "selected" : undefined}
                          onClick={() => openRequest(row.id)}
                        >
                          {canManage && (
                            <TableCell onClick={(e) => e.stopPropagation()}>
                              <Checkbox
                                checked={selectedIds.has(row.id)}
                                onCheckedChange={() => toggleOne(row.id)}
                                disabled={isReadOnly(row)}
                                aria-label={`Select ${row.employee}'s leave`}
                              />
                            </TableCell>
                          )}
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
                        <TableCell colSpan={8}>
                          <EmptyState
                            icon={CalendarCheck}
                            title={emptyCopy.title}
                            description={emptyCopy.description}
                            action={emptyCopy.action}
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
                ) : paged.items.length > 0 ? (
                  <ul className="divide-y divide-border/70">
                    {paged.items.map((row) => (
                      <li
                        key={row.id}
                        className={cn(
                          "flex items-start gap-2 px-3 py-3.5",
                          selectedIds.has(row.id) && "bg-primary-soft/50",
                        )}
                      >
                        {canManage && (
                          <span className="flex h-10 w-8 shrink-0 items-center justify-center">
                            <Checkbox
                              checked={selectedIds.has(row.id)}
                              onCheckedChange={() => toggleOne(row.id)}
                              disabled={isReadOnly(row)}
                              aria-label={`Select ${row.employee}'s leave`}
                            />
                          </span>
                        )}
                        <button
                          className="flex min-w-0 flex-1 items-start gap-3 text-left"
                          onClick={() => openRequest(row.id)}
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
                  <EmptyState
                    icon={CalendarCheck}
                    title={emptyCopy.title}
                    description={emptyCopy.description}
                    action={emptyCopy.action}
                  />
                )}
              </div>

              {!isLoading && filtered.length > 0 && (
                <TablePagination
                  page={paged.page}
                  pages={paged.pages}
                  from={paged.from}
                  to={paged.to}
                  total={filtered.length}
                  pageSize={pageSize}
                  label={selectedYear ? `entries in ${selectedYear.label}` : "entries"}
                  onPageChange={setPage}
                  onPageSizeChange={setPageSize}
                />
              )}
            </div>
          </>
        )}
      </div>

      {/* Bulk actions for the ticked rows */}
      {/* Rendered into <body>: the page's entry animation leaves a transform on
          the page, which would pin a "fixed" bar to the page instead of the screen */}
      {canManage &&
        view === "list" &&
        selectedRows.length > 0 &&
        createPortal(
          <div className="fixed inset-x-0 bottom-[calc(5rem+env(safe-area-inset-bottom))] z-40 flex justify-center px-4 md:bottom-6">
            <div
              role="toolbar"
              aria-label="Selected leave"
              className="flex max-w-full flex-wrap items-center justify-center gap-2 rounded-2xl border border-border/80 bg-card px-3 py-2.5 shadow-dialog"
            >
              <span className="px-1 text-sm font-semibold" aria-live="polite">
                {selectedRows.length} selected
              </span>
              <Button size="sm" onClick={() => decideRows(selectedRows, "Approved")}>
                <Check />
                Approve
              </Button>
              <Button
                size="sm"
                variant="outline"
                className="text-destructive hover:text-destructive"
                onClick={() => setRejectTargets(selectedRows)}
              >
                <X />
                Reject
              </Button>
              <Button size="sm" variant="secondary" onClick={() => decideRows(selectedRows, "Pending")}>
                <RotateCcw />
                Reset to pending
              </Button>
              <Button
                size="sm"
                variant="outline"
                className="text-destructive hover:text-destructive"
                onClick={() => setDeleteTargets(selectedRows)}
              >
                <Trash2 />
                Delete
              </Button>
              <Button
                size="icon"
                variant="ghost"
                className="h-8 w-8"
                onClick={() => setSelectedIds(new Set())}
                aria-label="Clear selection"
              >
                <X />
              </Button>
            </div>
          </div>,
          document.body,
        )}

      <LeaveRequestSheet
        leave={openLeave}
        open={!!openId && !!openLeave}
        onOpenChange={(o) => !o && setOpenId(null)}
        readOnly={!!openLeave && isReadOnly(openLeave)}
        busy={!!openLeave && busyIds.has(openLeave.id)}
        focusReject={focusReject}
        typeColor={typeColor}
        onDecide={(next, note) => (openLeave ? decideRows([openLeave], next, note) : Promise.resolve(false))}
        onEdit={() => {
          if (openLeave) setLeaveToEdit(openLeave)
          setOpenId(null)
        }}
        onDelete={() => {
          if (openLeave) setDeleteTargets([openLeave])
          setOpenId(null)
        }}
      />

      <RejectLeaveDialog
        count={rejectTargets.length}
        who={rejectTargets[0]?.employee}
        open={rejectTargets.length > 0}
        onOpenChange={(o) => !o && setRejectTargets([])}
        onConfirm={async (reason) => {
          const ok = await decideRows(rejectTargets, "Rejected", reason)
          if (ok) setRejectTargets([])
          return ok
        }}
      />

      <DeleteConfirmationDialog
        isOpen={deleteTargets.length > 0}
        onClose={() => setDeleteTargets([])}
        onConfirm={async () => {
          const targets = deleteTargets
          setDeleteTargets([])
          if (await remove(targets)) setSelectedIds(new Set())
        }}
        title={deleteTargets.length > 1 ? `Delete ${deleteTargets.length} leave entries` : "Delete leave entry"}
        description={
          deleteTargets.length > 1
            ? `Delete these ${deleteTargets.length} entries? Any days they used go back to the balance. This can't be undone.`
            : `Delete this ${deleteTargets[0]?.type ?? "leave"} entry for ${deleteTargets[0]?.employee}? Any days it used go back to their balance. This can't be undone.`
        }
        confirmLabel="Delete"
        cancelLabel="Cancel"
      />

      <AddLeaveModal open={isAddModalOpen} onOpenChange={setIsAddModalOpen} />
      <EditLeaveModal leave={leaveToEdit} open={!!leaveToEdit} onOpenChange={(o) => !o && setLeaveToEdit(null)} />
      <WhosOnLeaveDialog open={onLeaveOpen} onOpenChange={setOnLeaveOpen} />
      <OverEntitlementDialog people={overPeople} open={overOpen} onOpenChange={setOverOpen} />
    </div>
  )
}
