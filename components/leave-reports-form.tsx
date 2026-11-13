"use client"

import { formatLocalDate } from "@/lib/dates"
import { useState } from "react"
import { Button } from "@/components/ui/button"
import { DatePicker } from "@/components/ui/date-picker"
import { PageHeader } from "./page-kit"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { FileBarChart, FileSpreadsheet, FileText, Loader2 } from "lucide-react"
import { format } from "date-fns"
import { cn } from "@/lib/utils"
import { useToast } from "@/components/ui/use-toast"
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"
import { Label } from "@/components/ui/label"
import { useBranches } from "@/hooks/use-branches"
import { useLeaveTypes } from "@/hooks/use-leave-types"

export function LeaveReportsForm() {
  const [startDate, setStartDate] = useState<Date | undefined>()
  const [endDate, setEndDate] = useState<Date | undefined>()
  const [selectedBranch, setSelectedBranch] = useState<string>("all")
  const [selectedLeaveType, setSelectedLeaveType] = useState<string>("all")
  const [dateFilterMode, setDateFilterMode] = useState<string>("overlap")
  const [isExporting, setIsExporting] = useState(false)
  const { toast } = useToast()

  const { data: branches = [] } = useBranches()
  const { data: leaveTypes = [], isLoading: isLoadingLeaveTypes } = useLeaveTypes()

  const handleExport = async (exportFormat: string) => {
    if (!startDate || !endDate) {
      toast({
        title: "Date Range Required",
        description: "Please select both start and end dates for the report.",
        variant: "destructive",
      })
      return
    }

    setIsExporting(true)

    try {
      const formData = new FormData()
      formData.append("format", exportFormat)
      formData.append("branch", selectedBranch)
      formData.append("type", selectedLeaveType)
      formData.append("startDate", format(startDate, "yyyy-MM-dd"))
      formData.append("endDate", format(endDate, "yyyy-MM-dd"))
      formData.append("dateFilterMode", dateFilterMode)

      const response = await fetch("/api/export/leave-requests", {
        method: "POST",
        body: formData,
      })

      if (!response.ok) {
        throw new Error("Export failed")
      }

      let filename = `leave-report-${format(startDate, "yyyy-MM-dd")}-to-${format(endDate, "yyyy-MM-dd")}.${exportFormat === "csv" ? "csv" : "xls"}`
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
        description: `Your ${exportFormat.toUpperCase()} file has been downloaded.`,
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

  const matchOptions = [
    { value: "overlap", title: "Overlapping", text: "Any leave that touches the period" },
    { value: "restrictive", title: "Within period", text: "Only leave fully inside the dates" },
  ]
  const ready = !!startDate && !!endDate

  return (
    <div className="space-y-6 sm:space-y-8">
      <PageHeader title="Reports" description="Export leave for a date range as a spreadsheet." />

      <div className="grid gap-4 sm:gap-6 lg:grid-cols-[1fr_340px] lg:items-start">
        <div className="surface divide-y divide-border/70 overflow-hidden">
          <section className="space-y-4 p-5 sm:p-6">
            <div>
              <h2 className="text-[17px] font-semibold">Date range</h2>
              <p className="text-sm text-muted-foreground">Choose the period the report covers.</p>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="report-start">From</Label>
                <DatePicker id="report-start" value={startDate} onChange={setStartDate} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="report-end">To</Label>
                <DatePicker id="report-end" value={endDate} onChange={setEndDate} min={startDate} />
              </div>
            </div>
            <RadioGroup
              value={dateFilterMode}
              onValueChange={setDateFilterMode}
              className="grid gap-2.5 sm:grid-cols-2"
              aria-label="Which leave to include"
            >
              {matchOptions.map((option) => (
                <Label
                  key={option.value}
                  htmlFor={option.value}
                  className={cn(
                    "flex cursor-pointer items-start gap-3 rounded-xl border border-border bg-card p-3.5 transition-colors hover:border-foreground/20",
                    dateFilterMode === option.value && "border-primary/50 bg-primary-soft/50 ring-1 ring-primary/30",
                  )}
                >
                  <RadioGroupItem value={option.value} id={option.value} className="mt-0.5" />
                  <span className="space-y-0.5">
                    <span className="block text-sm font-semibold">{option.title}</span>
                    <span className="block text-xs font-normal text-muted-foreground">{option.text}</span>
                  </span>
                </Label>
              ))}
            </RadioGroup>
          </section>

          <section className="space-y-4 p-5 sm:p-6">
            <div>
              <h2 className="text-[17px] font-semibold">Filters</h2>
              <p className="text-sm text-muted-foreground">Optional. Narrow the report to one branch or leave type.</p>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="report-branch">Branch</Label>
                <Select value={selectedBranch} onValueChange={setSelectedBranch}>
                  <SelectTrigger id="report-branch">
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
              </div>
              <div className="space-y-2">
                <Label htmlFor="report-type">Leave type</Label>
                <Select value={selectedLeaveType} onValueChange={setSelectedLeaveType} disabled={isLoadingLeaveTypes}>
                  <SelectTrigger id="report-type">
                    <SelectValue placeholder="All leave types" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All leave types</SelectItem>
                    {leaveTypes.map((leaveType) => (
                      <SelectItem key={leaveType.id} value={leaveType.name}>
                        {leaveType.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </section>
        </div>

        {/* Summary and export */}
        <aside className="surface space-y-5 p-5 sm:p-6 lg:sticky lg:top-20">
          <div className="flex items-center gap-3">
            <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary-soft text-primary">
              <FileBarChart className="h-5 w-5" />
            </span>
            <div>
              <h2 className="text-[17px] font-semibold">Leave report</h2>
              <p className="text-xs text-muted-foreground">CSV or Excel</p>
            </div>
          </div>
          <dl className="space-y-2.5 text-sm">
            {[
              ["Period", ready ? `${formatLocalDate(startDate)} – ${formatLocalDate(endDate)}` : "Not set"],
              ["Includes", dateFilterMode === "overlap" ? "Overlapping leave" : "Leave within the dates"],
              ["Branch", selectedBranch === "all" ? "All branches" : selectedBranch],
              ["Leave type", selectedLeaveType === "all" ? "All types" : selectedLeaveType],
            ].map(([label, value]) => (
              <div key={label} className="flex justify-between gap-4">
                <dt className="text-muted-foreground">{label}</dt>
                <dd className={cn("text-right font-medium", value === "Not set" && "text-muted-foreground")}>
                  {value}
                </dd>
              </div>
            ))}
          </dl>
          <div className="grid grid-cols-2 gap-2">
            <Button onClick={() => handleExport("excel")} disabled={isExporting || !ready}>
              {isExporting ? <Loader2 className="animate-spin" /> : <FileSpreadsheet />}
              Excel
            </Button>
            <Button variant="outline" onClick={() => handleExport("csv")} disabled={isExporting || !ready}>
              <FileText />
              CSV
            </Button>
          </div>
          {!ready && (
            <p className="text-center text-xs text-muted-foreground">Choose a start and end date to export.</p>
          )}
        </aside>
      </div>
    </div>
  )
}
