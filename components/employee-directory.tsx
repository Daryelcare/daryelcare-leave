"use client"

// The Employees page: everyone in your branches, with what matters at a glance
// (leave left, who's away and when they're next off, right to work, missing
// details), filters kept in the address, and bulk actions. Each name opens the
// person's full profile.

import { useEffect, useMemo, useState } from "react"
import { createPortal } from "react-dom"
import Link from "next/link"
import { useRouter, useSearchParams } from "next/navigation"
import { useQuery, useQueryClient } from "@tanstack/react-query"
import {
  ArrowRightLeft,
  CalendarClock,
  FileWarning,
  Loader2,
  MoreHorizontal,
  Pencil,
  Plus,
  RotateCcw,
  Search,
  ShieldAlert,
  Trash2,
  Upload,
  UserMinus,
  UserRound,
  Users,
  X,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Checkbox } from "@/components/ui/checkbox"
import { Label } from "@/components/ui/label"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { useToast } from "@/components/ui/use-toast"
import { fetchWithAuth, handleApiError } from "@/lib/api-utils"
import { useBranches } from "@/hooks/use-branches"
import { formatDisplayDate, formatDisplayRange } from "@/lib/dates"
import { daysLabel } from "@/lib/document-view"
import { paginate, type PageSize } from "@/lib/pagination"
import { cn } from "@/lib/utils"
import {
  PEOPLE_SHOW,
  PEOPLE_SORTS,
  isLeaver,
  matchesPeopleSearch,
  matchesShow,
  peopleSummary,
  shownJobTitle,
  sortPeople,
  toPeopleShow,
  toPeopleSort,
  toPeopleStatus,
  type DirectoryEmployee,
  type PeopleShow,
} from "@/lib/employee-directory"
import { AddEmployeeModal } from "./add-employee-modal"
import { EmployeePanel } from "./employee-profile"
import { EditEmployeeModal } from "./edit-employee-modal"
import { ImportEmployeesModal } from "./import-employees-modal"
import { DeleteConfirmationDialog } from "./delete-confirmation-dialog"
import { ExportButton } from "./export-button"
import { TablePagination } from "./table-pagination"
import { useApp } from "./app-provider"
import { Avatar, EmptyState, ErrorState, ListSkeleton, PageHeader, StatCard, plural } from "./page-kit"

const NO_ROWS: DirectoryEmployee[] = []

/** Right to work in one short chip */
export function RtwChip({ rtw }: { rtw: DirectoryEmployee["rtw"] }) {
  switch (rtw.state) {
    case "expired":
      return (
        <Badge variant="destructive" dot className="px-2 text-[11px] leading-[18px]">
          Expired {rtw.date ? formatDisplayDate(rtw.date) : ""}
        </Badge>
      )
    case "due":
      return (
        <Badge variant="warning" dot className="px-2 text-[11px] leading-[18px]">
          {daysLabel(rtw.days)}
        </Badge>
      )
    case "missing":
      return (
        <Badge variant="warning" dot className="px-2 text-[11px] leading-[18px]">
          No date on file
        </Badge>
      )
    case "ok":
      return (
        <Badge variant="success" dot className="px-2 text-[11px] leading-[18px]">
          Until {rtw.date ? formatDisplayDate(rtw.date) : "—"}
        </Badge>
      )
    default:
      return <span className="text-xs text-muted-foreground">No expiry needed</span>
  }
}

/** Away now, or the next leave, in one line */
export function LeaveCell({ e, wrap }: { e: Pick<DirectoryEmployee, "awayNow" | "nextLeave">; wrap?: boolean }) {
  if (e.awayNow) {
    return (
      <span className="block">
        <span className="block text-sm font-semibold text-primary">
          Away until {formatDisplayDate(e.awayNow.endDate)}
        </span>
        <span className="block text-xs text-muted-foreground">{e.awayNow.type}</span>
      </span>
    )
  }
  if (e.nextLeave) {
    return (
      <span className="block">
        <span className={cn("block text-sm tabular", !wrap && "whitespace-nowrap")}>
          {formatDisplayRange(e.nextLeave.startDate, e.nextLeave.endDate)}
        </span>
        <span className="block text-xs text-muted-foreground">{e.nextLeave.type}</span>
      </span>
    )
  }
  return <span className="text-xs text-muted-foreground">None booked</span>
}

export function LeaveLeft({ days, large }: { days: number; large?: boolean }) {
  return (
    <span
      className={cn(
        "font-display font-semibold tabular",
        large ? "text-[30px] leading-none tracking-[-0.03em]" : "text-[15px]",
        days < 0 ? "text-destructive" : days <= 5 ? "text-warning" : "text-foreground",
      )}
    >
      {days}
      <span className={cn("ml-1 font-medium tracking-normal text-muted-foreground", large ? "text-sm" : "text-xs")}>
        {Math.abs(days) === 1 ? "day" : "days"}
      </span>
    </span>
  )
}

export function EmployeeDirectory() {
  const { toast } = useToast()
  const queryClient = useQueryClient()
  const { user } = useApp()
  const isAdmin = user?.role === "admin"
  const { data: allBranches = [] } = useBranches()
  const branches = allBranches.filter((b) => isAdmin || user?.branches?.includes(b.name))

  // The view lives in the address, so a reload, a bookmark and Back all keep it
  const router = useRouter()
  const params = useSearchParams()
  const q = params.get("q") ?? ""
  const branch = params.get("branch") || "all"
  const status = toPeopleStatus(params.get("status"))
  const show = toPeopleShow(params.get("show"))
  const sort = toPeopleSort(params.get("sort"))
  const setParam = (updates: Record<string, string | null>) => {
    const next = new URLSearchParams(params.toString())
    for (const [key, value] of Object.entries(updates)) {
      const isDefault =
        value === null ||
        value === "" ||
        (key === "branch" && value === "all") ||
        (key === "status" && value === "current") ||
        (key === "show" && value === "all") ||
        (key === "sort" && value === "name")
      if (isDefault) next.delete(key)
      else next.set(key, value)
    }
    const qs = next.toString()
    router.replace(qs ? `?${qs}` : "?", { scroll: false })
  }

  // The open profile panel lives in the address too (?person=<id>); old
  // ?employee=<id> links open it
  const person = params.get("person")
  useEffect(() => {
    const id = params.get("employee")
    if (id) setParam({ employee: null, person: id })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [params])
  const personHref = (id: string) => {
    const next = new URLSearchParams(params.toString())
    next.set("person", id)
    return `?${next.toString()}`
  }

  const [search, setSearch] = useState(q)
  useEffect(() => {
    const id = setTimeout(() => {
      if (search.trim() !== q) setParam({ q: search.trim() || null })
    }, 300)
    return () => clearTimeout(id)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search])
  useEffect(() => setSearch(q), [q])

  const { data, isLoading, isError, error, refetch } = useQuery<{ rows: DirectoryEmployee[] }>({
    queryKey: ["employees", "directory"],
    queryFn: () => fetchWithAuth("/api/employees/directory"),
    retry: 1,
  })
  const everyone = data?.rows ?? NO_ROWS
  const inBranch = useMemo(
    () => (branch === "all" ? everyone : everyone.filter((e) => e.branch === branch)),
    [everyone, branch],
  )
  const summary = useMemo(() => peopleSummary(inBranch), [inBranch])
  const visible = useMemo(() => {
    const list = inBranch.filter(
      (e) =>
        (status === "everyone" || (status === "leavers") === isLeaver(e)) &&
        matchesShow(e, show) &&
        matchesPeopleSearch(e, q),
    )
    return sortPeople(list, sort)
  }, [inBranch, status, show, q, sort])

  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState<PageSize>(50)
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const filterKey = [q, branch, status, show, sort].join("|")
  useEffect(() => {
    setPage(1)
    setSelected(new Set())
  }, [filterKey])
  const paged = paginate(visible, page, pageSize)

  // Dialogs
  const [addOpen, setAddOpen] = useState(false)
  const [importOpen, setImportOpen] = useState(false)
  const [editId, setEditId] = useState<string | null>(null)
  const [deleteTargets, setDeleteTargets] = useState<DirectoryEmployee[]>([])
  const [moveOpen, setMoveOpen] = useState(false)
  const [moveTo, setMoveTo] = useState("")
  const [busy, setBusy] = useState(false)

  const refresh = () => {
    for (const key of ["employees", "employee", "dashboard", "documents-tracker", "leaveRequests", "balance-check"]) {
      queryClient.invalidateQueries({ queryKey: [key] })
    }
  }

  const bulk = async (ids: string[], action: "leaver" | "current" | "branch", toBranch?: string) => {
    setBusy(true)
    try {
      const res = await fetchWithAuth("/api/employees/bulk", {
        method: "POST",
        body: JSON.stringify({ ids, action, branch: toBranch }),
      })
      toast({
        title:
          action === "branch"
            ? `${plural(res.updated, "person", "people")} moved to ${toBranch}`
            : action === "leaver"
              ? `${plural(res.updated, "person", "people")} marked as left`
              : `${plural(res.updated, "person", "people")} back to current staff`,
        description: action === "leaver" ? "They're kept, with their history, under Leavers." : undefined,
      })
      setSelected(new Set())
      setMoveOpen(false)
      refresh()
    } catch (err) {
      console.error("Bulk update failed:", err)
      toast({ title: "Couldn't update those people", description: handleApiError(err), variant: "destructive" })
    } finally {
      setBusy(false)
    }
  }

  const confirmDelete = async () => {
    const targets = deleteTargets
    setDeleteTargets([])
    try {
      if (targets.length === 1) await fetchWithAuth(`/api/employees/${targets[0].id}`, { method: "DELETE" })
      else
        await fetchWithAuth("/api/employees/batch-delete", {
          method: "POST",
          body: JSON.stringify({ ids: targets.map((t) => t.id) }),
        })
      toast({ title: targets.length === 1 ? "Employee deleted" : `${targets.length} employees deleted` })
      setSelected(new Set())
      refresh()
    } catch (err) {
      console.error("Delete failed:", err)
      toast({ title: "Couldn't delete", description: handleApiError(err), variant: "destructive" })
    }
  }

  // ------------------------------------------------------------ selection
  const allOnPage = paged.items.length > 0 && paged.items.every((e) => selected.has(e.id))
  const allMatching = visible.length > 0 && visible.every((e) => selected.has(e.id))
  const togglePage = () =>
    setSelected((prev) => {
      const next = new Set(prev)
      for (const e of paged.items) {
        if (allOnPage) next.delete(e.id)
        else next.add(e.id)
      }
      return next
    })
  const toggleOne = (id: string) =>
    setSelected((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  const selectedRows = everyone.filter((e) => selected.has(e.id))

  const applyTile = (next: PeopleShow) => setParam({ show: show === next ? null : next, status: null })

  const chips: { key: string; label: string; clear: () => void }[] = [
    show !== "all" && {
      key: "show",
      label: PEOPLE_SHOW.find((s) => s.id === show)!.label,
      clear: () => setParam({ show: null }),
    },
    status !== "current" && {
      key: "status",
      label: status === "leavers" ? "Leavers" : "Current and leavers",
      clear: () => setParam({ status: null }),
    },
    branch !== "all" && { key: "branch", label: branch, clear: () => setParam({ branch: null }) },
    q !== "" && {
      key: "q",
      label: `“${q}”`,
      clear: () => {
        setSearch("")
        setParam({ q: null })
      },
    },
  ].filter(Boolean) as { key: string; label: string; clear: () => void }[]
  const clearAll = () => {
    setSearch("")
    router.replace("?", { scroll: false })
  }

  const rowActions = (e: DirectoryEmployee) => (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" className="h-8 w-8">
          <span className="sr-only">Actions for {e.name}</span>
          <MoreHorizontal />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuItem asChild>
          <Link href={personHref(e.id)} scroll={false}>
            <UserRound />
            Open profile
          </Link>
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => setEditId(e.id)}>
          <Pencil />
          Edit details
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        {isLeaver(e) ? (
          <DropdownMenuItem onClick={() => bulk([e.id], "current")}>
            <RotateCcw />
            Back to current staff
          </DropdownMenuItem>
        ) : (
          <DropdownMenuItem onClick={() => bulk([e.id], "leaver")}>
            <UserMinus />
            Mark as left
          </DropdownMenuItem>
        )}
        <DropdownMenuItem
          className="text-destructive focus:text-destructive [&_svg]:!text-destructive"
          onClick={() => setDeleteTargets([e])}
        >
          <Trash2 />
          Delete
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )

  const nameCell = (e: DirectoryEmployee) => (
    <div className="flex min-w-0 items-center gap-3">
      <Avatar name={e.name} />
      <div className="min-w-0">
        <p className="flex flex-wrap items-center gap-1.5">
          <Link
            href={personHref(e.id)}
            scroll={false}
            className="truncate font-semibold text-foreground hover:underline focus-visible:underline focus-visible:outline-none"
          >
            {e.name}
          </Link>
          {isLeaver(e) && (
            <Badge variant="secondary" className="px-2 text-[11px] leading-[18px]">
              Left
            </Badge>
          )}
        </p>
        <p className="truncate text-xs text-muted-foreground">
          {[shownJobTitle(e.jobTitle), e.employeeCode].filter(Boolean).join(" · ")}
          {e.missing.length > 0 && (
            <span className="ml-1.5 text-warning" title={`Missing: ${e.missing.join(", ")}`}>
              · Missing {e.missing.join(", ").toLowerCase()}
            </span>
          )}
        </p>
      </div>
    </div>
  )

  const emptyCopy =
    everyone.length === 0
      ? {
          title: "No employees yet",
          description: "Add your first employee, or import a spreadsheet.",
          action: (
            <Button onClick={() => setAddOpen(true)}>
              <Plus />
              Add employee
            </Button>
          ),
        }
      : {
          title: status === "leavers" && show === "all" && !q ? "No leavers" : "Nobody matches these filters",
          description:
            status === "leavers" && show === "all" && !q
              ? "People you mark as left appear here, with their history."
              : "Clear the filters or try another search.",
          action: (
            <Button variant="outline" onClick={clearAll}>
              <X />
              Clear filters
            </Button>
          ),
        }

  return (
    <div className={cn("space-y-6 sm:space-y-8", selected.size > 0 && "pb-20")}>
      <PageHeader
        title="Employees"
        description={
          isLoading
            ? "Loading…"
            : `${plural(summary.current, "current employee")}${summary.leavers ? ` · ${plural(summary.leavers, "leaver")}` : ""}${branch !== "all" ? ` in ${branch}` : ""}.`
        }
        actions={
          <>
            <Button variant="outline" onClick={() => setImportOpen(true)}>
              <Upload />
              Import
            </Button>
            <ExportButton
              endpoint="employees"
              filters={{ branch, search: q, exportAll: "true" }}
              sortColumn="name"
              sortOrder="asc"
              size="default"
            />
            <Button onClick={() => setAddOpen(true)}>
              <Plus />
              <span className="sm:hidden">Add</span>
              <span className="hidden sm:inline">Add employee</span>
            </Button>
          </>
        }
      />

      {isError && (
        <ErrorState title="Couldn't load employees" message={handleApiError(error)} onRetry={() => refetch()} />
      )}

      {/* Tiles: each filters the list to the people behind its number */}
      <section aria-label="Employees at a glance" className="tile-tray grid-cols-2 lg:grid-cols-4">
        <StatCard
          label="Away today"
          icon={CalendarClock}
          value={summary.away}
          detail="On approved leave"
          loading={isLoading}
          onClick={() => applyTile("away")}
          active={show === "away"}
          actionLabel="Show who is away today"
        />
        <StatCard
          label="Right to work"
          icon={ShieldAlert}
          value={summary.rtw}
          detail="Expired, due or no date"
          tone={summary.rtw > 0 ? "warning" : "default"}
          loading={isLoading}
          onClick={() => applyTile("rtw")}
          active={show === "rtw"}
          actionLabel="Show whose right to work needs action"
        />
        <StatCard
          label="Missing details"
          icon={FileWarning}
          value={summary.missing}
          detail="No email, hours, job or documents"
          tone={summary.missing > 0 ? "warning" : "default"}
          loading={isLoading}
          onClick={() => applyTile("missing")}
          active={show === "missing"}
          actionLabel="Show people with missing details"
        />
        <StatCard
          label="Below zero"
          icon={Users}
          value={summary.negative}
          detail="Used more leave than they have"
          tone={summary.negative > 0 ? "danger" : "default"}
          loading={isLoading}
          onClick={() => applyTile("negative")}
          active={show === "negative"}
          actionLabel="Show people below zero"
        />
      </section>

      <div className="surface overflow-hidden">
        {/* Search, filters and page actions */}
        <div className="grid grid-cols-2 gap-2 p-3 sm:p-4 lg:flex lg:flex-wrap lg:items-center">
          <div className="relative col-span-2 lg:w-64">
            <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Search name, code or job"
              aria-label="Search employees"
              className="pl-10 pr-9"
              value={search}
              onChange={(ev) => setSearch(ev.target.value)}
            />
            {search && (
              <button
                onClick={() => setSearch("")}
                aria-label="Clear search"
                className="absolute right-1.5 top-1/2 flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-full text-muted-foreground hover:bg-secondary hover:text-foreground"
              >
                <X className="h-4 w-4" />
              </button>
            )}
          </div>
          <Select value={branch} onValueChange={(v) => setParam({ branch: v })}>
            <SelectTrigger className="lg:w-auto lg:min-w-[140px]" aria-label="Branch">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All branches</SelectItem>
              {branches.map((b) => (
                <SelectItem key={b.id} value={b.name}>
                  {b.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={status} onValueChange={(v) => setParam({ status: v })}>
            <SelectTrigger className="lg:w-auto lg:min-w-[140px]" aria-label="Current or leavers">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="current">Current staff</SelectItem>
              <SelectItem value="leavers">Leavers</SelectItem>
              <SelectItem value="everyone">Current and leavers</SelectItem>
            </SelectContent>
          </Select>
          <Select value={show} onValueChange={(v) => setParam({ show: v })}>
            <SelectTrigger className="lg:w-auto lg:min-w-[140px]" aria-label="Show">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {PEOPLE_SHOW.map((s) => (
                <SelectItem key={s.id} value={s.id}>
                  {s.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={sort} onValueChange={(v) => setParam({ sort: v })}>
            <SelectTrigger className="lg:w-auto lg:min-w-[140px]" aria-label="Sort">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {PEOPLE_SORTS.map((s) => (
                <SelectItem key={s.id} value={s.id}>
                  {s.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* What's showing */}
        <div
          className="flex min-h-12 flex-wrap items-center gap-2 px-4 py-2.5 text-sm sm:px-5"
          aria-live="polite"
        >
          <span className="mr-1 text-muted-foreground">
            {isLoading ? (
              "Loading…"
            ) : (
              <>
                Showing <span className="font-semibold text-foreground tabular">{visible.length}</span> of{" "}
                {plural(inBranch.length, "person", "people")}
              </>
            )}
          </span>
          {chips.map((c) => (
            <span
              key={c.key}
              className="inline-flex h-7 items-center gap-1 rounded-full bg-card pl-3 pr-1 text-xs font-semibold shadow-card"
            >
              {c.label}
              <button
                onClick={c.clear}
                aria-label={`Remove filter: ${c.label}`}
                className="flex h-5 w-5 items-center justify-center rounded-full text-muted-foreground hover:bg-secondary hover:text-foreground"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </span>
          ))}
          {chips.length > 0 && (
            <button onClick={clearAll} className="ml-1 text-xs font-semibold text-primary hover:underline">
              Clear all
            </button>
          )}
        </div>

        {allOnPage && visible.length > paged.items.length && (
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1 bg-primary-soft px-4 py-2.5 text-sm font-medium text-primary sm:px-5">
            {allMatching ? (
              <>
                <span>All {visible.length} matching people are selected.</span>
                <button onClick={() => setSelected(new Set())} className="font-semibold underline">
                  Clear selection
                </button>
              </>
            ) : (
              <>
                <span>All {paged.items.length} people on this page are selected.</span>
                <button
                  onClick={() => setSelected(new Set(visible.map((e) => e.id)))}
                  className="font-semibold underline"
                >
                  Select all {visible.length} matching
                </button>
              </>
            )}
          </div>
        )}

        {/* Large screens: table */}
        <div className="hidden lg:block">
          <Table>
            <TableHeader>
              <TableRow className="hover:bg-transparent">
                <TableHead className="w-12 pl-5">
                  <Checkbox
                    checked={allOnPage}
                    onCheckedChange={togglePage}
                    aria-label="Select everyone on this page"
                    disabled={paged.items.length === 0}
                  />
                </TableHead>
                <TableHead>Employee</TableHead>
                <TableHead>Branch</TableHead>
                <TableHead>Leave left</TableHead>
                <TableHead>Away / next leave</TableHead>
                <TableHead>Right to work</TableHead>
                <TableHead className="w-12">
                  <span className="sr-only">Actions</span>
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow className="hover:bg-transparent">
                  <TableCell colSpan={7} className="p-0">
                    <ListSkeleton rows={6} />
                  </TableCell>
                </TableRow>
              ) : paged.items.length ? (
                paged.items.map((e) => (
                  <TableRow key={e.id} data-state={selected.has(e.id) ? "selected" : undefined}>
                    <TableCell className="pl-5">
                      <Checkbox
                        checked={selected.has(e.id)}
                        onCheckedChange={() => toggleOne(e.id)}
                        aria-label={`Select ${e.name}`}
                      />
                    </TableCell>
                    <TableCell className="min-w-[240px]">{nameCell(e)}</TableCell>
                    <TableCell>{e.branch || "—"}</TableCell>
                    <TableCell>
                      <LeaveLeft days={e.daysRemaining} />
                    </TableCell>
                    <TableCell>
                      <LeaveCell e={e} />
                    </TableCell>
                    <TableCell>
                      <RtwChip rtw={e.rtw} />
                    </TableCell>
                    <TableCell className="text-right">{rowActions(e)}</TableCell>
                  </TableRow>
                ))
              ) : (
                <TableRow className="hover:bg-transparent">
                  <TableCell colSpan={7}>
                    <EmptyState
                      icon={Users}
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

        {/* Phones and tablets: cards */}
        <div className="lg:hidden">
          {isLoading ? (
            <ListSkeleton rows={5} />
          ) : paged.items.length ? (
            <ul className="flex flex-col gap-1.5 p-2 sm:p-3 [&>li]:rounded-2xl [&>li]:bg-background [&>li>*]:rounded-2xl">
              {paged.items.map((e) => (
                <li
                  key={e.id}
                  className={cn("space-y-3 px-4 py-4 sm:px-5", selected.has(e.id) && "bg-primary-soft/50")}
                >
                  <div className="flex items-start gap-3">
                    <Checkbox
                      checked={selected.has(e.id)}
                      onCheckedChange={() => toggleOne(e.id)}
                      aria-label={`Select ${e.name}`}
                      className="mt-2.5"
                    />
                    <div className="min-w-0 flex-1">{nameCell(e)}</div>
                    {rowActions(e)}
                  </div>
                  <dl className="grid grid-cols-2 gap-2 pl-8 text-sm">
                    <div>
                      <dt className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                        Leave left
                      </dt>
                      <dd>
                        <LeaveLeft days={e.daysRemaining} />
                      </dd>
                    </div>
                    <div>
                      <dt className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                        Branch
                      </dt>
                      <dd>{e.branch}</dd>
                    </div>
                    <div>
                      <dt className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                        Away / next
                      </dt>
                      <dd>
                        <LeaveCell e={e} />
                      </dd>
                    </div>
                    <div>
                      <dt className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                        Right to work
                      </dt>
                      <dd>
                        <RtwChip rtw={e.rtw} />
                      </dd>
                    </div>
                  </dl>
                </li>
              ))}
            </ul>
          ) : (
            <EmptyState
              icon={Users}
              title={emptyCopy.title}
              description={emptyCopy.description}
              action={emptyCopy.action}
            />
          )}
        </div>

        {!isLoading && visible.length > 0 && (
          <TablePagination
            page={paged.page}
            pages={paged.pages}
            from={paged.from}
            to={paged.to}
            total={visible.length}
            pageSize={pageSize}
            label={visible.length === 1 ? "person" : "people"}
            onPageChange={setPage}
            onPageSizeChange={(s) => {
              setPageSize(s)
              setPage(1)
            }}
          />
        )}
      </div>

      {/* Actions for the ticked people (rendered into <body>, so it stays on screen) */}
      {selected.size > 0 &&
        createPortal(
          <div className="fixed inset-x-0 bottom-[calc(5rem+env(safe-area-inset-bottom))] z-40 flex justify-center px-4 md:bottom-6">
            <div
              role="toolbar"
              aria-label="Selected employees"
              className="flex max-w-full flex-wrap items-center justify-center gap-2 rounded-full bg-card px-3 py-2 shadow-dialog"
            >
              <span className="px-1 text-sm font-semibold" aria-live="polite">
                {selected.size} selected
              </span>
              {selectedRows.some((e) => !isLeaver(e)) ? (
                <Button
                  size="sm"
                  variant="outline"
                  disabled={busy}
                  onClick={() =>
                    bulk(
                      selectedRows.filter((e) => !isLeaver(e)).map((e) => e.id),
                      "leaver",
                    )
                  }
                >
                  <UserMinus />
                  Mark as left
                </Button>
              ) : (
                <Button size="sm" variant="outline" disabled={busy} onClick={() => bulk([...selected], "current")}>
                  <RotateCcw />
                  Back to current
                </Button>
              )}
              <Button
                size="sm"
                variant="outline"
                disabled={busy}
                onClick={() => {
                  setMoveTo("")
                  setMoveOpen(true)
                }}
              >
                <ArrowRightLeft />
                Move branch
              </Button>
              <Button
                size="sm"
                variant="outline"
                className="text-destructive hover:text-destructive"
                disabled={busy}
                onClick={() => setDeleteTargets(selectedRows)}
              >
                <Trash2 />
                Delete
              </Button>
              <Button
                size="icon"
                variant="ghost"
                className="h-8 w-8"
                onClick={() => setSelected(new Set())}
                aria-label="Clear selection"
              >
                <X />
              </Button>
            </div>
          </div>,
          document.body,
        )}

      <Dialog open={moveOpen} onOpenChange={(o) => !busy && setMoveOpen(o)}>
        <DialogContent className="sm:max-w-[420px]">
          <DialogHeader>
            <DialogTitle>Move {plural(selected.size, "person", "people")} to another branch</DialogTitle>
            <DialogDescription>Their documents move with them. Leave already booked stays as it is.</DialogDescription>
          </DialogHeader>
          <div className="space-y-1.5">
            <Label htmlFor="move-branch">New branch</Label>
            <Select value={moveTo} onValueChange={setMoveTo}>
              <SelectTrigger id="move-branch">
                <SelectValue placeholder="Choose a branch" />
              </SelectTrigger>
              <SelectContent>
                {branches.map((b) => (
                  <SelectItem key={b.id} value={b.name}>
                    {b.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setMoveOpen(false)} disabled={busy}>
              Cancel
            </Button>
            <Button onClick={() => bulk([...selected], "branch", moveTo)} disabled={busy || !moveTo}>
              {busy && <Loader2 className="animate-spin" />}
              Move
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <DeleteConfirmationDialog
        isOpen={deleteTargets.length > 0}
        onClose={() => setDeleteTargets([])}
        onConfirm={confirmDelete}
        title={deleteTargets.length > 1 ? `Delete ${deleteTargets.length} employees` : "Delete employee"}
        description={
          deleteTargets.length > 1
            ? `Delete ${deleteTargets.length} employees? This can't be undone. For people who have left, "Mark as left" keeps their history instead.`
            : `Delete ${deleteTargets[0]?.name}? This can't be undone. If they've left, "Mark as left" keeps their history instead.`
        }
        confirmLabel="Delete"
        cancelLabel="Cancel"
      />
      <AddEmployeeModal open={addOpen} onOpenChange={setAddOpen} />
      <ImportEmployeesModal open={importOpen} onOpenChange={setImportOpen} />
      {editId && <EditEmployeeModal employeeId={editId} isOpen onClose={() => setEditId(null)} />}
      <EmployeePanel id={person} onClose={() => setParam({ person: null })} />
    </div>
  )
}
