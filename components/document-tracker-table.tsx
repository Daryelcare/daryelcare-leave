"use client"

// The Documents page, modelled on CarerHR's client admin Document Tracker:
// every current employee (leavers out, people with nothing on file shown as
// missing), summary tiles that filter the list, status / expiry / type filters
// kept in the address, removable filter chips, pages, a quick date editor on
// each document, and a bar for acting on several people at once.

import { useEffect, useMemo, useState } from "react"
import { createPortal } from "react-dom"
import Link from "next/link"
import { useRouter, useSearchParams } from "next/navigation"
import { useQuery } from "@tanstack/react-query"
import {
  AlertTriangle,
  ArrowDown,
  ArrowUp,
  ArrowUpDown,
  CalendarClock,
  CalendarCheck,
  ChevronRight,
  Download,
  FileQuestion,
  FileSpreadsheet,
  FileText,
  Loader2,
  MoreHorizontal,
  Pencil,
  Plus,
  Search,
  ShieldAlert,
  ShieldCheck,
  Trash2,
  Upload,
  UserRound,
  X,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Skeleton } from "@/components/ui/skeleton"
import { Badge } from "@/components/ui/badge"
import { Checkbox } from "@/components/ui/checkbox"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { useToast } from "@/components/ui/use-toast"
import { authHeaders, fetchWithAuth, handleApiError } from "@/lib/api-utils"
import { useBranches } from "@/hooks/use-branches"
import { formatDisplayDate } from "@/lib/dates"
import type { TrackerDocument } from "@/lib/types"
import { cn } from "@/lib/utils"
import {
  DOC_KINDS,
  EXPIRY_FILTERS,
  type DocKind,
  type ExpiryFilter,
  type Urgency,
  dateChip,
  daysLabel,
  documentsCsv,
  entriesFor,
  entryMatches,
  nextExpiry,
  recordMatches,
  recordUrgency,
  urgencyOf,
} from "@/lib/document-view"
import {
  EXPIRING_DAYS,
  STATUS_FILTERS,
  type StatusFilter,
  matchesSearch,
  matchesStatus,
  sortByIssues,
  toStatusFilter,
  trackerSummary,
} from "@/lib/document-tracker"
import { paginate, type PageSize } from "@/lib/pagination"
import { AddDocumentModal } from "./add-document-modal"
import { EditDocumentModal } from "./edit-document-modal"
import { DeleteConfirmationDialog } from "./delete-confirmation-dialog"
import { ImportDocumentsModal } from "./import-documents-modal"
import { DocumentDateDialog, RenewDocumentsDialog, useRefreshDocuments } from "./document-tracker-dialogs"
import { EmployeePanel } from "./employee-profile"
import { TablePagination } from "./table-pagination"
import { useApp } from "./app-provider"
import { Avatar, EmptyState, ErrorState, ListSkeleton, PageHeader, StatCard, plural } from "./page-kit"

type Group = "all" | "regular" | "sponsored"
type Sort = "urgent" | "issues" | "name-asc" | "name-desc"

const SORTS: { id: Sort; label: string }[] = [
  { id: "urgent", label: "Soonest expiry first" },
  { id: "issues", label: "Most issues first" },
  { id: "name-asc", label: "Name A–Z" },
  { id: "name-desc", label: "Name Z–A" },
]

// One colour per urgency, used by badges, the stripe on each row and the list
const TONE: Record<Urgency, { bar: string; text: string; soft: string; stripe: string }> = {
  expired: {
    bar: "bg-destructive",
    text: "text-destructive",
    soft: "bg-destructive-soft",
    stripe: "before:bg-destructive",
  },
  d7: {
    bar: "bg-destructive/60",
    text: "text-destructive",
    soft: "bg-destructive-soft",
    stripe: "before:bg-destructive/60",
  },
  d30: { bar: "bg-warning", text: "text-warning", soft: "bg-warning-soft", stripe: "before:bg-warning" },
  d90: { bar: "bg-primary", text: "text-primary-text", soft: "bg-primary-soft", stripe: "before:bg-primary" },
  valid: { bar: "bg-success", text: "text-success", soft: "bg-success-soft", stripe: "before:bg-transparent" },
  none: { bar: "bg-border", text: "text-muted-foreground", soft: "bg-muted", stripe: "before:bg-transparent" },
}
// Table rows can't carry a pseudo-element (it becomes an extra cell), so the
// stripe is an inset shadow on the first cell
const CELL_STRIPE: Record<Urgency, string> = {
  expired: "shadow-[inset_3px_0_0_hsl(var(--destructive))]",
  d7: "shadow-[inset_3px_0_0_hsl(var(--destructive)/0.6)]",
  d30: "shadow-[inset_3px_0_0_hsl(var(--warning))]",
  d90: "shadow-[inset_3px_0_0_hsl(var(--primary))]",
  valid: "",
  none: "",
}
const FILTER_TONE: Record<ExpiryFilter, Urgency | null> = {
  all: null,
  expired: "expired",
  within7: "d7",
  within30: "d30",
  within90: "d90",
  valid: "valid",
  none: "none",
}
const badgeVariant = (u: Urgency) =>
  u === "expired" || u === "d7" ? "destructive" : u === "d30" ? "warning" : u === "d90" ? "default" : "success"

const NO_ROWS: TrackerDocument[] = []

const isFilter = (v: string | null): v is ExpiryFilter => EXPIRY_FILTERS.some((f) => f.id === v)
const isKind = (v: string | null): v is DocKind => DOC_KINDS.some((k) => k.id === v)
const isSort = (v: string | null): v is Sort => SORTS.some((s) => s.id === v)

export function DocumentTrackerTable() {
  const { toast } = useToast()
  const refresh = useRefreshDocuments()
  const { user } = useApp()
  const isAdmin = user?.role === "admin"
  const { data: allBranches = [], isLoading: isLoadingBranches } = useBranches()
  const branches = allBranches.filter((b) => isAdmin || user?.branches?.includes(b.name))

  // Everything that defines the view lives in the address, so a reload, a
  // bookmark and Back all keep it
  const router = useRouter()
  const params = useSearchParams()
  const expiry: ExpiryFilter = isFilter(params.get("expiry")) ? (params.get("expiry") as ExpiryFilter) : "all"
  // Right to work is the default document in focus; "all" shows every type equally
  const kind: DocKind | "all" =
    params.get("type") === "all" ? "all" : isKind(params.get("type")) ? (params.get("type") as DocKind) : "rightToWork"
  const focusKind: DocKind = kind === "all" ? "rightToWork" : kind
  const focusLabel = DOC_KINDS.find((k) => k.id === focusKind)!.label
  const group: Group =
    params.get("group") === "sponsored" || params.get("group") === "regular" ? (params.get("group") as Group) : "all"
  const sort: Sort = isSort(params.get("sort")) ? (params.get("sort") as Sort) : "urgent"
  const status: StatusFilter = toStatusFilter(params.get("status"))
  const q = params.get("q") ?? ""
  // An employee's profile opens in a panel on this page (?person=<id>)
  const person = params.get("person")
  const personHref = (id: string) => {
    const next = new URLSearchParams(params.toString())
    next.set("person", id)
    return `?${next.toString()}`
  }
  const branch = params.get("branch") || "all"

  const setParam = (updates: Record<string, string | null>) => {
    const next = new URLSearchParams(params.toString())
    for (const [key, value] of Object.entries(updates)) {
      if (key === "type") {
        if (value === "rightToWork" || value === null) next.delete(key)
        else next.set(key, value)
      } else if (value === null || value === "" || value === "all" || (key === "sort" && value === "urgent")) {
        next.delete(key)
      } else next.set(key, value)
    }
    const qs = next.toString()
    router.replace(qs ? `?${qs}` : "?", { scroll: false })
  }

  // The search box updates the address a moment after typing stops
  const [searchQuery, setSearchQuery] = useState(q)
  useEffect(() => {
    const id = setTimeout(() => {
      if (searchQuery.trim() !== q) setParam({ q: searchQuery.trim() || null })
    }, 300)
    return () => clearTimeout(id)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchQuery])
  useEffect(() => setSearchQuery(q), [q])

  // Dialogs
  const [addFor, setAddFor] = useState<{ employeeId?: string } | null>(null)
  const [editing, setEditing] = useState<{ doc: TrackerDocument; tab: DocKind } | null>(null)
  const [cellTarget, setCellTarget] = useState<{ doc: TrackerDocument; kind: DocKind } | null>(null)
  const [deleteTargets, setDeleteTargets] = useState<TrackerDocument[]>([])
  const [isImportModalOpen, setIsImportModalOpen] = useState(false)
  const [renewOpen, setRenewOpen] = useState(false)
  const [isExporting, setIsExporting] = useState(false)
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState<PageSize>(50)

  // Every current employee in the chosen branch, with their documents record
  const { data, isLoading, isError, error, refetch } = useQuery<{ rows: TrackerDocument[] }>({
    queryKey: ["documents-tracker", branch],
    queryFn: () => fetchWithAuth(`/api/documents/tracker?branch=${encodeURIComponent(branch)}`),
    retry: 1,
  })
  const rows = data?.rows ?? NO_ROWS

  // The tiles cover everyone in the branch; the filters narrow the list
  const summary = useMemo(() => trackerSummary(rows), [rows])
  // Search and sponsorship
  const scoped = useMemo(
    () =>
      rows.filter(
        (d) =>
          matchesSearch(d, q) && (group === "sponsored" ? d.isSponsored : group === "regular" ? !d.isSponsored : true),
      ),
    [rows, q, group],
  )
  // ...then the status filter (tiles)
  const statused = useMemo(() => scoped.filter((d) => matchesStatus(d, status)), [scoped, status])
  const counts = useMemo(() => {
    const out = {} as Record<ExpiryFilter, number>
    for (const f of EXPIRY_FILTERS) out[f.id] = statused.filter((d) => recordMatches(d, f.id, kind)).length
    return out
  }, [statused, kind])
  // ...then the expiry chips, and the sort
  const visible = useMemo(() => {
    const list = statused.filter((d) => recordMatches(d, expiry, kind))
    if (sort === "issues") return sortByIssues(list)
    const key = (d: TrackerDocument) => nextExpiry(d, kind)?.days ?? Number.POSITIVE_INFINITY
    return [...list].sort((a, b) => {
      if (sort === "name-asc") return (a.employeeName || "").localeCompare(b.employeeName || "")
      if (sort === "name-desc") return (b.employeeName || "").localeCompare(a.employeeName || "")
      return key(a) - key(b) || (a.employeeName || "").localeCompare(b.employeeName || "")
    })
  }, [statused, expiry, kind, sort])

  // A new filter starts at page 1 and drops the selection
  const filterKey = [branch, q, group, status, expiry, kind, sort].join("|")
  useEffect(() => {
    setPage(1)
    setSelected(new Set())
  }, [filterKey])
  const paged = paginate(visible, page, pageSize)

  // What's coming up for the document in focus (or every document)
  const [comingUpAll, setComingUpAll] = useState(false)
  const upcoming = useMemo(
    () =>
      scoped
        .flatMap((d) => entriesFor(d, comingUpAll ? "all" : focusKind).map((e) => ({ ...e, record: d })))
        .filter((e) => e.days !== null && e.days <= 90)
        .sort((a, b) => (a.days as number) - (b.days as number)),
    [scoped, focusKind, comingUpAll],
  )

  // Every document type with dates gets a column, right to work first. Types
  // other than the one in focus are shown, but quieter.
  const columns = DOC_KINDS.filter((k) => k.id === focusKind || rows.some((d) => entriesFor(d, k.id).length > 0))
  const isQuiet = (k: DocKind) => kind !== "all" && k !== kind

  const clearFilters = () => {
    setSearchQuery("")
    router.replace("?", { scroll: false })
  }
  // A tile filters the list to the people behind its number; pressing it again clears it
  const applyTile = (next: StatusFilter) => setParam({ status: status === next ? null : next })

  // ------------------------------------------------------------ selection

  const selectedRows = rows.filter((d) => selected.has(d.id))
  const allOnPage = paged.items.length > 0 && paged.items.every((d) => selected.has(d.id))
  const allMatching = visible.length > 0 && visible.every((d) => selected.has(d.id))
  const togglePage = () =>
    setSelected((prev) => {
      const next = new Set(prev)
      for (const d of paged.items) {
        if (allOnPage) next.delete(d.id)
        else next.add(d.id)
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

  // ------------------------------------------------------------ actions

  const confirmDelete = async () => {
    const targets = deleteTargets.filter((d) => d.recordId)
    setDeleteTargets([])
    const results = await Promise.allSettled(
      targets.map((d) => fetchWithAuth(`/api/documents/${d.recordId}`, { method: "DELETE" })),
    )
    refresh()
    setSelected(new Set())
    const failed = results.filter((r) => r.status === "rejected") as PromiseRejectedResult[]
    const ok = results.length - failed.length
    if (ok > 0) {
      toast({
        title: ok === 1 ? "Document record deleted" : `${ok} document records deleted`,
        description: "They now show as having no documents on file.",
      })
    }
    if (failed.length) {
      console.error(
        "Couldn't delete document records:",
        failed.map((f) => f.reason),
      )
      toast({
        title: failed.length === targets.length ? "Couldn't delete" : `${failed.length} couldn't be deleted`,
        description: handleApiError(failed[0].reason),
        variant: "destructive",
      })
    }
  }

  // Save a CSV of exactly what's on screen (or just the ticked rows)
  const downloadCsv = (list: TrackerDocument[], name: string) => {
    const blob = new Blob(["﻿" + documentsCsv(list)], { type: "text/csv;charset=utf-8" })
    const url = URL.createObjectURL(blob)
    const a = Object.assign(document.createElement("a"), { href: url, download: name })
    document.body.appendChild(a)
    a.click()
    a.remove()
    URL.revokeObjectURL(url)
    toast({ title: "Export ready", description: `${plural(list.length, "employee")} saved to ${name}.` })
  }
  const viewName = () => {
    const f = EXPIRY_FILTERS.find((x) => x.id === expiry)
    const parts = [
      "documents",
      status !== "all" ? status.replace(/_/g, "-") : null,
      expiry !== "all" ? f?.label.replace(/\s+/g, "-") : null,
      kind !== "all" ? kind : null,
      branch !== "all" ? branch : null,
    ]
    return `${parts.filter(Boolean).join("-").toLowerCase()}.csv`
  }

  // The full register from the server (CSV or Excel), with branch and search applied
  const exportRegister = async (format: "csv" | "excel") => {
    setIsExporting(true)
    try {
      const formData = new FormData()
      formData.append("format", format)
      formData.append("branch", branch)
      formData.append("status", "all")
      formData.append("search", q)
      formData.append("sortColumn", "employeeName")
      formData.append("sortOrder", "asc")
      const response = await fetch("/api/export/documents", {
        method: "POST",
        headers: await authHeaders(),
        body: formData,
      })
      if (!response.ok) throw new Error(`Export failed with status ${response.status}`)
      let filename = `document-tracker.${format === "csv" ? "csv" : "xlsx"}`
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
        description: `Your ${format === "csv" ? "CSV" : "Excel"} file has been downloaded.`,
      })
    } catch (err) {
      console.error("Export error:", err)
      toast({ title: "Export failed", description: "Please try again in a moment.", variant: "destructive" })
    } finally {
      setIsExporting(false)
    }
  }

  // ------------------------------------------------------------ pieces

  // One document: a button that opens the quick date editor
  const expiryCell = (doc: TrackerDocument, k: DocKind) => {
    const entry = entriesFor(doc, k)[0]
    const quiet = isQuiet(k)
    const name = k === "other" ? doc.otherDocumentType || "Other document" : DOC_KINDS.find((x) => x.id === k)!.label
    const edit = () => setCellTarget({ doc, kind: k })
    if (!entry) {
      return (
        <button
          onClick={edit}
          aria-label={`Add ${name.toLowerCase()} expiry for ${doc.employeeName}`}
          className={cn(
            "rounded-lg px-2 py-1 -mx-2 text-left text-xs transition-colors hover:bg-muted focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-ring/30",
            k === focusKind ? "text-muted-foreground" : "text-muted-foreground/60",
          )}
        >
          {k === focusKind ? "No expiry · Add" : "—"}
        </button>
      )
    }
    const u = urgencyOf(entry.days)
    // Fade documents outside the chosen expiry window, and types not in focus
    const outside = expiry !== "all" && expiry !== "none" && !entryMatches(expiry, entry.days)
    return (
      <button
        onClick={edit}
        aria-label={`${name} for ${doc.employeeName}: ${formatDisplayDate(entry.date)}, ${daysLabel(entry.days)}. Change date`}
        className={cn(
          "-mx-2 flex flex-col items-start gap-1 rounded-lg px-2 py-1 text-left transition-[opacity,background-color] hover:bg-muted focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-ring/30",
          outside ? "opacity-35" : quiet && "opacity-60",
        )}
      >
        {k === "other" && <span className="text-[11px] font-semibold text-muted-foreground">{entry.label}</span>}
        <span
          className={cn(
            "whitespace-nowrap tabular",
            k === focusKind && !quiet ? "text-[15px] font-semibold" : "text-sm font-medium text-foreground/80",
          )}
        >
          {formatDisplayDate(entry.date)}
        </span>
        <Badge variant={badgeVariant(u)} dot={u !== "valid"} className="px-2 text-[11px] leading-[18px] tabular">
          {daysLabel(entry.days)}
        </Badge>
      </button>
    )
  }

  const employeeCell = (doc: TrackerDocument) => (
    <div className="flex min-w-0 items-center gap-3">
      <Avatar name={doc.employeeName} />
      <div className="min-w-0">
        <p className="flex flex-wrap items-center gap-1.5">
          <Link
            href={personHref(doc.employeeId)}
            scroll={false}
            // Taller hit area on phones without changing the row's layout
            className="-my-1.5 truncate py-1.5 text-left font-semibold text-foreground hover:underline focus-visible:underline focus-visible:outline-none max-sm:-my-2 max-sm:py-2"
          >
            {doc.employeeName || "—"}
          </Link>
          {doc.isSponsored && (
            <Badge variant="secondary" className="px-2 text-[11px] leading-[18px]">
              Sponsored
            </Badge>
          )}
          {doc.is20Hours && (
            <Badge variant="secondary" className="px-2 text-[11px] leading-[18px]">
              20 hrs
            </Badge>
          )}
        </p>
        <p className="truncate text-xs text-muted-foreground">
          {[doc.employeeCode, doc.status, doc.country, doc.branch || "Unassigned"].filter(Boolean).join(" · ")}
        </p>
      </div>
    </div>
  )

  const noRecordNote = (doc: TrackerDocument) => (
    <span className="flex flex-wrap items-center gap-2">
      <Badge variant="warning" dot className="px-2 text-[11px] leading-[18px]">
        No documents on file
      </Badge>
      <Button size="sm" variant="outline" className="h-8" onClick={() => setAddFor({ employeeId: doc.employeeId })}>
        <Plus />
        Add documents
      </Button>
    </span>
  )

  const rowActions = (doc: TrackerDocument) => (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" className="h-8 w-8">
          <span className="sr-only">Actions for {doc.employeeName}</span>
          <MoreHorizontal />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuItem asChild>
          <Link href={personHref(doc.employeeId)} scroll={false}>
            <UserRound />
            Open profile
          </Link>
        </DropdownMenuItem>
        {doc.noRecord ? (
          <DropdownMenuItem onClick={() => setAddFor({ employeeId: doc.employeeId })}>
            <Plus />
            Add documents
          </DropdownMenuItem>
        ) : (
          <DropdownMenuItem onClick={() => setEditing({ doc, tab: focusKind })}>
            <Pencil />
            Edit documents
          </DropdownMenuItem>
        )}
        {isAdmin && !doc.noRecord && (
          <>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              className="text-destructive focus:text-destructive [&_svg]:!text-destructive"
              onClick={() => setDeleteTargets([doc])}
            >
              <Trash2 />
              Delete record
            </DropdownMenuItem>
          </>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  )

  const nameSortHeader = () => {
    const active = sort === "name-asc" || sort === "name-desc"
    const next: Sort = sort === "name-asc" ? "name-desc" : "name-asc"
    return (
      <TableHead>
        <button
          onClick={() => setParam({ sort: next })}
          className={cn(
            "inline-flex items-center gap-1 transition-colors hover:text-foreground",
            active && "text-foreground",
          )}
        >
          Employee
          {!active ? (
            <ArrowUpDown className="h-3.5 w-3.5 opacity-40" />
          ) : sort === "name-asc" ? (
            <ArrowUp className="h-3.5 w-3.5" />
          ) : (
            <ArrowDown className="h-3.5 w-3.5" />
          )}
        </button>
      </TableHead>
    )
  }

  const stripe = (doc: TrackerDocument) =>
    cn(
      "relative before:absolute before:inset-y-0 before:left-0 before:w-[3px]",
      TONE[recordUrgency(doc, focusKind)].stripe,
    )

  // Removable chips for every filter in use
  const chips: { key: string; label: string; clear: () => void }[] = [
    status !== "all" && {
      key: "status",
      label: STATUS_FILTERS.find((s) => s.id === status)!.label,
      clear: () => setParam({ status: null }),
    },
    expiry !== "all" && {
      key: "expiry",
      label: EXPIRY_FILTERS.find((f) => f.id === expiry)!.long,
      clear: () => setParam({ expiry: null }),
    },
    kind !== "rightToWork" && {
      key: "type",
      label: kind === "all" ? "All document types" : DOC_KINDS.find((k) => k.id === kind)!.label,
      clear: () => setParam({ type: null }),
    },
    branch !== "all" && { key: "branch", label: branch, clear: () => setParam({ branch: null }) },
    group !== "all" && {
      key: "group",
      label: group === "sponsored" ? "Sponsored only" : "Not sponsored",
      clear: () => setParam({ group: null }),
    },
    q !== "" && {
      key: "q",
      label: `“${q}”`,
      clear: () => {
        setSearchQuery("")
        setParam({ q: null })
      },
    },
  ].filter(Boolean) as { key: string; label: string; clear: () => void }[]

  const clearButton = (
    <Button variant="outline" onClick={clearFilters}>
      <X />
      Clear filters
    </Button>
  )
  const emptyCopy =
    rows.length === 0
      ? {
          title: "No current employees",
          description: "Add employees and their documents will appear here.",
          action: undefined,
        }
      : expiry === "expired" || expiry === "within7" || status === "expired"
        ? {
            title: `Nothing ${expiry === "within7" ? "expiring in the next 7 days" : "expired"}`,
            description: "Good news. Try a wider window or clear the filters.",
            action: clearButton,
          }
        : {
            title: "Nobody matches these filters",
            description: "Clear the filters or try another search.",
            action: clearButton,
          }

  // Page actions sit in the filter row, not the page header
  const pageActions = (
    <>
      <Button variant="outline" onClick={() => setIsImportModalOpen(true)}>
        <Upload />
        Import
      </Button>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="outline" disabled={isLoading || isExporting || rows.length === 0}>
            {isExporting ? <Loader2 className="animate-spin" /> : <Download />}
            {isExporting ? "Exporting…" : "Export"}
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-64">
          <DropdownMenuLabel className="text-xs font-semibold text-muted-foreground">
            This view · {plural(visible.length, "employee")}
          </DropdownMenuLabel>
          <DropdownMenuItem disabled={visible.length === 0} onClick={() => downloadCsv(visible, viewName())}>
            <FileText />
            CSV of this view
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuLabel className="text-xs font-semibold text-muted-foreground">Full register</DropdownMenuLabel>
          <DropdownMenuItem onClick={() => exportRegister("csv")}>
            <FileText />
            CSV file
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => exportRegister("excel")}>
            <FileSpreadsheet />
            Excel workbook
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
      <Button onClick={() => setAddFor({})}>
        <Plus />
        <span className="sm:hidden">Add</span>
        <span className="hidden sm:inline">Add document</span>
      </Button>
    </>
  )

  const docsNote = (n: number) => plural(n, "document")

  return (
    <div className={cn("space-y-6 sm:space-y-8", selected.size > 0 && "pb-20")}>
      <PageHeader
        title="Documents"
        description="Right-to-work, passport and visa expiry for every current employee."
        actions={pageActions}
      />

      {isError && (
        <ErrorState title="Couldn't load documents" message={handleApiError(error)} onRetry={() => refetch()} />
      )}

      {/* Summary tiles: each filters the list to the people behind its number */}
      <section aria-label="Documents at a glance" className="tile-tray grid-cols-2 sm:grid-cols-3 lg:grid-cols-5">
        <StatCard
          className="col-span-2 sm:col-span-1"
          label="In date"
          icon={ShieldCheck}
          value={summary.inDate.percent === null ? "—" : `${summary.inDate.percent}%`}
          detail={
            summary.inDate.total
              ? `${summary.inDate.ok} of ${docsNote(summary.inDate.total)}; nothing on file counts against it`
              : "No expiry dates recorded yet"
          }
          loading={isLoading}
        />
        <StatCard
          label="Expired"
          icon={AlertTriangle}
          value={summary.expired.people}
          detail={`${summary.expired.people === 1 ? "person" : "people"} · ${docsNote(summary.expired.documents)}`}
          tone={summary.expired.people > 0 ? "danger" : "default"}
          loading={isLoading}
          onClick={() => applyTile("expired")}
          active={status === "expired"}
          actionLabel="Show people with expired documents"
        />
        <StatCard
          label="Expiring soon"
          icon={CalendarClock}
          value={summary.expiring.people}
          detail={`Within ${EXPIRING_DAYS} days · ${docsNote(summary.expiring.documents)}`}
          tone={summary.expiring.people > 0 ? "warning" : "default"}
          loading={isLoading}
          onClick={() => applyTile("expiring")}
          active={status === "expiring"}
          actionLabel="Show people with documents expiring soon"
        />
        <StatCard
          label="Nothing on file"
          icon={FileQuestion}
          value={summary.missing}
          detail={summary.missing === 1 ? "Person with no documents record" : "People with no documents record"}
          tone={summary.missing > 0 ? "warning" : "default"}
          loading={isLoading}
          onClick={() => applyTile("missing")}
          active={status === "missing"}
          actionLabel="Show people with no documents on file"
        />
        <StatCard
          label="Right to work"
          icon={ShieldAlert}
          value={summary.rtwAction}
          detail="Expired, due or no date"
          tone={summary.rtwAction > 0 ? "warning" : "default"}
          loading={isLoading}
          onClick={() => applyTile("rtw_action")}
          active={status === "rtw_action"}
          actionLabel="Show people whose right to work needs action"
        />
      </section>

      {/* What's coming up */}
      <section aria-label="Coming up" className="surface overflow-hidden">
        <div className="flex items-center justify-between gap-3 px-5 pb-3 pt-5 sm:px-6">
          <div>
            <p className="eyebrow">Coming up</p>
            <p className="mt-1 text-sm text-muted-foreground">
              {isLoading
                ? " "
                : upcoming.length > 0
                  ? `${plural(upcoming.length, comingUpAll ? "document" : `${focusLabel.toLowerCase()} date`)} expired or due within 90 days`
                  : "Nothing due in the next 90 days"}
            </p>
          </div>
          <div
            className="ml-auto flex shrink-0 rounded-full bg-secondary p-0.5 text-xs font-semibold"
            role="group"
            aria-label="Coming up shows"
          >
            {[
              { all: false, label: focusLabel },
              { all: true, label: "All" },
            ].map((o) => (
              <button
                key={String(o.all)}
                onClick={() => setComingUpAll(o.all)}
                aria-pressed={comingUpAll === o.all}
                className={cn(
                  "h-9 whitespace-nowrap rounded-full px-3 transition-colors sm:h-7 sm:px-2.5",
                  comingUpAll === o.all
                    ? "bg-primary text-primary-foreground"
                    : "text-muted-foreground hover:text-foreground",
                )}
              >
                {o.label}
              </button>
            ))}
          </div>
          {upcoming.length > 0 && (
            <Button
              variant="ghost"
              size="icon"
              aria-label="See all due within 90 days"
              onClick={() => setParam({ expiry: "within90", type: comingUpAll ? "all" : focusKind })}
              className="h-8 w-8 shrink-0"
            >
              <ChevronRight />
            </Button>
          )}
        </div>
        {isLoading ? (
          <ListSkeleton rows={2} />
        ) : upcoming.length === 0 ? (
          <div className="flex items-center gap-3 px-5 pb-5 sm:px-6">
            <span className="flex h-9 w-9 items-center justify-center rounded-full bg-success-soft text-success">
              <CalendarCheck className="h-4 w-4" />
            </span>
            <p className="text-sm text-muted-foreground">
              {comingUpAll ? "All documents are" : `Every ${focusLabel.toLowerCase()} is`} valid for at least 90 days.
            </p>
          </div>
        ) : (
          <ul className="grid lg:grid-cols-2">
            {upcoming.slice(0, 4).map((e, i) => {
              const chip = dateChip(e.date)
              const u = urgencyOf(e.days)
              return (
                <li
                  key={`${e.record.id}-${e.kind}`}
                  className={cn(
                    "border-border/70",
                    i >= 2 && "hidden sm:block",
                    i % 2 === 0 && "lg:border-r",
                    "border-b",
                  )}
                >
                  <button
                    onClick={() => setCellTarget({ doc: e.record, kind: e.kind })}
                    className="flex w-full items-center gap-3.5 px-5 py-3 text-left transition-colors hover:bg-muted/50 focus-visible:bg-muted/50 focus-visible:outline-none sm:px-6"
                  >
                    <span
                      className={cn(
                        "flex h-11 w-11 shrink-0 flex-col items-center justify-center rounded-xl leading-none",
                        TONE[u].soft,
                        TONE[u].text,
                      )}
                    >
                      <span className="font-display text-[13px] font-semibold tabular">{chip?.dayMonth}</span>
                      <span className="text-[10px] font-semibold tabular opacity-80">{chip?.year}</span>
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-semibold">{e.record.employeeName}</span>
                      <span className="block truncate text-xs text-muted-foreground">
                        {e.label} · {e.record.branch || "Unassigned"}
                      </span>
                    </span>
                    <span className={cn("shrink-0 text-right text-xs font-semibold tabular", TONE[u].text)}>
                      {daysLabel(e.days)}
                    </span>
                  </button>
                </li>
              )
            })}
          </ul>
        )}
      </section>

      <div className="surface overflow-hidden">
        {/* Expiry filter */}
        <div className=" px-3 pt-3 sm:px-4 sm:pt-4">
          <div className="-mx-3 overflow-x-auto px-3 pb-3 [scrollbar-width:none] sm:-mx-4 sm:px-4 sm:pb-4 [&::-webkit-scrollbar]:hidden">
            <div role="group" aria-label="Filter by expiry" className="flex w-max gap-1.5 sm:gap-2">
              {EXPIRY_FILTERS.filter((f) => f.id !== "none" || counts.none > 0 || expiry === "none").map((f) => {
                const active = expiry === f.id
                const tone = FILTER_TONE[f.id]
                return (
                  <button
                    key={f.id}
                    onClick={() => setParam({ expiry: f.id })}
                    aria-pressed={active}
                    title={f.long}
                    className={cn(
                      "flex h-9 shrink-0 items-center gap-2 rounded-full px-3.5 text-[13px] font-bold transition-colors duration-150",
                      "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/70",
                      active
                        ? "bg-primary text-primary-foreground"
                        : "bg-background text-secondary-foreground hover:bg-secondary hover:text-foreground",
                    )}
                  >
                    {tone && <span className={cn("h-2 w-2 rounded-full", TONE[tone].bar)} aria-hidden />}
                    {f.id === "within7" || f.id === "within30" || f.id === "within90" ? (
                      <span>
                        <span
                          className={cn("hidden sm:inline", active ? "text-primary-foreground/80" : "text-muted-foreground")}
                        >
                          Within{" "}
                        </span>
                        {f.label}
                      </span>
                    ) : (
                      f.label
                    )}
                    <span
                      className={cn(
                        "min-w-[22px] rounded-full px-1.5 text-center text-xs font-semibold tabular leading-5",
                        active
                          ? "bg-white/20 text-primary-foreground"
                          : tone && counts[f.id] > 0 && f.id !== "valid" && f.id !== "none"
                            ? cn(TONE[tone].soft, TONE[tone].text)
                            : "bg-muted text-muted-foreground",
                      )}
                    >
                      {isLoading ? "–" : counts[f.id]}
                    </span>
                  </button>
                )
              })}
            </div>
          </div>
        </div>

        {/* Search and refine */}
        <div className="grid grid-cols-2 gap-2 p-3 sm:p-4 lg:flex lg:flex-wrap lg:items-center">
          <div className="relative col-span-2 lg:w-64">
            <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Search name or code"
              aria-label="Search employee name, code or country"
              className="pl-10 pr-9"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery("")}
                aria-label="Clear search"
                className="absolute right-1.5 top-1/2 flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-full text-muted-foreground hover:bg-secondary hover:text-foreground"
              >
                <X className="h-4 w-4" />
              </button>
            )}
          </div>
          <Select value={status} onValueChange={(v) => setParam({ status: v })}>
            <SelectTrigger className="col-span-2 sm:col-span-1 lg:w-auto lg:min-w-[140px]" aria-label="Status">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {STATUS_FILTERS.map((s) => (
                <SelectItem key={s.id} value={s.id}>
                  {s.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={kind} onValueChange={(v) => setParam({ type: v })}>
            <SelectTrigger className="lg:w-auto lg:min-w-[140px]" aria-label="Document type">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {DOC_KINDS.map((k) => (
                <SelectItem key={k.id} value={k.id}>
                  {k.label}
                </SelectItem>
              ))}
              <SelectItem value="all">All types</SelectItem>
            </SelectContent>
          </Select>
          <Select value={branch} onValueChange={(v) => setParam({ branch: v })} disabled={isLoadingBranches}>
            <SelectTrigger className="lg:w-auto lg:min-w-[140px]" aria-label="Branch">
              <SelectValue placeholder="All branches" />
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
          <Select value={group} onValueChange={(v) => setParam({ group: v })}>
            <SelectTrigger className="lg:w-auto lg:min-w-[140px]" aria-label="Sponsorship">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Everyone</SelectItem>
              <SelectItem value="regular">Not sponsored</SelectItem>
              <SelectItem value="sponsored">Sponsored only</SelectItem>
            </SelectContent>
          </Select>
          <Select value={sort} onValueChange={(v) => setParam({ sort: v })}>
            <SelectTrigger className="lg:w-auto lg:min-w-[140px]" aria-label="Sort">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {SORTS.map((s) => (
                <SelectItem key={s.id} value={s.id}>
                  {s.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* What's showing, with a chip for each filter */}
        <div
          className="flex min-h-12 flex-wrap items-center gap-x-2 gap-y-2 px-4 py-2.5 text-sm sm:px-5"
          aria-live="polite"
        >
          <span className="mr-1 text-muted-foreground">
            {isLoading ? (
              "Loading…"
            ) : (
              <>
                Showing <span className="font-semibold text-foreground tabular">{visible.length}</span> of{" "}
                {plural(rows.length, "person", "people")}
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
            <button onClick={clearFilters} className="ml-1 text-xs font-semibold text-primary-text hover:underline">
              Clear all
            </button>
          )}
        </div>

        {/* Everyone on the page is ticked: offer everyone matching */}
        {allOnPage && visible.length > paged.items.length && (
          <div
            className="flex flex-wrap items-center gap-x-3 gap-y-1 bg-primary-soft px-4 py-2.5 text-sm font-medium text-primary-text sm:px-5"
            aria-live="polite"
          >
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
                  onClick={() => setSelected(new Set(visible.map((d) => d.id)))}
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
                {nameSortHeader()}
                {columns.map((c) => (
                  <TableHead
                    key={c.id}
                    className={cn(
                      c.id === focusKind ? "min-w-[150px] font-semibold text-foreground" : "",
                      isQuiet(c.id) && "font-normal text-muted-foreground/80",
                    )}
                  >
                    <span className="inline-flex items-center gap-1.5">
                      {c.id === "rightToWork" && c.id === focusKind && (
                        <ShieldCheck className="h-3.5 w-3.5 text-primary-text" />
                      )}
                      {c.label}
                    </span>
                  </TableHead>
                ))}
                <TableHead className="w-12">
                  <span className="sr-only">Actions</span>
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                Array.from({ length: 6 }).map((_, i) => (
                  <TableRow key={i} className="hover:bg-transparent">
                    <TableCell colSpan={columns.length + 3} className="py-3.5">
                      <div className="flex items-center gap-3">
                        <Skeleton className="h-9 w-9 rounded-full" />
                        <Skeleton className="h-4 w-1/5" />
                        <Skeleton className="ml-auto h-4 w-1/2" />
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              ) : paged.items.length > 0 ? (
                paged.items.map((doc) => (
                  <TableRow key={doc.id} data-state={selected.has(doc.id) ? "selected" : undefined}>
                    <TableCell className={cn("pl-5", CELL_STRIPE[recordUrgency(doc, focusKind)])}>
                      <Checkbox
                        checked={selected.has(doc.id)}
                        onCheckedChange={() => toggleOne(doc.id)}
                        aria-label={`Select ${doc.employeeName}`}
                      />
                    </TableCell>
                    <TableCell className="min-w-[240px]">{employeeCell(doc)}</TableCell>
                    {doc.noRecord ? (
                      <TableCell colSpan={columns.length}>{noRecordNote(doc)}</TableCell>
                    ) : (
                      columns.map((c) => <TableCell key={c.id}>{expiryCell(doc, c.id)}</TableCell>)
                    )}
                    <TableCell className="text-right">{rowActions(doc)}</TableCell>
                  </TableRow>
                ))
              ) : (
                <TableRow className="hover:bg-transparent">
                  <TableCell colSpan={columns.length + 3}>
                    <EmptyState
                      icon={FileText}
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
          ) : paged.items.length > 0 ? (
            <ul className="flex flex-col gap-1.5 p-2 sm:p-3 [&>li]:rounded-2xl [&>li]:bg-background [&>li>*]:rounded-2xl">
              {paged.items.map((doc) => {
                // Every document, right to work first; the focused type stands out
                const items = entriesFor(doc)
                const focusMissing = !items.some((i) => i.kind === focusKind)
                return (
                  <li
                    key={doc.id}
                    className={cn(
                      "space-y-3 px-4 py-4 sm:px-5",
                      stripe(doc),
                      selected.has(doc.id) && "bg-primary-soft/50",
                    )}
                  >
                    <div className="flex items-start gap-3">
                      <Checkbox
                        checked={selected.has(doc.id)}
                        onCheckedChange={() => toggleOne(doc.id)}
                        aria-label={`Select ${doc.employeeName}`}
                        className="mt-2.5"
                      />
                      <div className="min-w-0 flex-1">{employeeCell(doc)}</div>
                      {rowActions(doc)}
                    </div>
                    {doc.noRecord ? (
                      noRecordNote(doc)
                    ) : (
                      <>
                        {focusMissing && (
                          <button
                            onClick={() => setCellTarget({ doc, kind: focusKind })}
                            className="-my-2 self-start py-2 text-left text-xs font-medium text-muted-foreground underline-offset-2 hover:underline"
                          >
                            {focusLabel}: no expiry recorded · Add
                          </button>
                        )}
                        {items.length > 0 && (
                          <dl className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                            {items.map((item) => {
                              const u = urgencyOf(item.days)
                              const outside = expiry !== "all" && expiry !== "none" && !entryMatches(expiry, item.days)
                              const focus = item.kind === focusKind && !isQuiet(item.kind)
                              return (
                                <button
                                  key={item.kind}
                                  onClick={() => setCellTarget({ doc, kind: item.kind })}
                                  aria-label={`${item.label} for ${doc.employeeName}: ${formatDisplayDate(item.date)}, ${daysLabel(item.days)}. Change date`}
                                  className={cn(
                                    "space-y-1 rounded-lg px-3 py-2.5 text-left transition-opacity focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-ring/30",
                                    focus
                                      ? "col-span-2 bg-primary-soft/60 ring-1 ring-inset ring-primary/20 sm:col-span-2"
                                      : "bg-muted/50",
                                    outside ? "opacity-40" : isQuiet(item.kind) && "opacity-60",
                                  )}
                                >
                                  <dt
                                    className={cn(
                                      "flex items-center gap-1.5 truncate text-[11px] font-semibold uppercase tracking-wide",
                                      focus ? "text-primary-text" : "text-muted-foreground",
                                    )}
                                  >
                                    {focus && item.kind === "rightToWork" && <ShieldCheck className="h-3.5 w-3.5" />}
                                    {item.label}
                                  </dt>
                                  <dd className="space-y-1">
                                    <span className="block text-sm font-medium tabular">
                                      {formatDisplayDate(item.date)}
                                    </span>
                                    <Badge
                                      variant={badgeVariant(u)}
                                      dot={u !== "valid"}
                                      className="px-2 text-[11px] leading-[18px] tabular"
                                    >
                                      {daysLabel(item.days)}
                                    </Badge>
                                  </dd>
                                </button>
                              )
                            })}
                          </dl>
                        )}
                      </>
                    )}
                  </li>
                )
              })}
            </ul>
          ) : (
            <EmptyState
              icon={FileText}
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
            onPageSizeChange={(size) => {
              setPageSize(size)
              setPage(1)
            }}
          />
        )}
      </div>

      {/* Actions for the ticked people. Rendered into <body>: the page's entry
          animation leaves a transform that would pin a "fixed" bar to the page */}
      {selected.size > 0 &&
        createPortal(
          <div className="fixed inset-x-0 bottom-[calc(5rem+env(safe-area-inset-bottom))] z-40 flex justify-center px-4 md:bottom-6">
            <div
              role="toolbar"
              aria-label="Selected people"
              className="flex max-w-full flex-wrap items-center justify-center gap-2 rounded-full bg-card px-3 py-2 shadow-dialog"
            >
              <span className="px-1 text-sm font-semibold" aria-live="polite">
                {selected.size} selected
              </span>
              <Button size="sm" onClick={() => setRenewOpen(true)}>
                <CalendarCheck />
                Mark renewed
              </Button>
              <Button size="sm" variant="outline" onClick={() => downloadCsv(selectedRows, "documents-selected.csv")}>
                <Download />
                Export
              </Button>
              {isAdmin && (
                <Button
                  size="sm"
                  variant="outline"
                  className="text-destructive hover:text-destructive"
                  disabled={!selectedRows.some((d) => d.recordId)}
                  onClick={() => setDeleteTargets(selectedRows.filter((d) => d.recordId))}
                >
                  <Trash2 />
                  Delete
                </Button>
              )}
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

      <AddDocumentModal
        key={addFor?.employeeId ?? "new"}
        open={!!addFor}
        onOpenChange={(o) => !o && setAddFor(null)}
        initialEmployeeId={addFor?.employeeId}
      />
      {editing && (
        <EditDocumentModal
          key={`${editing.doc.id}-${editing.tab}`}
          document={editing.doc}
          initialTab={editing.tab}
          open
          onOpenChange={(o) => !o && setEditing(null)}
        />
      )}
      <DocumentDateDialog target={cellTarget} onOpenChange={(o) => !o && setCellTarget(null)} />
      <RenewDocumentsDialog
        people={selectedRows}
        open={renewOpen}
        onOpenChange={setRenewOpen}
        onDone={() => setSelected(new Set())}
      />
      <DeleteConfirmationDialog
        isOpen={deleteTargets.length > 0}
        onClose={() => setDeleteTargets([])}
        onConfirm={confirmDelete}
        title={deleteTargets.length > 1 ? `Delete ${deleteTargets.length} document records` : "Delete document record"}
        description={
          deleteTargets.length > 1
            ? `Delete the document records for ${deleteTargets.length} people? Their expiry dates are removed and they'll show as having nothing on file. This can't be undone.`
            : `Delete the document record for ${deleteTargets[0]?.employeeName}? Their expiry dates are removed. This can't be undone.`
        }
        confirmLabel="Delete"
        cancelLabel="Cancel"
      />
      <ImportDocumentsModal open={isImportModalOpen} onOpenChange={setIsImportModalOpen} />
      <EmployeePanel id={person} onClose={() => setParam({ person: null })} />
    </div>
  )
}
