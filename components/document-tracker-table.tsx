"use client"

import { useState, useEffect } from "react"
import { useQuery, useQueryClient } from "@tanstack/react-query"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import {
  MoreHorizontal,
  Pencil,
  Trash2,
  Plus,
  Search,
  X,
  Download,
  FileSpreadsheet,
  FileText,
  Loader2,
  Upload,
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
} from "lucide-react"
import { Skeleton } from "@/components/ui/skeleton"
import { useToast } from "@/components/ui/use-toast"
import { fetchWithAuth, handleApiError } from "@/lib/api-utils"
import { useBranches } from "@/hooks/use-branches"
import { Badge } from "@/components/ui/badge"
import { AddDocumentModal } from "./add-document-modal"
import { EditDocumentModal } from "./edit-document-modal"
import { DeleteConfirmationDialog } from "./delete-confirmation-dialog"
import { Checkbox } from "@/components/ui/checkbox"
import type { EmployeeDocument } from "@/lib/types"
import { cn } from "@/lib/utils"
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { formatDisplayDate } from "@/lib/dates"
import { Avatar, EmptyState, ErrorState, ListSkeleton, PageHeader, Toolbar, plural } from "./page-kit"
import { ImportDocumentsModal } from "./import-documents-modal"

export function DocumentTrackerTable() {
  const [searchQuery, setSearchQuery] = useState("")
  const [selectedBranch, setSelectedBranch] = useState<string>("all")
  const selectedStatus = "all" // status is filtered with the tiles, on the page
  const [debouncedSearchQuery, setDebouncedSearchQuery] = useState("")
  const [isAddModalOpen, setIsAddModalOpen] = useState(false)
  const [isEditModalOpen, setIsEditModalOpen] = useState(false)
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false)
  const [selectedDocument, setSelectedDocument] = useState<EmployeeDocument | null>(null)
  const [selectedDocuments, setSelectedDocuments] = useState<string[]>([])
  const [activeTab, setActiveTab] = useState<string>("all")
  const [activeSection, setActiveSection] = useState<string>("all")
  const [isExporting, setIsExporting] = useState(false)
  const [isImportModalOpen, setIsImportModalOpen] = useState(false)
  const serverSortColumn = "employeeName"
  const serverSortOrder = "asc"
  const [sortColumn, setSortColumn] = useState<string | null>("employeeName")
  const [sortDirection, setSortDirection] = useState<"asc" | "desc">("asc")

  const { toast } = useToast()
  const queryClient = useQueryClient()
  const { data: branches = [], isLoading: isLoadingBranches } = useBranches()

  useEffect(() => {
    const timeoutId = setTimeout(() => {
      setDebouncedSearchQuery(searchQuery)
    }, 500)
    return () => clearTimeout(timeoutId)
  }, [searchQuery])

  const {
    data: documents = [],
    isLoading,
    isError,
    error,
    refetch,
  } = useQuery<EmployeeDocument[]>({
    queryKey: ["documents", selectedBranch, selectedStatus, debouncedSearchQuery, sortColumn, sortDirection],
    queryFn: async () => {
      const params = new URLSearchParams()
      if (selectedBranch !== "all") {
        params.append("branch", selectedBranch)
      }
      if (selectedStatus !== "all") {
        params.append("status", selectedStatus)
      }
      if (debouncedSearchQuery) {
        params.append("search", debouncedSearchQuery)
      }
      params.append("sortColumn", serverSortColumn)
      params.append("sortOrder", serverSortOrder)

      if (sortColumn) {
        params.append("sortColumn", sortColumn)
        params.append("sortDirection", sortDirection)
      }

      return fetchWithAuth(`/api/documents?${params.toString()}`)
    },
  })

  const deleteDocument = async (id: string) => {
    try {
      await fetchWithAuth(`/api/documents/${id}`, {
        method: "DELETE",
      })

      toast({
        title: "Success",
        description: "Document deleted successfully",
      })

      queryClient.invalidateQueries({ queryKey: ["documents"] })
    } catch {
      toast({
        title: "Error",
        description: "Failed to delete document. Please try again.",
        variant: "destructive",
      })
    }
  }

  const handleEditDocument = (document: EmployeeDocument) => {
    setSelectedDocument(document)
    setIsEditModalOpen(true)
  }

  const handleDeleteDocument = (document: EmployeeDocument) => {
    setSelectedDocument(document)
    setIsDeleteDialogOpen(true)
  }

  const confirmDeleteDocument = () => {
    if (selectedDocument) {
      deleteDocument(selectedDocument.id)
      setIsDeleteDialogOpen(false)
      setSelectedDocument(null)
    }
  }

  const toggleDocumentSelection = (id: string) => {
    setSelectedDocuments((prev) => {
      if (prev.includes(id)) {
        return prev.filter((docId) => docId !== id)
      } else {
        return [...prev, id]
      }
    })
  }

  const toggleAllDocuments = (docs: EmployeeDocument[]) => {
    if (selectedDocuments.length === docs.length) {
      setSelectedDocuments([])
    } else {
      setSelectedDocuments(docs.map((doc) => doc.id))
    }
  }

  const getDocumentStatus = (daysLeft: number | null) => {
    if (!daysLeft && daysLeft !== 0) return "valid"
    if (daysLeft <= 0) return "expired"
    if (daysLeft <= 7) return "expiring7"
    if (daysLeft <= 30) return "expiring30"
    if (daysLeft <= 90) return "expiring90"
    return "valid"
  }

  const sponsoredDocuments = documents.filter((doc) => doc.isSponsored)
  const regularDocuments = documents.filter((doc) => !doc.isSponsored)

  const calculateStats = (docs: EmployeeDocument[]) => {
    return {
      expired: docs.filter(
        (doc) =>
          (doc.passportDaysLeft !== null && doc.passportDaysLeft <= 0) ||
          (doc.rightToWorkDaysLeft !== null && doc.rightToWorkDaysLeft <= 0) ||
          (doc.brpDaysLeft !== null && doc.brpDaysLeft <= 0) ||
          (doc.otherDocumentDaysLeft !== null && doc.otherDocumentDaysLeft <= 0),
      ),
      expiringIn7: docs.filter(
        (doc) =>
          (doc.passportDaysLeft !== null && doc.passportDaysLeft > 0 && doc.passportDaysLeft <= 7) ||
          (doc.rightToWorkDaysLeft !== null && doc.rightToWorkDaysLeft > 0 && doc.rightToWorkDaysLeft <= 7) ||
          (doc.brpDaysLeft !== null && doc.brpDaysLeft > 0 && doc.brpDaysLeft <= 7) ||
          (doc.otherDocumentDaysLeft !== null && doc.otherDocumentDaysLeft > 0 && doc.otherDocumentDaysLeft <= 7),
      ),
      expiringIn30: docs.filter(
        (doc) =>
          (doc.passportDaysLeft !== null && doc.passportDaysLeft > 7 && doc.passportDaysLeft <= 30) ||
          (doc.rightToWorkDaysLeft !== null && doc.rightToWorkDaysLeft > 7 && doc.rightToWorkDaysLeft <= 30) ||
          (doc.brpDaysLeft !== null && doc.brpDaysLeft > 7 && doc.brpDaysLeft <= 30) ||
          (doc.otherDocumentDaysLeft !== null && doc.otherDocumentDaysLeft > 7 && doc.otherDocumentDaysLeft <= 30),
      ),
      expiringIn90: docs.filter(
        (doc) =>
          (doc.passportDaysLeft !== null && doc.passportDaysLeft > 30 && doc.passportDaysLeft <= 90) ||
          (doc.rightToWorkDaysLeft !== null && doc.rightToWorkDaysLeft > 30 && doc.rightToWorkDaysLeft <= 90) ||
          (doc.brpDaysLeft !== null && doc.brpDaysLeft > 30 && doc.brpDaysLeft <= 90) ||
          (doc.otherDocumentDaysLeft !== null && doc.otherDocumentDaysLeft > 30 && doc.otherDocumentDaysLeft <= 90),
      ),
      valid: docs.filter(
        (doc) =>
          (doc.passportDaysLeft === null || doc.passportDaysLeft > 90) &&
          (doc.rightToWorkDaysLeft === null || doc.rightToWorkDaysLeft > 90) &&
          (doc.brpDaysLeft === null || doc.brpDaysLeft > 90) &&
          (doc.otherDocumentDaysLeft === null || doc.otherDocumentDaysLeft > 90),
      ),
    }
  }


  const getFilteredDocuments = () => {
    const docsToFilter =
      activeSection === "sponsored" ? sponsoredDocuments : activeSection === "regular" ? regularDocuments : documents

    switch (activeTab) {
      case "expired":
        return docsToFilter.filter(
          (doc) =>
            (doc.passportDaysLeft !== null && doc.passportDaysLeft <= 0) ||
            (doc.rightToWorkDaysLeft !== null && doc.rightToWorkDaysLeft <= 0) ||
            (doc.brpDaysLeft !== null && doc.brpDaysLeft <= 0) ||
            (doc.otherDocumentDaysLeft !== null && doc.otherDocumentDaysLeft <= 0),
        )
      case "expiring7":
        return docsToFilter.filter(
          (doc) =>
            (doc.passportDaysLeft !== null && doc.passportDaysLeft > 0 && doc.passportDaysLeft <= 7) ||
            (doc.rightToWorkDaysLeft !== null && doc.rightToWorkDaysLeft > 0 && doc.rightToWorkDaysLeft <= 7) ||
            (doc.brpDaysLeft !== null && doc.brpDaysLeft > 0 && doc.brpDaysLeft <= 7) ||
            (doc.otherDocumentDaysLeft !== null && doc.otherDocumentDaysLeft > 0 && doc.otherDocumentDaysLeft <= 7),
        )
      case "expiring30":
        return docsToFilter.filter(
          (doc) =>
            (doc.passportDaysLeft !== null && doc.passportDaysLeft > 7 && doc.passportDaysLeft <= 30) ||
            (doc.rightToWorkDaysLeft !== null && doc.rightToWorkDaysLeft > 7 && doc.rightToWorkDaysLeft <= 30) ||
            (doc.brpDaysLeft !== null && doc.brpDaysLeft > 7 && doc.brpDaysLeft <= 30) ||
            (doc.otherDocumentDaysLeft !== null && doc.otherDocumentDaysLeft > 7 && doc.otherDocumentDaysLeft <= 30),
        )
      case "expiring90":
        return docsToFilter.filter(
          (doc) =>
            (doc.passportDaysLeft !== null && doc.passportDaysLeft > 30 && doc.passportDaysLeft <= 90) ||
            (doc.rightToWorkDaysLeft !== null && doc.rightToWorkDaysLeft > 30 && doc.rightToWorkDaysLeft <= 90) ||
            (doc.brpDaysLeft !== null && doc.brpDaysLeft > 30 && doc.brpDaysLeft <= 90) ||
            (doc.otherDocumentDaysLeft !== null && doc.otherDocumentDaysLeft > 30 && doc.otherDocumentDaysLeft <= 90),
        )
      case "valid":
        return docsToFilter.filter(
          (doc) =>
            (doc.passportDaysLeft === null || doc.passportDaysLeft > 90) &&
            (doc.rightToWorkDaysLeft === null || doc.rightToWorkDaysLeft > 90) &&
            (doc.brpDaysLeft === null || doc.brpDaysLeft > 90) &&
            (doc.otherDocumentDaysLeft === null || doc.otherDocumentDaysLeft > 90),
        )
      default:
        return docsToFilter
    }
  }

  const handleExportDocuments = async (format: string) => {
    setIsExporting(true)

    try {
      const formData = new FormData()
      formData.append("format", format)
      formData.append("branch", selectedBranch)
      formData.append("status", selectedStatus)
      formData.append("search", searchQuery)
      formData.append("sortColumn", serverSortColumn)
      formData.append("sortOrder", serverSortOrder)

      if (sortColumn) {
        formData.append("sortColumn", sortColumn)
        formData.append("sortDirection", sortDirection)
      }

      const response = await fetch("/api/export/documents", {
        method: "POST",
        body: formData,
      })

      if (!response.ok) {
        throw new Error("Export failed")
      }

      let filename = `document-tracker.${format === "csv" ? "csv" : "xlsx"}`
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
      toast({
        title: "Export failed",
        description: "There was an error exporting the data. Please try again.",
        variant: "destructive",
      })
      console.error("Export error:", error)
    } finally {
      setIsExporting(false)
    }
  }

  const filteredDocuments = getFilteredDocuments()

  const expiryBadge = (daysLeft: number | null) => {
    const status = getDocumentStatus(daysLeft)
    const label =
      daysLeft === null
        ? "—"
        : daysLeft < 0
          ? `${Math.abs(daysLeft)}d overdue`
          : daysLeft === 0
            ? "Expires today"
            : daysLeft > 365
              ? `${Math.floor(daysLeft / 365)}y ${Math.round((daysLeft % 365) / 30)}m`
              : `${daysLeft}d left`
    const variant =
      status === "expired" || status === "expiring7"
        ? "destructive"
        : status === "expiring30"
          ? "warning"
          : status === "expiring90"
            ? "default"
            : "success"
    return (
      <Badge variant={variant} dot={status !== "valid"} className="px-2 text-[11px] leading-[18px] tabular">
        {label}
      </Badge>
    )
  }

  const formatExpiryDate = (expiryDate: string | null, daysLeft: number | null) => {
    if (!expiryDate) return <span className="text-muted-foreground/50">—</span>
    return (
      <div className="flex flex-col items-start gap-1">
        <span className="whitespace-nowrap text-sm font-medium tabular">{formatDisplayDate(expiryDate)}</span>
        {expiryBadge(daysLeft)}
      </div>
    )
  }

  const handleSort = (column: string) => {
    if (sortColumn === column) {
      setSortDirection(sortDirection === "asc" ? "desc" : "asc")
    } else {
      setSortColumn(column)
      setSortDirection("asc")
    }
  }

  const hasAnyDates = (documents: EmployeeDocument[], field: "passport" | "rightToWork" | "brp" | "otherDocument") => {
    return documents.some((doc) => {
      switch (field) {
        case "passport":
          return doc.passportExpiry !== null && doc.passportExpiry !== undefined
        case "rightToWork":
          return doc.rightToWorkExpiry !== null && doc.rightToWorkExpiry !== undefined
        case "brp":
          return doc.brpExpiry !== null && doc.brpExpiry !== undefined
        case "otherDocument":
          return doc.otherDocumentExpiry !== null && doc.otherDocumentExpiry !== undefined
      }
    })
  }

  const sectionDocs = activeSection === "sponsored" ? sponsoredDocuments : activeSection === "regular" ? regularDocuments : documents
  const sectionStats = calculateStats(sectionDocs)
  const statusTiles = [
    { key: "expired", label: "Expired", short: "Expired", count: sectionStats.expired.length, tone: "danger" },
    { key: "expiring7", label: "Within 7 days", short: "7 days", count: sectionStats.expiringIn7.length, tone: "danger" },
    { key: "expiring30", label: "Within 30 days", short: "30 days", count: sectionStats.expiringIn30.length, tone: "warning" },
    { key: "expiring90", label: "Within 90 days", short: "90 days", count: sectionStats.expiringIn90.length, tone: "info" },
    { key: "valid", label: "Valid", short: "Valid", count: sectionStats.valid.length, tone: "success" },
  ] as const
  const toneStyles = {
    danger: { dot: "bg-destructive", text: "text-destructive", ring: "ring-destructive/40 bg-destructive-soft" },
    warning: { dot: "bg-warning", text: "text-warning", ring: "ring-warning/40 bg-warning-soft" },
    info: { dot: "bg-primary", text: "text-primary", ring: "ring-primary/40 bg-primary-soft" },
    success: { dot: "bg-success", text: "text-success", ring: "ring-success/40 bg-success-soft" },
  }
  const columnsShown = {
    passport: hasAnyDates(documents, "passport"),
    rightToWork: hasAnyDates(documents, "rightToWork"),
    brp: hasAnyDates(documents, "brp"),
    other: hasAnyDates(documents, "otherDocument"),
  }

  const sortHeader = (label: string, column: string) => (
    <TableHead>
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

  const rowActions = (doc: EmployeeDocument) => (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" className="h-8 w-8">
          <span className="sr-only">Actions for {doc.employeeName}</span>
          <MoreHorizontal />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuItem onClick={() => handleEditDocument(doc)}>
          <Pencil />
          Edit documents
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem
          className="text-destructive focus:text-destructive [&_svg]:!text-destructive"
          onClick={() => handleDeleteDocument(doc)}
        >
          <Trash2 />
          Delete record
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )

  const employeeCell = (doc: EmployeeDocument) => (
    <div className="flex items-center gap-3">
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
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={() => handleExportDocuments("csv")}>
                  <FileText />
                  CSV file
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => handleExportDocuments("excel")}>
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

      {isError && <ErrorState title="Couldn't load documents" message={handleApiError(error)} onRetry={() => refetch()} />}

      {/* Expiry summary: each tile filters the list */}
      <div className="grid grid-cols-3 gap-2 min-[400px]:grid-cols-5 sm:gap-3">
        {statusTiles.map((tile) => {
          const active = activeTab === tile.key
          const tone = toneStyles[tile.tone]
          return (
            <button
              key={tile.key}
              onClick={() => setActiveTab(active ? "all" : tile.key)}
              aria-pressed={active}
              className={cn(
                "surface flex min-w-0 flex-col items-start gap-1.5 px-2.5 py-3 text-left transition-[box-shadow,background-color,transform] duration-200 ease-smooth hover:-translate-y-px hover:shadow-raised focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-ring/30 sm:gap-2 sm:p-4",
                active && cn("ring-2", tone.ring),
              )}
            >
              <span className="flex min-w-0 items-center gap-1.5 text-[11px] font-semibold text-muted-foreground sm:gap-2 sm:text-[13px]">
                <span className={cn("h-2 w-2 shrink-0 rounded-full", tone.dot)} aria-hidden />
                <span className="truncate lg:hidden">{tile.short}</span>
                <span className="hidden truncate lg:inline">{tile.label}</span>
              </span>
              {isLoading ? (
                <Skeleton className="h-7 w-10" />
              ) : (
                <span className={cn("font-display text-[22px] font-semibold sm:text-[26px] leading-none tracking-[-0.03em] tabular", tile.count > 0 && tile.tone !== "success" ? tone.text : "text-foreground")}>
                  {tile.count}
                </span>
              )}
            </button>
          )
        })}
      </div>

      <div className="surface overflow-hidden">
        <Toolbar className="border-b border-border/70 p-3 sm:p-4">
          <Tabs value={activeSection} onValueChange={setActiveSection}>
            <TabsList className="w-full sm:w-auto">
              <TabsTrigger value="all" className="flex-1 px-2 sm:flex-none sm:px-3">
                All <span className="text-muted-foreground tabular">{documents.length}</span>
              </TabsTrigger>
              <TabsTrigger value="regular" className="flex-1 px-2 sm:flex-none sm:px-3">
                Regular <span className="text-muted-foreground tabular">{regularDocuments.length}</span>
              </TabsTrigger>
              <TabsTrigger value="sponsored" className="flex-1 px-2 sm:flex-none sm:px-3">
                Sponsored <span className="text-muted-foreground tabular">{sponsoredDocuments.length}</span>
              </TabsTrigger>
            </TabsList>
          </Tabs>
          <div className="relative flex-1 sm:max-w-xs lg:ml-auto">
            <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Search name or country"
              aria-label="Search employee or country"
              className="pl-10"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>
          <Select value={selectedBranch} onValueChange={setSelectedBranch} disabled={isLoadingBranches}>
            <SelectTrigger className="sm:w-[180px]" aria-label="Branch">
              <SelectValue placeholder="All branches" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All branches</SelectItem>
              {branches.map((branch) => (
                <SelectItem key={branch.id} value={branch.name}>
                  {branch.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Toolbar>

        {activeTab !== "all" && (
          <div className="flex items-center justify-between gap-3 border-b border-border/70 bg-muted/40 px-4 py-2.5 text-sm sm:px-5">
            <span className="text-muted-foreground">
              Showing <span className="font-semibold text-foreground">{statusTiles.find((t) => t.key === activeTab)?.label.toLowerCase()}</span>
            </span>
            <Button variant="ghost" size="sm" onClick={() => setActiveTab("all")}>
              <X />
              Show all
            </Button>
          </div>
        )}

        {/* Large screens: table */}
        <div className="hidden lg:block">
          <Table>
            <TableHeader>
              <TableRow className="hover:bg-transparent">
                <TableHead>
                  <Checkbox
                    checked={selectedDocuments.length === filteredDocuments.length && filteredDocuments.length > 0}
                    onCheckedChange={() => toggleAllDocuments(filteredDocuments)}
                    aria-label="Select all documents"
                  />
                </TableHead>
                {sortHeader("Employee", "employeeName")}
                {columnsShown.passport && sortHeader("Passport", "passportDaysLeft")}
                {columnsShown.rightToWork && sortHeader("Right to work", "rightToWorkDaysLeft")}
                {columnsShown.brp && sortHeader("BRP", "brpDaysLeft")}
                {columnsShown.other && sortHeader("Other", "otherDocumentDaysLeft")}
                <TableHead className="w-12">
                  <span className="sr-only">Actions</span>
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                Array.from({ length: 5 }).map((_, index) => (
                  <TableRow key={index} className="hover:bg-transparent">
                    <TableCell colSpan={7} className="py-3.5">
                      <div className="flex items-center gap-3">
                        <Skeleton className="h-9 w-9 rounded-full" />
                        <Skeleton className="h-4 w-1/5" />
                        <Skeleton className="ml-auto h-4 w-1/2" />
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              ) : filteredDocuments.length > 0 ? (
                filteredDocuments.map((doc) => (
                  <TableRow key={doc.id} data-state={selectedDocuments.includes(doc.id) ? "selected" : undefined}>
                    <TableCell>
                      <Checkbox
                        checked={selectedDocuments.includes(doc.id)}
                        onCheckedChange={() => toggleDocumentSelection(doc.id)}
                        aria-label={`Select ${doc.employeeName}`}
                      />
                    </TableCell>
                    <TableCell className="min-w-[240px]">{employeeCell(doc)}</TableCell>
                    {columnsShown.passport && <TableCell>{formatExpiryDate(doc.passportExpiry, doc.passportDaysLeft)}</TableCell>}
                    {columnsShown.rightToWork && <TableCell>{formatExpiryDate(doc.rightToWorkExpiry, doc.rightToWorkDaysLeft)}</TableCell>}
                    {columnsShown.brp && <TableCell>{formatExpiryDate(doc.brpExpiry, doc.brpDaysLeft)}</TableCell>}
                    {columnsShown.other && (
                      <TableCell>
                        {doc.otherDocumentType && doc.otherDocumentExpiry ? (
                          <div className="space-y-0.5">
                            <p className="text-xs font-semibold text-muted-foreground">{doc.otherDocumentType}</p>
                            {formatExpiryDate(doc.otherDocumentExpiry, doc.otherDocumentDaysLeft)}
                          </div>
                        ) : (
                          <span className="text-muted-foreground/50">—</span>
                        )}
                      </TableCell>
                    )}
                    <TableCell className="text-right">{rowActions(doc)}</TableCell>
                  </TableRow>
                ))
              ) : (
                <TableRow className="hover:bg-transparent">
                  <TableCell colSpan={7}>
                    <EmptyState
                      icon={FileText}
                      title={documents.length === 0 ? "No documents yet" : "Nothing matches"}
                      description={documents.length === 0 ? "Add documents or import a spreadsheet." : "Try another filter or search."}
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
          ) : filteredDocuments.length > 0 ? (
            <ul className="divide-y divide-border/70">
              {filteredDocuments.map((doc) => {
                const items = [
                  { label: "Passport", date: doc.passportExpiry, days: doc.passportDaysLeft },
                  { label: "Right to work", date: doc.rightToWorkExpiry, days: doc.rightToWorkDaysLeft },
                  { label: "BRP", date: doc.brpExpiry, days: doc.brpDaysLeft },
                  { label: doc.otherDocumentType || "Other", date: doc.otherDocumentExpiry, days: doc.otherDocumentDaysLeft },
                ].filter((item) => item.date)
                return (
                  <li key={doc.id} className="space-y-3 px-4 py-4 sm:px-5">
                    <div className="flex items-start gap-2">
                      <div className="min-w-0 flex-1">{employeeCell(doc)}</div>
                      {rowActions(doc)}
                    </div>
                    {items.length > 0 ? (
                      <dl className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                        {items.map((item) => (
                          <div key={item.label} className="space-y-1 rounded-lg bg-muted/50 px-3 py-2.5">
                            <dt className="truncate text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">{item.label}</dt>
                            <dd className="space-y-1">
                              <span className="block text-sm font-medium tabular">{formatDisplayDate(item.date as string)}</span>
                              {expiryBadge(item.days)}
                            </dd>
                          </div>
                        ))}
                      </dl>
                    ) : (
                      <p className="text-sm text-muted-foreground">No expiry dates recorded.</p>
                    )}
                  </li>
                )
              })}
            </ul>
          ) : (
            <EmptyState icon={FileText} title={documents.length === 0 ? "No documents yet" : "Nothing matches"} />
          )}
        </div>

        {!isLoading && filteredDocuments.length > 0 && (
          <div className="border-t border-border/70 px-4 py-3 text-sm text-muted-foreground sm:px-5">
            {plural(filteredDocuments.length, "employee")}
            {selectedDocuments.length > 0 && ` · ${selectedDocuments.length} selected`}
          </div>
        )}
      </div>

      <AddDocumentModal open={isAddModalOpen} onOpenChange={setIsAddModalOpen} />

      {selectedDocument && (
        <EditDocumentModal document={selectedDocument} open={isEditModalOpen} onOpenChange={setIsEditModalOpen} />
      )}

      <DeleteConfirmationDialog
        isOpen={isDeleteDialogOpen}
        onClose={() => setIsDeleteDialogOpen(false)}
        onConfirm={confirmDeleteDocument}
        title="Delete document record"
        description={`Delete the document record for ${selectedDocument?.employeeName}? This can't be undone.`}
        confirmLabel="Delete"
        cancelLabel="Cancel"
      />

      <ImportDocumentsModal open={isImportModalOpen} onOpenChange={setIsImportModalOpen} />
    </div>
  )
}
