"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Download, FileText, FileSpreadsheet, Loader2 } from "lucide-react"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"
import { useToast } from "@/components/ui/use-toast"

interface ExportButtonProps {
  endpoint: string
  filename?: string
  disabled?: boolean
  filters?: Record<string, string>
  sortColumn?: string
  sortOrder?: string
  className?: string
  variant?: "default" | "destructive" | "outline" | "secondary" | "ghost" | "link"
  onExportStart?: () => void
  onExportEnd?: () => void
}

export function ExportButton({
  endpoint,
  disabled = false,
  filters = {},
  sortColumn,
  sortOrder,
  className,
  variant = "outline",
  onExportStart,
  onExportEnd,
}: ExportButtonProps) {
  const [isExporting, setIsExporting] = useState(false)
  const { toast } = useToast()

  const handleExport = async (format: "csv" | "excel") => {
    setIsExporting(true)
    if (onExportStart) onExportStart()

    try {
      // Create form data with current filters
      const formData = new FormData()
      formData.append("format", format)

      // Add all filters to the form data
      Object.entries(filters).forEach(([key, value]) => {
        if (value) {
          formData.append(key, value)
        }
      })

      // Add sorting parameters if provided
      if (sortColumn) {
        formData.append("sortColumn", sortColumn)
      }

      if (sortOrder) {
        formData.append("sortOrder", sortOrder)
      }

      // Use fetch directly to download the file
      const response = await fetch(`/api/export/${endpoint}`, {
        method: "POST",
        body: formData,
      })

      if (!response.ok) {
        throw new Error(`Export failed: ${response.statusText}`)
      }

      // Get the filename from the Content-Disposition header if available
      let filename = `${endpoint}-export.${format === "csv" ? "csv" : "xls"}`
      const contentDisposition = response.headers.get("Content-Disposition")
      if (contentDisposition) {
        const filenameMatch = contentDisposition.match(/filename="(.+)"/)
        if (filenameMatch && filenameMatch[1]) {
          filename = filenameMatch[1]
        }
      }

      // Create a blob from the response
      const blob = await response.blob()

      // Create a download link and trigger the download
      const url = window.URL.createObjectURL(blob)
      const a = document.createElement("a")
      a.style.display = "none"
      a.href = url
      a.download = filename
      document.body.appendChild(a)
      a.click()

      // Clean up
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
      if (onExportEnd) onExportEnd()
    }
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant={variant} size="sm" className={`gap-1 ${className}`} disabled={disabled || isExporting}>
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
        <DropdownMenuItem onClick={() => handleExport("csv")}>
          <FileText className="h-4 w-4 mr-2" />
          Export as CSV
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => handleExport("excel")}>
          <FileSpreadsheet className="h-4 w-4 mr-2" />
          Export as Excel
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
