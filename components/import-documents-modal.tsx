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
import {
  Download,
  Upload,
  FileSpreadsheet,
  FileText,
  X,
  AlertCircle,
  CheckCircle,
  ArrowLeft,
  Loader2,
} from "lucide-react"
import { Progress } from "@/components/ui/progress"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"
import { Switch } from "@/components/ui/switch"
import { Label } from "@/components/ui/label"

interface ImportDocumentsModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
}

type PreviewDocument = {
  employeeId: string | null
  employeeName: string
  employeeCode: string
  branch: string
  status: string
  country: string
  passportExpiry: string | null
  passportDaysLeft: number | null
  brpExpiry: string | null
  brpDaysLeft: number | null
  rightToWorkExpiry: string | null
  rightToWorkDaysLeft: number | null
  otherDocumentType: string | null
  otherDocumentExpiry: string | null
  otherDocumentDaysLeft: number | null
  notes: string
  isSponsored: boolean
  is20Hrs: boolean
  isValid: boolean
  validationMessage: string | null
}

export function ImportDocumentsModal({ open, onOpenChange }: ImportDocumentsModalProps) {
  const [isUploading, setIsUploading] = useState(false)
  const [uploadProgress, setUploadProgress] = useState(0)
  const [dragActive, setDragActive] = useState(false)
  const [selectedFile, setSelectedFile] = useState<File | null>(null)
  const [importResults, setImportResults] = useState<{
    imported: number
    updated: number
    failed: number
    skipped: number
    errors?: { row: number; message: string }[]
  } | null>(null)
  const [previewData, setPreviewData] = useState<PreviewDocument[]>([])
  const [showPreview, setShowPreview] = useState(false)
  const [previewLoading, setPreviewLoading] = useState(false)
  const [skipInvalid, setSkipInvalid] = useState(true)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const { toast } = useToast()
  const queryClient = useQueryClient()

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

      // Get preview data
      const response = await fetch("/api/import/documents/preview", {
        method: "POST",
        body: formData,
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || "Failed to preview documents")
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
      formData.append("skipInvalid", skipInvalid.toString())

      // Simulate progress updates
      const progressInterval = setInterval(() => {
        setUploadProgress((prev) => {
          const newProgress = prev + Math.random() * 15
          return newProgress > 90 ? 90 : newProgress
        })
      }, 200)

      // Upload file
      const response = await fetch("/api/import/documents", {
        method: "POST",
        body: formData,
      })

      clearInterval(progressInterval)
      setUploadProgress(100)

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || "Failed to import documents")
      }

      const result = await response.json()

      setImportResults({
        imported: result.imported,
        updated: result.updated,
        failed: result.failed,
        skipped: result.skipped,
        errors: result.errors,
      })

      // Refresh documents list
      queryClient.invalidateQueries({ queryKey: ["documents"] })

      toast({
        title: "Import successful",
        description: `Successfully imported ${result.imported} documents (${result.updated} updated)`,
      })
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
      const response = await fetch(`/api/templates/document-import?format=${format}`)

      if (!response.ok) {
        throw new Error("Failed to download template")
      }

      // Get filename from Content-Disposition header if available
      let filename = `document-import-template.${format === "csv" ? "csv" : "xlsx"}`
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

  // Function to determine document status color
  const getStatusColor = (daysLeft: number | null) => {
    if (!daysLeft && daysLeft !== 0) return "text-muted-foreground/60"
    if (daysLeft <= 0) return "text-destructive"
    if (daysLeft <= 7) return "text-destructive"
    if (daysLeft <= 30) return "text-warning"
    if (daysLeft <= 90) return "text-primary"
    return "text-success"
  }

  return (
    <Dialog open={open} onOpenChange={handleCloseModal}>
      <DialogContent className={showPreview ? "sm:max-w-[900px]" : "sm:max-w-[550px]"}>
        <DialogHeader>
          <DialogTitle>Import documents</DialogTitle>
          <DialogDescription>
            {showPreview
              ? "Review the data before importing. Click 'Import documents' to confirm."
              : "Upload a CSV or Excel file to import documents. Download a template to get started."}
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
                Showing preview of {previewData.length} documents from {selectedFile?.name}
              </div>
            </div>

            <div className="flex items-center space-x-2 mb-4">
              <Switch id="skip-invalid" checked={skipInvalid} onCheckedChange={setSkipInvalid} />
              <Label htmlFor="skip-invalid">Skip invalid records during import</Label>
            </div>

            {/* Invalid Records Section - Show only if there are invalid records */}
            {previewData.filter((doc) => !doc.isValid).length > 0 && (
              <div className="mb-4">
                <div className="mb-2 rounded-xl border border-destructive/20 bg-destructive-soft p-3">
                  <h3 className="flex items-center text-sm font-semibold text-destructive">
                    <AlertCircle className="h-4 w-4 mr-2" />
                    Invalid Records ({previewData.filter((doc) => !doc.isValid).length})
                    {skipInvalid && " - These records will be skipped during import"}
                  </h3>
                </div>

                <div className="overflow-hidden rounded-xl border border-destructive/20">
                  <div className="max-h-[200px] overflow-auto">
                    <Table>
                      <TableHeader className="bg-destructive-soft">
                        <TableRow>
                          <TableHead>Employee</TableHead>
                          <TableHead>Branch</TableHead>
                          <TableHead>Issue</TableHead>
                          <TableHead>Document Status</TableHead>
                          <TableHead>Country</TableHead>
                          <TableHead>Passport Expiry</TableHead>
                          <TableHead>Right to work</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {previewData
                          .filter((doc) => !doc.isValid)
                          .map((doc, index) => (
                            <TableRow key={`invalid-${index}`} className="bg-destructive-soft/40">
                              <TableCell>
                                <div>
                                  <div className="font-medium">{doc.employeeName}</div>
                                  <div className="text-xs text-muted-foreground">{doc.employeeCode}</div>
                                </div>
                              </TableCell>
                              <TableCell>{doc.branch}</TableCell>
                              <TableCell className="font-medium text-destructive">{doc.validationMessage}</TableCell>
                              <TableCell>
                                <Badge variant="secondary">{doc.status}</Badge>
                              </TableCell>
                              <TableCell>{doc.country}</TableCell>
                              <TableCell>
                                {doc.passportExpiry ? (
                                  <div className={getStatusColor(doc.passportDaysLeft)}>
                                    {doc.passportExpiry}
                                    {doc.passportDaysLeft !== null && (
                                      <div className="text-xs">{doc.passportDaysLeft} days left</div>
                                    )}
                                  </div>
                                ) : (
                                  <span className="text-muted-foreground/50">—</span>
                                )}
                              </TableCell>
                              <TableCell>
                                {doc.rightToWorkExpiry ? (
                                  <div className={getStatusColor(doc.rightToWorkDaysLeft)}>
                                    {doc.rightToWorkExpiry}
                                    {doc.rightToWorkDaysLeft !== null && (
                                      <div className="text-xs">{doc.rightToWorkDaysLeft} days left</div>
                                    )}
                                  </div>
                                ) : (
                                  <span className="text-muted-foreground/50">—</span>
                                )}
                              </TableCell>
                            </TableRow>
                          ))}
                      </TableBody>
                    </Table>
                  </div>
                </div>
              </div>
            )}

            {/* Valid Records Section */}
            <div>
              <div className="mb-2 rounded-xl border border-success/20 bg-success-soft p-3">
                <h3 className="flex items-center text-sm font-semibold text-success">
                  <CheckCircle className="h-4 w-4 mr-2" />
                  Valid Records ({previewData.filter((doc) => doc.isValid).length})
                  {previewData.filter((doc) => doc.isValid).length === 0 && " - No valid records found"}
                </h3>
              </div>

              <div className="border rounded-md overflow-hidden">
                <div className="max-h-[300px] overflow-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Employee</TableHead>
                        <TableHead>Branch</TableHead>
                        <TableHead>Document Status</TableHead>
                        <TableHead>Country</TableHead>
                        <TableHead>Passport Expiry</TableHead>
                        <TableHead>BRP Expiry</TableHead>
                        <TableHead>Right to work</TableHead>
                        <TableHead>Sponsored</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {previewData.filter((doc) => doc.isValid).length > 0 ? (
                        previewData
                          .filter((doc) => doc.isValid)
                          .map((doc, index) => (
                            <TableRow key={`valid-${index}`}>
                              <TableCell>
                                <div>
                                  <div className="font-medium">{doc.employeeName}</div>
                                  <div className="text-xs text-muted-foreground">{doc.employeeCode}</div>
                                </div>
                              </TableCell>
                              <TableCell>{doc.branch}</TableCell>
                              <TableCell>
                                <Badge variant="secondary">{doc.status}</Badge>
                              </TableCell>
                              <TableCell>{doc.country}</TableCell>
                              <TableCell>
                                {doc.passportExpiry ? (
                                  <div className={getStatusColor(doc.passportDaysLeft)}>
                                    {doc.passportExpiry}
                                    {doc.passportDaysLeft !== null && (
                                      <div className="text-xs">{doc.passportDaysLeft} days left</div>
                                    )}
                                  </div>
                                ) : (
                                  <span className="text-muted-foreground/50">—</span>
                                )}
                              </TableCell>
                              <TableCell>
                                {doc.brpExpiry ? (
                                  <div className={getStatusColor(doc.brpDaysLeft)}>
                                    {doc.brpExpiry}
                                    {doc.brpDaysLeft !== null && (
                                      <div className="text-xs">{doc.brpDaysLeft} days left</div>
                                    )}
                                  </div>
                                ) : (
                                  <span className="text-muted-foreground/50">—</span>
                                )}
                              </TableCell>
                              <TableCell>
                                {doc.rightToWorkExpiry ? (
                                  <div className={getStatusColor(doc.rightToWorkDaysLeft)}>
                                    {doc.rightToWorkExpiry}
                                    {doc.rightToWorkDaysLeft !== null && (
                                      <div className="text-xs">{doc.rightToWorkDaysLeft} days left</div>
                                    )}
                                  </div>
                                ) : (
                                  <span className="text-muted-foreground/50">—</span>
                                )}
                              </TableCell>
                              <TableCell>
                                <div className="flex flex-col gap-1">
                                  <Badge
                                    className={
                                      doc.isSponsored ? "bg-primary-soft text-primary" : "bg-secondary text-muted-foreground"
                                    }
                                  >
                                    {doc.isSponsored ? "Sponsored" : "Not sponsored"}
                                  </Badge>
                                  {doc.isSponsored && (
                                    <Badge
                                      className={
                                        doc.is20Hrs ? "bg-primary-soft text-primary" : "bg-secondary text-muted-foreground"
                                      }
                                    >
                                      {doc.is20Hrs ? "20hrs" : "No Restriction"}
                                    </Badge>
                                  )}
                                </div>
                              </TableCell>
                            </TableRow>
                          ))
                      ) : (
                        <TableRow>
                          <TableCell colSpan={8} className="text-center py-4">
                            No valid records found in the file
                          </TableCell>
                        </TableRow>
                      )}
                    </TableBody>
                  </Table>
                </div>
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
                <Alert variant="success">
                  <CheckCircle className="h-4 w-4" />
                  <AlertTitle>Import completed</AlertTitle>
                  <AlertDescription>
                    Successfully imported {importResults.imported} documents ({importResults.updated} updated).
                    {importResults.skipped > 0 && ` Skipped ${importResults.skipped} invalid records.`}
                    {importResults.failed > 0 && ` Failed to import ${importResults.failed} records.`}
                  </AlertDescription>
                </Alert>

                {importResults.errors && importResults.errors.length > 0 && (
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
                    Download template
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem onClick={() => handleDownloadTemplate("csv")}>
                    <FileText />
                    CSV Template
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => handleDownloadTemplate("excel")}>
                    <FileSpreadsheet />
                    Excel Template
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>

            {/* File upload area */}
            <div
              className={`rounded-xl border-2 border-dashed p-8 text-center transition-colors duration-200 ${
                dragActive ? "border-primary bg-primary-soft/60" : "border-border bg-muted/30 hover:border-foreground/20"
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
                  <span className="flex h-12 w-12 items-center justify-center rounded-xl bg-success-soft text-success"><FileSpreadsheet className="h-6 w-6" /></span>
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
                  <span className="flex h-12 w-12 items-center justify-center rounded-xl bg-card text-muted-foreground shadow-card"><Upload className="h-5 w-5" /></span>
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
              <p className="font-medium mb-1">Required columns:</p>
              <ul className="list-disc list-inside space-y-1">
                <li>Employee Name or Employee Code (for matching)</li>
                <li>Status (BRITISH, EU, NON-EU)</li>
                <li>Country</li>
                <li>At least one document expiry date</li>
                <li>is_sponsored and is_20_hrs (yes/no values)</li>
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
            >
              {isUploading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Importing...
                </>
              ) : (
                "Import documents"
              )}
            </Button>
          ) : (
            <Button
              onClick={handlePreview}
              disabled={!selectedFile || previewLoading}
            >
              {previewLoading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Generating Preview...
                </>
              ) : (
                "Preview data"
              )}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
