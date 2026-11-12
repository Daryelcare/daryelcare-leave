"use client"

import { useEffect, useMemo, useState } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { useQuery, useQueryClient } from "@tanstack/react-query"
import {
  AlertTriangle,
  ArrowDown,
  ArrowUp,
  ArrowUpDown,
  CalendarClock,
  ChevronRight,
  Download,
  FileSpreadsheet,
  FileText,
  Loader2,
  MoreHorizontal,
  Pencil,
  Plus,
  Search,
  ShieldCheck,
  Trash2,
  Upload,
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
import { fetchWithAuth, handleApiError } from "@/lib/api-utils"
import { useBranches } from "@/hooks/use-branches"
import { formatDisplayDate } from "@/lib/dates"
import type { EmployeeDocument } from "@/lib/types"
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
import { AddDocumentModal } from "./add-document-modal"
import { EditDocumentModal } from "./edit-document-modal"
import { DeleteConfirmationDialog } from "./delete-confirmation-dialog"
import { ImportDocumentsModal } from "./import-documents-modal"
import { Avatar, EmptyState, ErrorState, ListSkeleton, PageHeader, plural } from "./page-kit"

type Group = "all" | "regular" | "sponsored"
type Sort = "urgent" | "name-asc" | "name-desc"

// One colour per urgency, used by badges, the stripe on each row and the overview bar
const TONE: Record<Urgency, { bar: string; text: string; soft: string; stripe: string; label: string }> = {
  expired: {
    bar: "bg-destructive",
    text: "text-destructive",
    soft: "bg-destructive-soft",
    stripe: "before:bg-destructive",
    label: "Expired",
  },
  d7: {
    bar: "bg-destructive/60",
    text: "text-destructive",
    soft: "bg-destructive-soft",
    stripe: "before:bg-destructive/60",
    label: "Within 7 days",
  },
  d30: {
    bar: "bg-warning",
    text: "text-warning",
    soft: "bg-warning-soft",
    stripe: "before:bg-warning",
    label: "8–30 days",
  },
  d90: {
    bar: "bg-primary",
    text: "text-primary",
    soft: "bg-primary-soft",
    stripe: "before:bg-primary",
    label: "31–90 days",
  },
  valid: {
    bar: "bg-success",
    text: "text-success",
    soft: "bg-success-soft",
    stripe: "before:bg-transparent",
    label: "Valid 90+ days",
  },
  none: {
    bar: "bg-border",
    text: "text-muted-foreground",
    soft: "bg-muted",
    stripe: "before:bg-transparent",
    label: "No dates",
  },
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

const NO_DOCUMENTS: EmployeeDocument[] = []

const isFilter = (v: string | null): v is ExpiryFilter => EXPIRY_FILTERS.some((f) => f.id === v)
const isKind = (v: string | null): v is DocKind => DOC_KINDS.some((k) => k.id === v)

export function DocumentTrackerTable() {
  const { toast } = useToast()
  const queryClient = useQueryClient()
  const { data: branches = [], isLoading: isLoadingBranches } = useBranches()

  // Filters live in the address so a view can be bookmarked or shared
  const router = useRouter()
  const params = useSearchParams()
  const expiry: ExpiryFilter = isFilter(params.get("expiry")) ? (params.get("expiry") as ExpiryFilter) : "all"
  // Right to work is the default view; "all" shows every document type
  const kind: DocKind | "all" =
    params.get("type") === "all" ? "all" : isKind(params.get("type")) ? (params.get("type") as DocKind) : "rightToWork"
  const focusKind: DocKind = kind === "all" ? "rightToWork" : kind
  const focusLabel = DOC_KINDS.find((k) => k.id === focusKind)!.label
  const group: Group =
    params.get("group") === "sponsored" || params.get("group") === "regular" ? (params.get("group") as Group) : "all"
  const sort: Sort =
    params.get("sort") === "name-asc" || params.get("sort") === "name-desc" ? (params.get("sort") as Sort) : "urgent"
  const setParam = (updates: Record<string, string | null>) => {
    const next = new URLSearchParams(params.toString())
    for (const [key, value] of Object.entries(updates)) {
      if (key === "type") {
        if (value === "rightToWork" || value === null) next.delete(key)
        else next.set(key, value)
      } else if (value === null || value === "all" || (key === "sort" && value === "urgent")) next.delete(key)
      else next.set(key, value)
    }
    const qs = next.toString()
    router.replace(qs ? `?${qs}` : "?", { scroll: false })
  }

  const [searchQuery, setSearchQuery] = useState("")
  const [debouncedSearch, setDebouncedSearch] = useState("")
  const [branch, setBranch] = useState("all")
  useEffect(() => {
    const id = setTimeout(() => setDebouncedSearch(searchQuery.trim()), 350)
    return () => clearTimeout(id)
  }, [searchQuery])

  const [isAddModalOpen, setIsAddModalOpen] = useState(false)
  const [isEditModalOpen, setIsEditModalOpen] = useState(false)
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false)
  const [isImportModalOpen, setIsImportModalOpen] = useState(false)
  const [selectedDocument, setSelectedDocument] = useState<EmployeeDocument | null>(null)
  const [editTab, setEditTab] = useState<DocKind>("rightToWork")
  const [selected, setSelected] = useState<string[]>([])
  const [isExporting, setIsExporting] = useState(false)

  const {
    data: documents = NO_DOCUMENTS,
    isLoading,
    isError,
    error,
    refetch,
  } = useQuery<EmployeeDocument[]>({
    queryKey: ["documents", branch, debouncedSearch],
    queryFn: async () => {
      const q = new URLSearchParams()
      if (branch !== "all") q.append("branch", branch)
      if (debouncedSearch) q.append("search", debouncedSearch)
      q.append("sortColumn", "employeeName")
      q.append("sortDirection", "asc")
      return fetchWithAuth(`/api/documents?${q.toString()}`)
    },
  })

  // Everything in scope before the expiry filter: branch, search, group
  const scoped = useMemo(
    () =>
      documents.filter((d) => (group === "sponsored" ? d.isSponsored : group === "regular" ? !d.isSponsored : true)),
    [documents, group],
  )
  const counts = useMemo(() => {
    const out = {} as Record<ExpiryFilter, number>
    for (const f of EXPIRY_FILTERS) out[f.id] = scoped.filter((d) => recordMatches(d, f.id, kind)).length
    return out
  }, [scoped, kind])

  const visible = useMemo(() => {
    const list = scoped.filter((d) => recordMatches(d, expiry, kind))
    const key = (d: EmployeeDocument) => nextExpiry(d, kind)?.days ?? Number.POSITIVE_INFINITY
    return [...list].sort((a, b) => {
      if (sort === "name-asc") return (a.employeeName || "").localeCompare(b.employeeName || "")
      if (sort === "name-desc") return (b.employeeName || "").localeCompare(a.employeeName || "")
      return key(a) - key(b) || (a.employeeName || "").localeCompare(b.employeeName || "")
    })
  }, [scoped, expiry, kind, sort])

  // Drop selections that are no longer on screen
  useEffect(() => {
    setSelected((prev) => {
      const kept = prev.filter((id) => visible.some((d) => d.id === id))
      return kept.length === prev.length ? prev : kept
    })
  }, [visible])

  // Overview: compliance for the focused document (right to work unless another
  // type is chosen), and what's coming up
  const [comingUpAll, setComingUpAll] = useState(false)
  const overview = useMemo(() => {
    const bands: Record<Urgency, number> = { expired: 0, d7: 0, d30: 0, d90: 0, valid: 0, none: 0 }
    for (const d of scoped) bands[recordUrgency(d, focusKind)]++
    const dated = scoped.length - bands.none
    const compliant = dated - bands.expired
    const upcoming = scoped
      .flatMap((d) => entriesFor(d, comingUpAll ? "all" : focusKind).map((e) => ({ ...e, record: d })))
      .filter((e) => e.days !== null && e.days <= 90)
      .sort((a, b) => (a.days as number) - (b.days as number))
    const byKind = DOC_KINDS.map((k) => {
      const entries = scoped.flatMap((d) => entriesFor(d, k.id))
      return {
        ...k,
        recorded: entries.length,
        expired: entries.filter((e) => e.days !== null && e.days <= 0).length,
        due: entries.filter((e) => e.days !== null && e.days > 0 && e.days <= 30).length,
      }
    }).filter((k) => k.recorded > 0)
    return {
      bands,
      byKind,
      dated,
      compliant,
      upcoming,
      percent: dated > 0 ? Math.round((compliant / dated) * 100) : 100,
    }
  }, [scoped, focusKind, comingUpAll])

  // Every document type with dates gets a column, right to work first. Types
  // other than the one in focus are shown, but quieter.
  const columns = DOC_KINDS.filter((k) => k.id === focusKind || documents.some((d) => entriesFor(d, k.id).length > 0))
  const isQuiet = (k: DocKind) => kind !== "all" && k !== kind
  const filtersActive =
    expiry !== "all" || kind !== "rightToWork" || group !== "all" || branch !== "all" || searchQuery !== ""
  const clearFilters = () => {
    setSearchQuery("")
    setBranch("all")
    router.replace("?", { scroll: false })
  }

  const openEdit = (doc: EmployeeDocument, tab: DocKind = "rightToWork") => {
    setSelectedDocument(doc)
    setEditTab(tab)
    setIsEditModalOpen(true)
  }
  const openDelete = (doc: EmployeeDocument) => {
    setSelectedDocument(doc)
    setIsDeleteDialogOpen(true)
  }
  const confirmDelete = async () => {
    if (!selectedDocument) return
    const doc = selectedDocument
    setIsDeleteDialogOpen(false)
    setSelectedDocument(null)
    try {
      await fetchWithAuth(`/api/documents/${doc.id}`, { method: "DELETE" })
      toast({ title: "Success", description: "Document deleted successfully" })
      queryClient.invalidateQueries({ queryKey: ["documents"] })
    } catch {
      toast({ title: "Error", description: "Failed to delete document. Please try again.", variant: "destructive" })
    }
  }

  // Save a CSV of exactly what's on screen (or just the ticked rows)
  const downloadCsv = (rows: EmployeeDocument[], name: string) => {
    const blob = new Blob(["﻿" + documentsCsv(rows)], { type: "text/csv;charset=utf-8" })
    const url = URL.createObjectURL(blob)
    const a = Object.assign(document.createElement("a"), { href: url, download: name })
    document.body.appendChild(a)
    a.click()
    a.remove()
    URL.revokeObjectURL(url)
    toast({ title: "Export ready", description: `${plural(rows.length, "employee")} saved to ${name}.` })
  }
  const viewName = () => {
    const f = EXPIRY_FILTERS.find((x) => x.id === expiry)
    const parts = [
      "documents",
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
      formData.append("search", searchQuery)
      formData.append("sortColumn", "employeeName")
      formData.append("sortOrder", "asc")
      const response = await fetch("/api/export/documents", { method: "POST", body: formData })
      if (!response.ok) throw new Error("Export failed")
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
      toast({
        title: "Export failed",
        description: "There was an error exporting the data. Please try again.",
        variant: "destructive",
      })
    } finally {
      setIsExporting(false)
    }
  }

  const allSelected = visible.length > 0 && selected.length === visible.length
  const toggleAll = () => setSelected(allSelected ? [] : visible.map((d) => d.id))
  const toggleOne = (id: string) =>
    setSelected((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]))

  // Pieces --------------------------------------------------------------

  const expiryCell = (doc: EmployeeDocument, k: DocKind) => {
    const entry = entriesFor(doc, k)[0]
    const quiet = isQuiet(k)
    if (!entry)
      return k === focusKind ? (
        <span className="text-xs text-muted-foreground">No expiry recorded</span>
      ) : (
        <span className="text-muted-foreground/50">—</span>
      )
    const u = urgencyOf(entry.days)
    // Fade documents outside the chosen expiry window, and types not in focus
    const outside = expiry !== "all" && expiry !== "none" && !entryMatches(expiry, entry.days)
    return (
      <div
        className={cn(
          "flex flex-col items-start gap-1 transition-opacity",
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
      </div>
    )
  }

  const employeeCell = (doc: EmployeeDocument) => (
    <div className="flex min-w-0 items-center gap-3">
      <Avatar name={doc.employeeName} />
      <div className="min-w-0">
        <p className="flex flex-wrap items-center gap-1.5">
          <span className="truncate font-semibold text-foreground">{doc.employeeName || "—"}</span>
          {doc.isSponsored && (
            <Badge variant="default" className="px-2 text-[11px] leading-[18px]">
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
          {[doc.status, doc.country, doc.branch || "Unassigned"].filter(Boolean).join(" · ")}
        </p>
      </div>
    </div>
  )

  const rowActions = (doc: EmployeeDocument) => (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" className="h-8 w-8">
          <span className="sr-only">Actions for {doc.employeeName}</span>
          <MoreHorizontal />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuItem onClick={() => openEdit(doc)}>
          <Pencil />
          Edit documents
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem
          className="text-destructive focus:text-destructive [&_svg]:!text-destructive"
          onClick={() => openDelete(doc)}
        >
          <Trash2 />
          Delete record
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )

  const sortHeader = (label: string, className?: string) => {
    const active = sort !== "urgent"
    const next: Sort = sort === "name-asc" ? "name-desc" : "name-asc"
    return (
      <TableHead className={className}>
        <button
          onClick={() => setParam({ sort: next })}
          className={cn(
            "inline-flex items-center gap-1 transition-colors hover:text-foreground",
            active && "text-foreground",
          )}
        >
          {label}
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

  const stripe = (doc: EmployeeDocument) =>
    cn(
      "relative before:absolute before:inset-y-0 before:left-0 before:w-[3px]",
      TONE[recordUrgency(doc, focusKind)].stripe,
    )

  const activeFilter = EXPIRY_FILTERS.find((f) => f.id === expiry)!
  const emptyCopy =
    documents.length === 0 && !filtersActive
      ? { title: "No documents yet", description: "Add documents or import a spreadsheet." }
      : expiry === "expired" || expiry === "within7"
        ? {
            title: `Nothing ${expiry === "expired" ? "expired" : "expiring in the next 7 days"}`,
            description: "Good news. Try a wider window or another filter.",
          }
        : { title: "Nothing matches", description: "Try another filter or search." }

  return (
    <div className="space-y-6 sm:space-y-8">
      <PageHeader
        title="Documents"
        description="Right-to-work, passport and visa expiry for every employee."
        actions={
          <>
            <Button variant="outline" onClick={() => setIsImportModalOpen(true)}>
              <Upload />
              Import
            </Button>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" disabled={isLoading || isExporting || documents.length === 0}>
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
                <DropdownMenuLabel className="text-xs font-semibold text-muted-foreground">
                  Full register
                </DropdownMenuLabel>
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
            <Button onClick={() => setIsAddModalOpen(true)}>
              <Plus />
              <span className="sm:hidden">Add</span>
              <span className="hidden sm:inline">Add document</span>
            </Button>
          </>
        }
      />

      {isError && (
        <ErrorState title="Couldn't load documents" message={handleApiError(error)} onRetry={() => refetch()} />
      )}

      {/* Overview: compliance and what's coming up */}
      <section aria-label="Overview" className="grid gap-4 lg:grid-cols-[minmax(0,1.15fr)_minmax(0,1fr)] lg:gap-5">
        <div className="surface flex flex-col gap-5 p-5 sm:p-6">
          <div className="flex items-start justify-between gap-4">
            <div className="space-y-1">
              <p className="eyebrow flex items-center gap-1.5">
                {focusKind === "rightToWork" && <ShieldCheck className="h-3.5 w-3.5 text-primary" />}
                {focusLabel} compliance
              </p>
              {isLoading ? (
                <Skeleton className="h-10 w-28" />
              ) : (
                <p className="flex items-baseline gap-2">
                  <span
                    className={cn(
                      "font-display text-[40px] font-semibold leading-none tracking-[-0.04em] tabular",
                      overview.percent === 100
                        ? "text-success"
                        : overview.percent >= 90
                          ? "text-foreground"
                          : "text-destructive",
                    )}
                  >
                    {overview.percent}%
                  </span>
                  <span className="text-sm text-muted-foreground">in date</span>
                </p>
              )}
              <p className="text-sm text-muted-foreground">
                {isLoading
                  ? " "
                  : overview.bands.expired > 0
                    ? `${plural(overview.bands.expired, "employee")} with an expired ${focusLabel.toLowerCase()}, out of ${overview.dated} with a date recorded.`
                    : overview.dated > 0
                      ? `No expired ${focusLabel.toLowerCase()} across ${plural(overview.dated, "employee")} with a date recorded.`
                      : `No ${focusLabel.toLowerCase()} expiry dates recorded yet.`}
              </p>
            </div>
            <span
              className={cn(
                "flex h-11 w-11 shrink-0 items-center justify-center rounded-xl",
                overview.bands.expired > 0 ? "bg-destructive-soft text-destructive" : "bg-success-soft text-success",
              )}
            >
              {overview.bands.expired > 0 ? <AlertTriangle className="h-5 w-5" /> : <ShieldCheck className="h-5 w-5" />}
            </span>
          </div>

          {/* Each employee counted once, by the focused document's status */}
          <div className="space-y-3">
            <div
              className="flex h-3 w-full overflow-hidden rounded-full bg-muted"
              role="img"
              aria-label={`Employees by ${focusLabel.toLowerCase()} status`}
            >
              {!isLoading &&
                (Object.keys(overview.bands) as Urgency[]).map((u) =>
                  overview.bands[u] > 0 ? (
                    <div
                      key={u}
                      className={cn(
                        "h-full transition-[width] duration-500 ease-smooth [&:not(:last-child)]:border-r-2 [&:not(:last-child)]:border-card",
                        TONE[u].bar,
                      )}
                      style={{ width: `${(overview.bands[u] / Math.max(scoped.length, 1)) * 100}%` }}
                      title={`${TONE[u].label}: ${overview.bands[u]}`}
                    />
                  ) : null,
                )}
            </div>
            <ul className="grid grid-cols-2 gap-x-4 gap-y-1.5 text-[13px] sm:grid-cols-3">
              {(Object.keys(overview.bands) as Urgency[])
                .filter((u) => u !== "none" || overview.bands.none > 0)
                .map((u) => (
                  <li key={u} className="flex min-w-0 items-center gap-2">
                    <span className={cn("h-2 w-2 shrink-0 rounded-full", TONE[u].bar)} aria-hidden />
                    <span className="truncate text-muted-foreground">{TONE[u].label}</span>
                    <span className="ml-auto font-semibold tabular sm:ml-0">{isLoading ? "–" : overview.bands[u]}</span>
                  </li>
                ))}
            </ul>
            <p className="text-xs text-muted-foreground">
              {focusLabel} only.{" "}
              {overview.bands.none > 0 && `${plural(overview.bands.none, "employee")} with no expiry recorded. `}Other
              documents are listed below.
            </p>
          </div>

          {/* By document type: tap a row to filter the list to it */}
          {overview.byKind.length > 0 && (
            <div className="mt-auto hidden border-t border-border/70 pt-4 sm:block">
              <div className="grid grid-cols-[minmax(0,1fr)_repeat(3,3.75rem)] gap-x-2 px-2 pb-1.5 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground sm:grid-cols-[minmax(0,1fr)_repeat(3,5rem)]">
                <span>Document</span>
                <span className="text-right">Expired</span>
                <span className="text-right">≤ 30 days</span>
                <span className="text-right">On file</span>
              </div>
              <ul>
                {overview.byKind.map((k) => (
                  <li key={k.id}>
                    <button
                      onClick={() => setParam({ type: kind === k.id ? "all" : k.id })}
                      aria-pressed={kind === k.id}
                      className={cn(
                        "grid h-9 w-full grid-cols-[minmax(0,1fr)_repeat(3,3.75rem)] items-center gap-x-2 rounded-lg px-2 text-left text-sm transition-colors sm:grid-cols-[minmax(0,1fr)_repeat(3,5rem)]",
                        "focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-ring/30",
                        kind === k.id ? "bg-primary-soft font-semibold text-primary" : "hover:bg-muted/60",
                      )}
                    >
                      <span
                        className={cn(
                          "flex min-w-0 items-center gap-1.5 truncate",
                          k.id === "rightToWork" ? "font-semibold" : "font-medium text-foreground/75",
                        )}
                      >
                        {k.id === "rightToWork" && <ShieldCheck className="h-3.5 w-3.5 shrink-0 text-primary" />}
                        {k.label}
                      </span>
                      <span
                        className={cn(
                          "text-right tabular",
                          k.expired > 0 ? "font-semibold text-destructive" : "text-muted-foreground",
                        )}
                      >
                        {k.expired}
                      </span>
                      <span
                        className={cn(
                          "text-right tabular",
                          k.due > 0 ? "font-semibold text-warning" : "text-muted-foreground",
                        )}
                      >
                        {k.due}
                      </span>
                      <span className="text-right tabular text-muted-foreground">{k.recorded}</span>
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>

        <div className="surface flex min-w-0 flex-col overflow-hidden">
          <div className="flex items-center justify-between gap-3 px-5 pb-3 pt-5 sm:px-6">
            <div>
              <p className="eyebrow">Coming up</p>
              <p className="mt-1 text-sm text-muted-foreground">
                {isLoading
                  ? " "
                  : overview.upcoming.length > 0
                    ? `${plural(overview.upcoming.length, comingUpAll ? "document" : `${focusLabel.toLowerCase()} date`)} expired or due within 90 days`
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
                      ? "bg-card text-foreground shadow-raised"
                      : "text-muted-foreground hover:text-foreground",
                  )}
                >
                  {o.label}
                </button>
              ))}
            </div>
            {overview.upcoming.length > 0 && (
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
            <ListSkeleton rows={4} />
          ) : overview.upcoming.length === 0 ? (
            <div className="flex flex-1 flex-col items-center justify-center gap-2 px-6 pb-8 pt-4 text-center">
              <span className="flex h-11 w-11 items-center justify-center rounded-full bg-success-soft text-success">
                <CalendarClock className="h-5 w-5" />
              </span>
              <p className="text-sm text-muted-foreground">
                {comingUpAll ? "All documents are" : `Every ${focusLabel.toLowerCase()} is`} valid for at least 90 days.
              </p>
            </div>
          ) : (
            <ul className="flex-1 divide-y divide-border/70 border-t border-border/70">
              {overview.upcoming.slice(0, 5).map((e, i) => {
                const chip = dateChip(e.date)
                const u = urgencyOf(e.days)
                return (
                  <li key={`${e.record.id}-${e.kind}`} className={cn(i >= 3 && "hidden sm:block")}>
                    <button
                      onClick={() => openEdit(e.record, e.kind)}
                      className="flex w-full items-center gap-3.5 px-5 py-3 text-left transition-colors hover:bg-muted/50 focus-visible:bg-muted/50 focus-visible:outline-none sm:px-6"
                    >
                      <span
                        className={cn(
                          "flex h-11 w-11 shrink-0 flex-col items-center justify-center rounded-xl leading-none",
                          TONE[u].soft,
                          TONE[u].text,
                        )}
                      >
                        <span className="text-[10px] font-semibold uppercase tracking-wide">{chip?.month}</span>
                        <span className="font-display text-[17px] font-semibold tabular">{chip?.day}</span>
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
        </div>
      </section>

      <div className="surface overflow-hidden">
        {/* Expiry filter */}
        <div className="border-b border-border/70 px-3 pt-3 sm:px-4 sm:pt-4">
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
                      "flex h-10 shrink-0 items-center gap-2 rounded-full border px-3.5 text-sm font-medium transition-[background-color,border-color,color,box-shadow] duration-150",
                      "focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-ring/30",
                      active
                        ? "border-foreground bg-foreground text-background shadow-raised"
                        : "border-border bg-card text-foreground/80 hover:border-foreground/25 hover:text-foreground",
                    )}
                  >
                    {tone && <span className={cn("h-2 w-2 rounded-full", TONE[tone].bar)} aria-hidden />}
                    {f.id === "within7" || f.id === "within30" || f.id === "within90" ? (
                      <span>
                        <span
                          className={cn("hidden sm:inline", active ? "text-background/70" : "text-muted-foreground")}
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
                          ? "bg-background/20 text-background"
                          : tone && counts[f.id] > 0 && f.id !== "valid"
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
        <div className="grid grid-cols-2 gap-2 border-b border-border/70 p-3 sm:p-4 lg:flex lg:flex-wrap lg:items-center">
          <div className="relative col-span-2 lg:mr-auto lg:w-72">
            <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Search name or country"
              aria-label="Search employee or country"
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
          <Select value={kind} onValueChange={(v) => setParam({ type: v })}>
            <SelectTrigger className="lg:w-[170px]" aria-label="Document type">
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
          <Select value={branch} onValueChange={setBranch} disabled={isLoadingBranches}>
            <SelectTrigger className="lg:w-[170px]" aria-label="Branch">
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
            <SelectTrigger className="lg:w-[170px]" aria-label="Sponsorship">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Everyone</SelectItem>
              <SelectItem value="regular">Not sponsored</SelectItem>
              <SelectItem value="sponsored">Sponsored only</SelectItem>
            </SelectContent>
          </Select>
          <Select value={sort} onValueChange={(v) => setParam({ sort: v })}>
            <SelectTrigger className="lg:w-[180px]" aria-label="Sort">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="urgent">Most urgent first</SelectItem>
              <SelectItem value="name-asc">Name A–Z</SelectItem>
              <SelectItem value="name-desc">Name Z–A</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* What's showing, and bulk actions for ticked rows */}
        <div
          className={cn(
            "flex min-h-12 flex-wrap items-center gap-x-3 gap-y-2 border-b border-border/70 px-4 py-2.5 text-sm sm:px-5",
            selected.length > 0 ? "bg-primary-soft" : "bg-muted/40",
          )}
          aria-live="polite"
        >
          {selected.length > 0 ? (
            <>
              <span className="font-semibold text-primary">{selected.length} selected</span>
              <Button
                size="sm"
                variant="outline"
                onClick={() =>
                  downloadCsv(
                    visible.filter((d) => selected.includes(d.id)),
                    "documents-selected.csv",
                  )
                }
              >
                <Download />
                Export selected
              </Button>
              <Button size="sm" variant="ghost" onClick={() => setSelected([])} className="ml-auto">
                <X />
                Clear selection
              </Button>
            </>
          ) : (
            <>
              <span className="text-muted-foreground">
                {isLoading ? (
                  "Loading…"
                ) : (
                  <>
                    Showing <span className="font-semibold text-foreground tabular">{visible.length}</span> of{" "}
                    {plural(scoped.length, "employee")}
                    {expiry !== "all" && (
                      <>
                        {" · "}
                        <span className="font-semibold text-foreground">{activeFilter.long.toLowerCase()}</span>
                      </>
                    )}
                    {kind !== "all" && (
                      <>
                        {" · "}
                        {DOC_KINDS.find((k) => k.id === kind)?.label}
                      </>
                    )}
                  </>
                )}
              </span>
              {filtersActive && (
                <Button size="sm" variant="ghost" onClick={clearFilters} className="ml-auto">
                  <X />
                  Clear filters
                </Button>
              )}
            </>
          )}
        </div>

        {/* Large screens: table */}
        <div className="hidden lg:block">
          <Table>
            <TableHeader>
              <TableRow className="hover:bg-transparent">
                <TableHead className="w-12 pl-5">
                  <Checkbox
                    checked={allSelected}
                    onCheckedChange={toggleAll}
                    aria-label="Select all shown"
                    disabled={visible.length === 0}
                  />
                </TableHead>
                {sortHeader("Employee")}
                {/* The focused document's column sorts by urgency; the others are quieter */}
                {columns.map((c) =>
                  c.id === focusKind ? (
                    <TableHead key={c.id} className="min-w-[150px]">
                      <button
                        onClick={() => setParam({ sort: "urgent" })}
                        className={cn(
                          "inline-flex items-center gap-1.5 font-semibold text-foreground transition-colors",
                        )}
                      >
                        {c.id === "rightToWork" && <ShieldCheck className="h-3.5 w-3.5 text-primary" />}
                        {c.label}
                        {sort === "urgent" ? (
                          <ArrowUp className="h-3.5 w-3.5" />
                        ) : (
                          <ArrowUpDown className="h-3.5 w-3.5 opacity-40" />
                        )}
                      </button>
                    </TableHead>
                  ) : (
                    <TableHead key={c.id} className={cn(isQuiet(c.id) && "font-normal text-muted-foreground/80")}>
                      {c.label}
                    </TableHead>
                  ),
                )}
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
              ) : visible.length > 0 ? (
                visible.map((doc) => (
                  <TableRow key={doc.id} data-state={selected.includes(doc.id) ? "selected" : undefined}>
                    <TableCell className={cn("pl-5", CELL_STRIPE[recordUrgency(doc, focusKind)])}>
                      <Checkbox
                        checked={selected.includes(doc.id)}
                        onCheckedChange={() => toggleOne(doc.id)}
                        aria-label={`Select ${doc.employeeName}`}
                      />
                    </TableCell>
                    <TableCell className="min-w-[240px]">{employeeCell(doc)}</TableCell>
                    {columns.map((c) => (
                      <TableCell key={c.id}>{expiryCell(doc, c.id)}</TableCell>
                    ))}
                    <TableCell className="text-right">{rowActions(doc)}</TableCell>
                  </TableRow>
                ))
              ) : (
                <TableRow className="hover:bg-transparent">
                  <TableCell colSpan={columns.length + 3}>
                    <EmptyState icon={FileText} title={emptyCopy.title} description={emptyCopy.description} />
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
          ) : visible.length > 0 ? (
            <ul className="divide-y divide-border/70">
              {visible.map((doc) => {
                // Every document, right to work first; the focused type stands out
                const items = entriesFor(doc)
                const focusMissing = !items.some((i) => i.kind === focusKind)
                return (
                  <li
                    key={doc.id}
                    className={cn(
                      "space-y-3 px-4 py-4 sm:px-5",
                      stripe(doc),
                      selected.includes(doc.id) && "bg-primary-soft/50",
                    )}
                  >
                    <div className="flex items-start gap-3">
                      <Checkbox
                        checked={selected.includes(doc.id)}
                        onCheckedChange={() => toggleOne(doc.id)}
                        aria-label={`Select ${doc.employeeName}`}
                        className="mt-2.5"
                      />
                      <div className="min-w-0 flex-1">{employeeCell(doc)}</div>
                      {rowActions(doc)}
                    </div>
                    {focusMissing && <p className="text-xs text-muted-foreground">{focusLabel}: no expiry recorded</p>}
                    {items.length > 0 ? (
                      <dl className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                        {items.map((item) => {
                          const u = urgencyOf(item.days)
                          const outside = expiry !== "all" && expiry !== "none" && !entryMatches(expiry, item.days)
                          const focus = item.kind === focusKind && !isQuiet(item.kind)
                          return (
                            <div
                              key={item.kind}
                              className={cn(
                                "space-y-1 rounded-lg px-3 py-2.5 transition-opacity",
                                focus
                                  ? "col-span-2 bg-primary-soft/60 ring-1 ring-inset ring-primary/20 sm:col-span-2"
                                  : "bg-muted/50",
                                outside ? "opacity-40" : isQuiet(item.kind) && "opacity-60",
                              )}
                            >
                              <dt
                                className={cn(
                                  "flex items-center gap-1.5 truncate text-[11px] font-semibold uppercase tracking-wide",
                                  focus ? "text-primary" : "text-muted-foreground",
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
                            </div>
                          )
                        })}
                      </dl>
                    ) : (
                      <p className="text-sm text-muted-foreground">No expiry dates recorded.</p>
                    )}
                  </li>
                )
              })}
            </ul>
          ) : (
            <EmptyState icon={FileText} title={emptyCopy.title} description={emptyCopy.description} />
          )}
        </div>
      </div>

      <AddDocumentModal open={isAddModalOpen} onOpenChange={setIsAddModalOpen} />
      {selectedDocument && (
        <EditDocumentModal
          key={`${selectedDocument.id}-${editTab}`}
          document={selectedDocument}
          initialTab={editTab}
          open={isEditModalOpen}
          onOpenChange={setIsEditModalOpen}
        />
      )}
      <DeleteConfirmationDialog
        isOpen={isDeleteDialogOpen}
        onClose={() => setIsDeleteDialogOpen(false)}
        onConfirm={confirmDelete}
        title="Delete document record"
        description={`Delete the document record for ${selectedDocument?.employeeName}? This can't be undone.`}
        confirmLabel="Delete"
        cancelLabel="Cancel"
      />
      <ImportDocumentsModal open={isImportModalOpen} onOpenChange={setIsImportModalOpen} />
    </div>
  )
}
