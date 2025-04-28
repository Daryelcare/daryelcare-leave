"use client"

import { useState, useEffect } from "react"
import { useQuery, useQueryClient } from "@tanstack/react-query"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import {
  Pencil,
  Trash2,
  Plus,
  Search,
  Users,
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
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"
import { ImportDocumentsModal } from "./import-documents-modal"

export function DocumentTrackerTable() {
  const [searchQuery, setSearchQuery] = useState("")
  const [selectedBranch, setSelectedBranch] = useState<string>("all")
  const [selectedStatus, setSelectedStatus] = useState<string>("all")
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
  const [serverSortColumn, setServerSortColumn] = useState<string>("employeeName")
  const [serverSortOrder, setServerSortOrder] = useState<"asc" | "desc">("asc")
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
    } catch (error) {
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

  const regularStats = calculateStats(regularDocuments)
  const sponsoredStats = calculateStats(sponsoredDocuments)

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
        title: "Export Successful",
        description: `Your ${format.toUpperCase()} file has been downloaded.`,
      })
    } catch (error) {
      toast({
        title: "Export Failed",
        description: "There was an error exporting the data. Please try again.",
        variant: "destructive",
      })
      console.error("Export error:", error)
    } finally {
      setIsExporting(false)
    }
  }

  const filteredDocuments = getFilteredDocuments()

  const formatExpiryDate = (expiryDate: string | null, daysLeft: number | null) => {
    if (!expiryDate) return <span className="text-gray-400">N/A</span>

    const status = getDocumentStatus(daysLeft)

    return (
      <div>
        <div
          className={cn(
            status === "expired"
              ? "text-red-500"
              : status === "expiring7"
                ? "text-red-500"
                : status === "expiring30"
                  ? "text-orange-500"
                  : status === "expiring90"
                    ? "text-yellow-500"
                    : "text-green-500",
          )}
        >
          {expiryDate}
        </div>
        <div className="flex items-center text-sm">
          <div className="size-1.5 rounded-full mr-1.5 bg-current" />
          {daysLeft && daysLeft <= 0 ? (
            <span className="text-red-500">{Math.abs(daysLeft)} days expired</span>
          ) : (
            <span>{daysLeft} days left</span>
          )}
        </div>
      </div>
    )
  }

  const handleServerSort = (column: string) => {
    if (column === serverSortColumn) {
      setServerSortOrder(serverSortOrder === "asc" ? "desc" : "asc")
    } else {
      setServerSortColumn(column)
      setServerSortOrder("asc")
    }
  }

  const handleSort = (column: string) => {
    if (sortColumn === column) {
      setSortDirection(sortDirection === "asc" ? "desc" : "asc")
    } else {
      setSortColumn(column)
      setSortDirection("asc")
    }
  }

  const renderSortIndicator = (column: string) => {
    if (sortColumn !== column) {
      return <ArrowUpDown className="ml-2 h-4 w-4" />
    }
    return sortDirection === "asc" ? <ArrowUp className="ml-2 h-4 w-4" /> : <ArrowDown className="ml-2 h-4 w-4" />
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

  if (isError) {
    return (
      <div className="rounded-md bg-destructive/15 p-4 text-destructive">
        <p>Error loading documents: {handleApiError(error)}</p>
        <Button variant="outline" size="sm" onClick={() => refetch()} className="mt-2">
          Try Again
        </Button>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div className="flex items-center gap-2">
          <div className="relative w-full md:w-auto">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search employee or country..."
              className="w-full pl-8 md:w-[300px]"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>
          <Select value={selectedBranch} onValueChange={setSelectedBranch} disabled={isLoadingBranches}>
            <SelectTrigger className="w-[180px]">
              <SelectValue placeholder="All Branches" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Branches</SelectItem>
              {branches.map((branch) => (
                <SelectItem key={branch.id} value={branch.name}>
                  {branch.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" className="gap-2" onClick={() => setIsImportModalOpen(true)}>
            <Upload className="h-4 w-4" />
            Import
          </Button>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" className="gap-2" disabled={isLoading || isExporting || documents.length === 0}>
                {isExporting ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Exporting...
                  </>
                ) : (
                  <>
                    <Download className="h-4 w-4" />
                    Export
                  </>
                )}
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={() => handleExportDocuments("csv")}>
                <FileText className="h-4 w-4 mr-2" />
                Export as CSV
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => handleExportDocuments("excel")}>
                <FileSpreadsheet className="h-4 w-4 mr-2" />
                Export as Excel
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
          <Button
            className="gap-2 bg-gradient-to-r from-purple-600 to-blue-500 hover:from-purple-700 hover:to-blue-600"
            onClick={() => setIsAddModalOpen(true)}
          >
            <Plus className="h-4 w-4" />
            Add Document
          </Button>
        </div>
      </div>

      <Tabs value={activeSection} onValueChange={setActiveSection} className="w-full">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="all" className="flex items-center gap-2">
            <Users className="h-4 w-4" />
            All Employees
            <Badge variant="secondary" className="ml-1">
              {documents.length}
            </Badge>
          </TabsTrigger>
          <TabsTrigger value="regular" className="flex items-center gap-2">
            Regular Employees
            <Badge variant="secondary" className="ml-1">
              {regularDocuments.length}
            </Badge>
          </TabsTrigger>
          <TabsTrigger value="sponsored" className="flex items-center gap-2">
            Sponsored Employees
            <Badge variant="secondary" className="ml-1">
              {sponsoredDocuments.length}
            </Badge>
          </TabsTrigger>
        </TabsList>
      </Tabs>

      <div className="flex border-b overflow-x-auto">
        <button
          className={cn(
            "px-4 py-2 text-sm font-medium border-b-2 -mb-px whitespace-nowrap",
            activeTab === "all"
              ? "border-blue-500 text-blue-600"
              : "border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300",
          )}
          onClick={() => setActiveTab("all")}
        >
          All Documents{" "}
          <span className="ml-1.5 rounded-full bg-gray-100 px-2 py-0.5">
            {activeSection === "sponsored"
              ? sponsoredDocuments.length
              : activeSection === "regular"
                ? regularDocuments.length
                : documents.length}
          </span>
        </button>
        <button
          className={cn(
            "px-4 py-2 text-sm font-medium border-b-2 -mb-px whitespace-nowrap",
            activeTab === "expired"
              ? "border-blue-500 text-blue-600"
              : "border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300",
          )}
          onClick={() => setActiveTab("expired")}
        >
          Expired{" "}
          <span className="ml-1.5 rounded-full bg-red-100 px-2 py-0.5">
            {activeSection === "sponsored"
              ? sponsoredStats.expired.length
              : activeSection === "regular"
                ? regularStats.expired.length
                : regularStats.expired.length + sponsoredStats.expired.length}
          </span>
        </button>
        <button
          className={cn(
            "px-4 py-2 text-sm font-medium border-b-2 -mb-px whitespace-nowrap",
            activeTab === "expiring7"
              ? "border-blue-500 text-blue-600"
              : "border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300",
          )}
          onClick={() => setActiveTab("expiring7")}
        >
          Expiring in 7 Days{" "}
          <span className="ml-1.5 rounded-full bg-red-100 px-2 py-0.5">
            {activeSection === "sponsored"
              ? sponsoredStats.expiringIn7.length
              : activeSection === "regular"
                ? regularStats.expiringIn7.length
                : regularStats.expiringIn7.length + sponsoredStats.expiringIn7.length}
          </span>
        </button>
        <button
          className={cn(
            "px-4 py-2 text-sm font-medium border-b-2 -mb-px whitespace-nowrap",
            activeTab === "expiring30"
              ? "border-blue-500 text-blue-600"
              : "border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300",
          )}
          onClick={() => setActiveTab("expiring30")}
        >
          Expiring in 30 Days{" "}
          <span className="ml-1.5 rounded-full bg-yellow-100 px-2 py-0.5">
            {activeSection === "sponsored"
              ? sponsoredStats.expiringIn30.length
              : activeSection === "regular"
                ? regularStats.expiringIn30.length
                : regularStats.expiringIn30.length + sponsoredStats.expiringIn30.length}
          </span>
        </button>
        <button
          className={cn(
            "px-4 py-2 text-sm font-medium border-b-2 -mb-px whitespace-nowrap",
            activeTab === "expiring90"
              ? "border-blue-500 text-blue-600"
              : "border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300",
          )}
          onClick={() => setActiveTab("expiring90")}
        >
          Expiring in 90 Days{" "}
          <span className="ml-1.5 rounded-full bg-yellow-50 px-2 py-0.5">
            {activeSection === "sponsored"
              ? sponsoredStats.expiringIn90.length
              : activeSection === "regular"
                ? regularStats.expiringIn90.length
                : regularStats.expiringIn90.length + sponsoredStats.expiringIn90.length}
          </span>
        </button>
        <button
          className={cn(
            "px-4 py-2 text-sm font-medium border-b-2 -mb-px whitespace-nowrap",
            activeTab === "valid"
              ? "border-blue-500 text-blue-600"
              : "border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300",
          )}
          onClick={() => setActiveTab("valid")}
        >
          Valid{" "}
          <span className="ml-1.5 rounded-full bg-green-100 px-2 py-0.5">
            {activeSection === "sponsored"
              ? sponsoredStats.valid.length
              : activeSection === "regular"
                ? regularStats.valid.length
                : regularStats.valid.length + sponsoredStats.valid.length}
          </span>
        </button>
      </div>

      <div className="rounded-md border overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-12">
                <Checkbox
                  checked={selectedDocuments.length === filteredDocuments.length && filteredDocuments.length > 0}
                  onCheckedChange={() => toggleAllDocuments(filteredDocuments)}
                  aria-label="Select all documents"
                />
              </TableHead>
              <TableHead>
                <Button variant="ghost" onClick={() => handleSort("employeeName")} className="flex items-center">
                  EMPLOYEE
                  {renderSortIndicator("employeeName")}
                </Button>
              </TableHead>
              <TableHead>
                <Button variant="ghost" onClick={() => handleSort("branch")} className="flex items-center">
                  BRANCH
                  {renderSortIndicator("branch")}
                </Button>
              </TableHead>
              <TableHead>
                <Button variant="ghost" onClick={() => handleSort("status")} className="flex items-center">
                  STATUS
                  {renderSortIndicator("status")}
                </Button>
              </TableHead>
              <TableHead>
                <Button variant="ghost" onClick={() => handleSort("country")} className="flex items-center">
                  COUNTRY
                  {renderSortIndicator("country")}
                </Button>
              </TableHead>

              {hasAnyDates(documents, "passport") && (
                <TableHead>
                  <Button variant="ghost" onClick={() => handleSort("passportDaysLeft")} className="flex items-center">
                    PASSPORT
                    {renderSortIndicator("passportDaysLeft")}
                  </Button>
                </TableHead>
              )}

              {hasAnyDates(documents, "rightToWork") && (
                <TableHead>
                  <Button
                    variant="ghost"
                    onClick={() => handleSort("rightToWorkDaysLeft")}
                    className="flex items-center"
                  >
                    RIGHT TO WORK
                    {renderSortIndicator("rightToWorkDaysLeft")}
                  </Button>
                </TableHead>
              )}

              {hasAnyDates(documents, "brp") && (
                <TableHead>
                  <Button variant="ghost" onClick={() => handleSort("brpDaysLeft")} className="flex items-center">
                    BRP
                    {renderSortIndicator("brpDaysLeft")}
                  </Button>
                </TableHead>
              )}

              {hasAnyDates(documents, "otherDocument") && (
                <TableHead>
                  <Button
                    variant="ghost"
                    onClick={() => handleSort("otherDocumentDaysLeft")}
                    className="flex items-center"
                  >
                    OTHER DOCUMENT
                    {renderSortIndicator("otherDocumentDaysLeft")}
                  </Button>
                </TableHead>
              )}

              <TableHead>ACTIONS</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              Array.from({ length: 4 }).map((_, index) => (
                <TableRow key={index}>
                  <TableCell>
                    <Skeleton className="h-4 w-4" />
                  </TableCell>
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
                    <Skeleton className="h-6 w-20" />
                  </TableCell>
                  <TableCell>
                    <Skeleton className="h-6 w-32" />
                  </TableCell>
                  <TableCell>
                    <Skeleton className="h-6 w-32" />
                  </TableCell>
                  <TableCell>
                    <Skeleton className="h-6 w-32" />
                  </TableCell>
                  <TableCell>
                    <Skeleton className="h-6 w-32" />
                  </TableCell>
                  <TableCell>
                    <Skeleton className="h-6 w-24" />
                  </TableCell>
                </TableRow>
              ))
            ) : filteredDocuments.length > 0 ? (
              filteredDocuments.map((doc) => (
                <TableRow key={doc.id}>
                  <TableCell>
                    <Checkbox
                      checked={selectedDocuments.includes(doc.id)}
                      onCheckedChange={() => toggleDocumentSelection(doc.id)}
                      aria-label={`Select ${doc.employeeName}`}
                    />
                  </TableCell>
                  <TableCell className="font-medium">
                    <div className="flex flex-col">
                      <span>{doc.employeeName || "-"}</span>
                      <div className="flex flex-wrap gap-1 mt-1">
                        {doc.isSponsored && (
                          <Badge className="bg-purple-100 text-purple-800 hover:bg-purple-200 w-fit">Sponsored</Badge>
                        )}
                        {doc.is20Hours && (
                          <Badge className="bg-blue-100 text-blue-800 hover:bg-blue-200 w-fit">20hrs</Badge>
                        )}
                      </div>
                    </div>
                  </TableCell>
                  <TableCell>{doc.branch || "Unassigned"}</TableCell>
                  <TableCell>
                    <Badge className="bg-blue-100 text-blue-800 hover:bg-blue-200">{doc.status}</Badge>
                  </TableCell>
                  <TableCell>{doc.country}</TableCell>

                  {hasAnyDates(documents, "passport") && (
                    <TableCell>{formatExpiryDate(doc.passportExpiry, doc.passportDaysLeft)}</TableCell>
                  )}

                  {hasAnyDates(documents, "rightToWork") && (
                    <TableCell>{formatExpiryDate(doc.rightToWorkExpiry, doc.rightToWorkDaysLeft)}</TableCell>
                  )}

                  {hasAnyDates(documents, "brp") && (
                    <TableCell>{formatExpiryDate(doc.brpExpiry, doc.brpDaysLeft)}</TableCell>
                  )}

                  {hasAnyDates(documents, "otherDocument") && (
                    <TableCell>
                      {doc.otherDocumentType ? (
                        <div>
                          <div className="text-sm font-medium">{doc.otherDocumentType}</div>
                          {formatExpiryDate(doc.otherDocumentExpiry, doc.otherDocumentDaysLeft)}
                        </div>
                      ) : (
                        <span className="text-gray-400">N/A</span>
                      )}
                    </TableCell>
                  )}

                  <TableCell>
                    <div className="flex space-x-2">
                      <Button variant="outline" size="sm" onClick={() => handleEditDocument(doc)}>
                        <Pencil className="h-4 w-4 mr-1" />
                        Edit
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        className="text-red-500 border-red-200 hover:bg-red-50"
                        onClick={() => handleDeleteDocument(doc)}
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
                <TableCell colSpan={10} className="h-24 text-center">
                  No documents found.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>

      <AddDocumentModal open={isAddModalOpen} onOpenChange={setIsAddModalOpen} />

      {selectedDocument && (
        <EditDocumentModal document={selectedDocument} open={isEditModalOpen} onOpenChange={setIsEditModalOpen} />
      )}

      <DeleteConfirmationDialog
        isOpen={isDeleteDialogOpen}
        onClose={() => setIsDeleteDialogOpen(false)}
        onConfirm={confirmDeleteDocument}
        title="Delete Document"
        description={`Are you sure you want to delete this document for ${selectedDocument?.employeeName}? This action cannot be undone.`}
        confirmLabel="Delete"
        cancelLabel="Cancel"
      />

      <ImportDocumentsModal open={isImportModalOpen} onOpenChange={setIsImportModalOpen} />
    </div>
  )
}
