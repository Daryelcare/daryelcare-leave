"use client"

import type React from "react"

import { useState, useRef } from "react"
import { useQueryClient } from "@tanstack/react-query"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { useToast } from "@/components/ui/use-toast"
import { handleApiError } from "@/lib/api-utils"
import { Download, Upload, FileSpreadsheet, FileText, X, AlertCircle, CheckCircle, ArrowLeft } from "lucide-react"
import { Progress } from "@/components/ui/progress"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"
import { useBranches } from "@/hooks/use-branches"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"

interface ImportEmployeesModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
}

type PreviewData = {
  name: string
  employeeCode: string
  jobTitle: string
  branch: string
  daysTaken: number
  daysRemaining: number
}

export function ImportEmployeesModal({ open, onOpenChange }: ImportEmployeesModalProps) {
  const [isUploading, setIsUploading] = useState(false)
  const [uploadProgress, setUploadProgress] = useState(0)
  const [dragActive, setDragActive] = useState(false)
  const [selectedFile, setSelectedFile] = useState<File | null>(null)
  const [importResults, setImportResults] = useState<{
    success: number
    errors: { row: number; message: string }[]
  } | null>(null)
  const [previewData, setPreviewData] = useState<PreviewData[]>([])
  const [showPreview, setShowPreview] = useState(false)
  const [previewLoading, setPreviewLoading] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const { toast } = useToast()
  const queryClient = useQueryClient()
  const { data: branches = [] } = useBranches()

  // Handle file selection
  const handleFileSelect = (files: FileList | null) => {
    if (!files || files.length === 0) return

    const file = files[0]
    // Check file type
    const validTypes = [
      "text/csv",
      "application/vnd.ms-excel",
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "application/csv",
      "application/x-csv",
      "text/x-csv",
      "text/comma-separated-values",
      "application/excel",
    ]

    if (
      !validTypes.includes(file.type) &&
      !file.name.endsWith(".csv") &&
      !file.name.endsWith(".xls") &&
      !file.name.endsWith(".xlsx")
    ) {
      toast({
        title: "Invalid file type",
        description: "Please upload a CSV or Excel file",
        variant: "destructive",
      })
      return
    }

    // Check file size (limit to 5MB)
    if (file.size > 5 * 1024 * 1024) {
      toast({
        title: "File too large",
        description: "Please upload a file smaller than 5MB",
        variant: "destructive",
      })
      return
    }

    setSelectedFile(file)
    setImportResults(null)
    setShowPreview(false)
    setPreviewData([])
  }

  // Handle drag events
  const handleDrag = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault()
    e.stopPropagation()

    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true)
    } else if (e.type === "dragleave") {
      setDragActive(false)
    }
  }

  // Handle drop event
  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault()
    e.stopPropagation()
    setDragActive(false)

    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      handleFileSelect(e.dataTransfer.files)
    }
  }

  // Handle file input change
  const handleFileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    handleFileSelect(e.target.files)
  }

  // Handle file upload button click
  const handleFileInputClick = () => {
    fileInputRef.current?.click()
  }

  // Handle preview generation
  const handlePreview = async () => {
    if (!selectedFile) return

    setPreviewLoading(true)

    try {
      // Create form data
      const formData = new FormData()
      formData.append("file", selectedFile)
      formData.append("preview", "true")

      // Get preview data
      const response = await fetch("/api/import/employees/preview", {
        method: "POST",
        body: formData,
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || "Failed to preview employees")
      }

      const result = await response.json()
      setPreviewData(result.data || [])
      setShowPreview(true)
    } catch (error) {
      toast({
        title: "Preview failed",
        description: handleApiError(error),
        variant: "destructive",
      })
    } finally {
      setPreviewLoading(false)
    }
  }

  // Handle file upload
  const handleUpload = async () => {
    if (!selectedFile) return

    setIsUploading(true)
    setUploadProgress(0)

    try {
      // Create form data
      const formData = new FormData()
      formData.append("file", selectedFile)

      // Simulate progress updates
      const progressInterval = setInterval(() => {
        setUploadProgress((prev) => {
          const newProgress = prev + Math.random() * 15
          return newProgress > 90 ? 90 : newProgress
        })
      }, 200)

      // Upload file
      const response = await fetch("/api/import/employees", {
        method: "POST",
        body: formData,
      })

      clearInterval(progressInterval)
      setUploadProgress(100)

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || "Failed to import employees")
      }

      const result = await response.json()

      setImportResults({
        success: result.success,
        errors: result.errors || [],
      })

      // Refresh employee list
      queryClient.invalidateQueries({ queryKey: ["employees"] })

      toast({
        title: "Import successful",
        description: `Successfully imported ${result.success} employees`,
      })

      // Hide preview after successful import
      setShowPreview(false)
    } catch (error) {
      toast({
        title: "Import failed",
        description: handleApiError(error),
        variant: "destructive",
      })
    } finally {
      // Small delay to show 100% progress
      setTimeout(() => {
        setIsUploading(false)
      }, 500)
    }
  }

  // Handle template download
  const handleDownloadTemplate = async (format: "csv" | "excel") => {
    try {
      const response = await fetch(`/api/templates/employee-import?format=${format}`)

      if (!response.ok) {
        throw new Error("Failed to download template")
      }

      // Get filename from Content-Disposition header if available
      let filename = `employee-import-template.${format === "csv" ? "csv" : "xlsx"}`
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
        title: "Template downloaded",
        description: `${format.toUpperCase()} template has been downloaded.`,
      })
    } catch (error) {
      toast({
        title: "Download failed",
        description: handleApiError(error),
        variant: "destructive",
      })
    }
  }

  // Reset state when modal closes
  const handleCloseModal = () => {
    if (!isUploading) {
      setSelectedFile(null)
      setImportResults(null)
      setUploadProgress(0)
      setShowPreview(false)
      setPreviewData([])
      onOpenChange(false)
    }
  }

  // Go back from preview to file selection
  const handleBackFromPreview = () => {
    setShowPreview(false)
  }

  return (
    <Dialog open={open} onOpenChange={handleCloseModal}>
      <DialogContent className={showPreview ? "sm:max-w-[800px]" : "sm:max-w-[550px]"}>
        <DialogHeader>
          <DialogTitle>Import Employees</DialogTitle>
          <DialogDescription>
            {showPreview
              ? "Review the data before importing. Click 'Import Employees' to confirm."
              : "Upload a CSV or Excel file to import employees. Download a template to get started."}
          </DialogDescription>
        </DialogHeader>

        {showPreview ? (
          <div className="space-y-4">
            <div className="flex justify-between items-center">
              <Button variant="outline" size="sm" className="gap-2" onClick={handleBackFromPreview}>
                <ArrowLeft className="h-4 w-4" />
                Back to File Selection
              </Button>
              <div className="text-sm text-muted-foreground">
                Showing preview of {previewData.length} employees from {selectedFile?.name}
              </div>
            </div>

            <div className="border rounded-md overflow-hidden">
              <div className="max-h-[400px] overflow-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Full Name</TableHead>
                      <TableHead>Employee Code</TableHead>
                      <TableHead>Job Title</TableHead>
                      <TableHead>Branch</TableHead>
                      <TableHead>Days Taken</TableHead>
                      <TableHead>Days Remaining</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {previewData.length > 0 ? (
                      previewData.map((row, index) => (
                        <TableRow key={index}>
                          <TableCell>{row.name}</TableCell>
                          <TableCell>{row.employeeCode}</TableCell>
                          <TableCell>{row.jobTitle}</TableCell>
                          <TableCell>{row.branch}</TableCell>
                          <TableCell>{row.daysTaken}</TableCell>
                          <TableCell>{row.daysRemaining}</TableCell>
                        </TableRow>
                      ))
                    ) : (
                      <TableRow>
                        <TableCell colSpan={6} className="text-center py-4">
                          No data to preview
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </div>
            </div>

            {/* Progress bar */}
            {isUploading && (
              <div className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span>Uploading...</span>
                  <span>{Math.round(uploadProgress)}%</span>
                </div>
                <Progress value={uploadProgress} className="h-2" />
              </div>
            )}

            {/* Import results */}
            {importResults && (
              <div className="space-y-2">
                <Alert variant="default" className="bg-green-50 border-green-200 text-green-800">
                  <CheckCircle className="h-4 w-4" />
                  <AlertTitle>Import completed</AlertTitle>
                  <AlertDescription>Successfully imported {importResults.success} employees.</AlertDescription>
                </Alert>

                {importResults.errors.length > 0 && (
                  <Alert variant="destructive">
                    <AlertCircle className="h-4 w-4" />
                    <AlertTitle>Some rows could not be imported</AlertTitle>
                    <AlertDescription>
                      <div className="mt-2 max-h-32 overflow-y-auto">
                        <ul className="list-disc list-inside space-y-1">
                          {importResults.errors.map((error, index) => (
                            <li key={index}>
                              Row {error.row}: {error.message}
                            </li>
                          ))}
                        </ul>
                      </div>
                    </AlertDescription>
                  </Alert>
                )}
              </div>
            )}
          </div>
        ) : (
          <div className="space-y-4">
            {/* Template download buttons */}
            <div className="flex justify-end">
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline" size="sm" className="gap-2">
                    <Download className="h-4 w-4" />
                    Download Template
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem onClick={() => handleDownloadTemplate("csv")}>
                    <FileText className="h-4 w-4 mr-2" />
                    CSV Template
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => handleDownloadTemplate("excel")}>
                    <FileSpreadsheet className="h-4 w-4 mr-2" />
                    Excel Template
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>

            {/* File upload area */}
            <div
              className={`border-2 border-dashed rounded-lg p-6 text-center ${
                dragActive ? "border-primary bg-primary/5" : "border-border"
              }`}
              onDragEnter={handleDrag}
              onDragOver={handleDrag}
              onDragLeave={handleDrag}
              onDrop={handleDrop}
            >
              <input
                ref={fileInputRef}
                type="file"
                accept=".csv,.xls,.xlsx"
                className="hidden"
                onChange={handleFileInputChange}
              />

              {selectedFile ? (
                <div className="flex flex-col items-center gap-2">
                  <FileSpreadsheet className="h-10 w-10 text-muted-foreground" />
                  <div className="flex items-center gap-2">
                    <span className="font-medium">{selectedFile.name}</span>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-6 w-6 rounded-full"
                      onClick={() => setSelectedFile(null)}
                      disabled={isUploading || previewLoading}
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  </div>
                  <span className="text-sm text-muted-foreground">{(selectedFile.size / 1024).toFixed(2)} KB</span>
                </div>
              ) : (
                <div className="flex flex-col items-center gap-2">
                  <Upload className="h-10 w-10 text-muted-foreground" />
                  <p className="text-sm font-medium">
                    Drag and drop your file here, or{" "}
                    <button
                      type="button"
                      className="text-primary hover:underline focus:outline-none"
                      onClick={handleFileInputClick}
                    >
                      browse
                    </button>
                  </p>
                  <p className="text-xs text-muted-foreground">Supports CSV and Excel files up to 5MB</p>
                </div>
              )}
            </div>

            {/* Required columns info */}
            <div className="text-sm text-muted-foreground">
              <p className="font-medium mb-1">Column information:</p>
              <ul className="list-disc list-inside space-y-1">
                <li>Full Name (required)</li>
                <li>Employee Code (optional, will be auto-generated if empty)</li>
                <li>Job Title (optional, defaults to "Unspecified")</li>
                <li>Branch (optional, defaults to "Unassigned")</li>
                <li>Days Taken (optional, defaults to 0)</li>
                <li>Days Remaining (optional, defaults to 25)</li>
              </ul>
            </div>
          </div>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={handleCloseModal} disabled={isUploading || previewLoading}>
            Cancel
          </Button>
          {showPreview ? (
            <Button
              onClick={handleUpload}
              disabled={isUploading || previewData.length === 0}
              className="bg-gradient-to-r from-purple-600 to-blue-500 hover:from-purple-700 hover:to-blue-600"
            >
              {isUploading ? "Importing..." : "Import Employees"}
            </Button>
          ) : (
            <Button
              onClick={handlePreview}
              disabled={!selectedFile || previewLoading}
              className="bg-gradient-to-r from-purple-600 to-blue-500 hover:from-purple-700 hover:to-blue-600"
            >
              {previewLoading ? "Generating Preview..." : "Preview Data"}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
