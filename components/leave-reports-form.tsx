"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { Calendar } from "@/components/ui/calendar"
import { CalendarIcon, Download, FileSpreadsheet, FileText, HelpCircle } from "lucide-react"
import { format } from "date-fns"
import { cn } from "@/lib/utils"
import { useToast } from "@/components/ui/use-toast"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"
import { Label } from "@/components/ui/label"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip"
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
        title: "Export Successful",
        description: `Your ${exportFormat.toUpperCase()} file has been downloaded.`,
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

  return (
    <Card>
      <CardHeader>
        <CardTitle>Report Filters</CardTitle>
        <p className="text-sm text-muted-foreground">Select filters for your report</p>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="grid gap-6 md:grid-cols-2">
          <div className="space-y-2">
            <label className="text-sm font-medium">Start Date</label>
            <Popover>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  className={cn("w-full justify-start text-left font-normal", !startDate && "text-muted-foreground")}
                >
                  <CalendarIcon className="mr-2 h-4 w-4" />
                  {startDate ? format(startDate, "PPP") : "Pick a date"}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0">
                <Calendar mode="single" selected={startDate} onSelect={setStartDate} initialFocus />
              </PopoverContent>
            </Popover>
          </div>
          <div className="space-y-2">
            <label className="text-sm font-medium">End Date</label>
            <Popover>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  className={cn("w-full justify-start text-left font-normal", !endDate && "text-muted-foreground")}
                >
                  <CalendarIcon className="mr-2 h-4 w-4" />
                  {endDate ? format(endDate, "PPP") : "Pick a date"}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0">
                <Calendar
                  mode="single"
                  selected={endDate}
                  onSelect={setEndDate}
                  initialFocus
                  disabled={(date) => (startDate ? date < startDate : false)}
                />
              </PopoverContent>
            </Popover>
          </div>
        </div>

        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <label className="text-sm font-medium">Date Filter Mode</label>
            <TooltipProvider delayDuration={0}>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button variant="ghost" size="icon" className="h-5 w-5 rounded-full p-0">
                    <HelpCircle className="h-4 w-4" />
                    <span className="sr-only">Date filter mode help</span>
                  </Button>
                </TooltipTrigger>
                <TooltipContent side="right" align="start" className="max-w-xs">
                  <div className="space-y-2 text-sm">
                    <p>
                      <strong>Overlapping:</strong> Includes leaves that overlap with the selected period (e.g., a leave
                      from 01/04 to 20/04 will be included when filtering for 03/04 to 30/04).
                    </p>
                    <p>
                      <strong>Restrictive:</strong> Only includes leaves that fall completely within the selected
                      period.
                    </p>
                  </div>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          </div>
          <RadioGroup
            defaultValue="overlap"
            value={dateFilterMode}
            onValueChange={setDateFilterMode}
            className="flex space-x-4"
          >
            <div className="flex items-center space-x-2">
              <RadioGroupItem value="overlap" id="overlap" />
              <Label htmlFor="overlap">Overlapping</Label>
            </div>
            <div className="flex items-center space-x-2">
              <RadioGroupItem value="restrictive" id="restrictive" />
              <Label htmlFor="restrictive">Restrictive</Label>
            </div>
          </RadioGroup>
        </div>

        <div className="space-y-2">
          <label className="text-sm font-medium">Branch</label>
          <Select value={selectedBranch} onValueChange={setSelectedBranch}>
            <SelectTrigger>
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

        <div className="space-y-2">
          <label className="text-sm font-medium">Leave Type</label>
          <Select value={selectedLeaveType} onValueChange={setSelectedLeaveType} disabled={isLoadingLeaveTypes}>
            <SelectTrigger>
              <SelectValue placeholder="All Leave Types" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Leave Types</SelectItem>
              {leaveTypes.map((leaveType) => (
                <SelectItem key={leaveType.id} value={leaveType.name}>
                  {leaveType.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-2">
          <label className="text-sm font-medium">Export Format</label>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                className="w-full gap-2 bg-gradient-to-r from-purple-600 to-blue-500 hover:from-purple-700 hover:to-blue-600"
                disabled={isExporting || !startDate || !endDate}
              >
                <Download className="h-4 w-4" />
                Export Report
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={() => handleExport("csv")} disabled={isExporting}>
                <FileText className="h-4 w-4 mr-2" />
                Export as CSV
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => handleExport("excel")} disabled={isExporting}>
                <FileSpreadsheet className="h-4 w-4 mr-2" />
                Export as Excel
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </CardContent>
    </Card>
  )
}
