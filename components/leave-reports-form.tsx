"use client"

// Reports: pick a period in one click (this leave year by default), see the
// figures on screen, and export the same leave as Excel or CSV.

import { useMemo, useState } from "react"
import { useQuery } from "@tanstack/react-query"
import { FileBarChart, FileSpreadsheet, FileText, Loader2, Stethoscope } from "lucide-react"
import { format } from "date-fns"
import { Button } from "@/components/ui/button"
import { DatePicker } from "@/components/ui/date-picker"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"
import { Label } from "@/components/ui/label"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { useToast } from "@/components/ui/use-toast"
import { authHeaders, fetchWithAuth, handleApiError } from "@/lib/api-utils"
import { formatLocalDate, localDateToUtc, todayUtc, utcToLocalDate } from "@/lib/dates"
import { buildLeaveYears, type StoredPeriod } from "@/lib/leave-years"
import { reportFigures, type ReportLeave } from "@/lib/reports"
import { leaveTypeColour } from "@/lib/leave-type-colour"
import { cn } from "@/lib/utils"
import { useBranches } from "@/hooks/use-branches"
import { useLeaveTypes } from "@/hooks/use-leave-types"
import { EmptyState, ErrorState, ListSkeleton, PageHeader, StatCard, plural } from "./page-kit"
import { useApp } from "./app-provider"

type Preset = "year" | "last_year" | "month" | "last_month" | "quarter" | "custom"
const PRESETS: { id: Preset; label: string }[] = [
  { id: "year", label: "This leave year" },
  { id: "last_year", label: "Last leave year" },
  { id: "month", label: "This month" },
  { id: "last_month", label: "Last month" },
  { id: "quarter", label: "Last 3 months" },
  { id: "custom", label: "Custom" },
]

export function LeaveReportsForm() {
  const { toast } = useToast()
  const { user } = useApp()
  const isAdmin = user?.role === "admin"
  const { data: allBranches = [] } = useBranches()
  const branches = allBranches.filter((b) => isAdmin || user?.branches?.includes(b.name))
  const { data: leaveTypes = [], isLoading: isLoadingLeaveTypes } = useLeaveTypes()
  const { data: periods = [] } = useQuery<StoredPeriod[]>({
    queryKey: ["leavePeriods"],
    queryFn: () => fetchWithAuth("/api/leave-periods"),
  })

  const [preset, setPreset] = useState<Preset>("year")
  const [customFrom, setCustomFrom] = useState<Date | undefined>()
  const [customTo, setCustomTo] = useState<Date | undefined>()
  const [branch, setBranch] = useState("all")
  const [leaveType, setLeaveType] = useState("all")
  const [mode, setMode] = useState("overlap")
  const [isExporting, setIsExporting] = useState(false)

  // The period, as UTC-midnight times
  const today = todayUtc()
  const period = useMemo((): { from: number; to: number } | null => {
    const years = buildLeaveYears(periods, [], today)
    const current = years.find((y) => y.isCurrent)
    const d = new Date(today)
    const y = d.getUTCFullYear()
    const m = d.getUTCMonth()
    switch (preset) {
      case "year":
        return current ? { from: current.start, to: current.end } : null
      case "last_year": {
        const i = current ? years.indexOf(current) : -1
        const last = i >= 0 ? years[i + 1] : undefined
        return last ? { from: last.start, to: last.end } : null
      }
      case "month":
        return { from: Date.UTC(y, m, 1), to: Date.UTC(y, m + 1, 0) }
      case "last_month":
        return { from: Date.UTC(y, m - 1, 1), to: Date.UTC(y, m, 0) }
      case "quarter":
        return { from: Date.UTC(y, m - 3, 1), to: Date.UTC(y, m, 0) }
      default:
        return customFrom && customTo && customTo >= customFrom
          ? { from: localDateToUtc(customFrom), to: localDateToUtc(customTo) }
          : null
    }
  }, [preset, customFrom, customTo, periods, today])

  const {
    data: leaves = [],
    isLoading,
    isError,
    error,
    refetch,
  } = useQuery<ReportLeave[]>({
    queryKey: ["leaveRequests", "report"],
    queryFn: () => fetchWithAuth("/api/leave-requests"),
  })
  const scoped = useMemo(
    () =>
      leaves.filter((l) => (branch === "all" || l.branch === branch) && (leaveType === "all" || l.type === leaveType)),
    [leaves, branch, leaveType],
  )
  const figures = useMemo(() => (period ? reportFigures(scoped, period) : null), [scoped, period])
  const maxMonth = Math.max(1, ...(figures?.months.map((x) => x.days) ?? [1]))

  const handleExport = async (exportFormat: "excel" | "csv") => {
    if (!period) return
    setIsExporting(true)
    try {
      const formData = new FormData()
      formData.append("format", exportFormat)
      formData.append("branch", branch)
      formData.append("type", leaveType)
      formData.append("startDate", format(utcToLocalDate(period.from), "yyyy-MM-dd"))
      formData.append("endDate", format(utcToLocalDate(period.to), "yyyy-MM-dd"))
      formData.append("dateFilterMode", mode)
      const response = await fetch("/api/export/leave-requests", {
        headers: await authHeaders(),
        method: "POST",
        body: formData,
      })
      if (!response.ok) throw new Error(`Export failed with status ${response.status}`)
      let filename = `leave-report.${exportFormat === "csv" ? "csv" : "xlsx"}`
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
        description: `Your ${exportFormat === "csv" ? "CSV" : "Excel"} file has been downloaded.`,
      })
    } catch (err) {
      console.error("Export error:", err)
      toast({ title: "Export failed", description: "Please try again in a moment.", variant: "destructive" })
    } finally {
      setIsExporting(false)
    }
  }

  const periodText = period
    ? `${formatLocalDate(utcToLocalDate(period.from))} – ${formatLocalDate(utcToLocalDate(period.to))}`
    : "Choose dates"

  return (
    <div className="space-y-6 sm:space-y-8">
      <PageHeader title="Reports" description="Leave for any period, on screen and as a spreadsheet." />

      <div className="grid gap-4 sm:gap-6 lg:grid-cols-[minmax(0,1fr)_320px] lg:items-start">
        {/* Period and filters */}
        <div className="surface space-y-5 p-5 sm:p-6">
          <div className="space-y-2.5">
            <h2 className="text-[17px] font-semibold">Period</h2>
            <div role="group" aria-label="Period" className="flex flex-wrap gap-1.5">
              {PRESETS.map((p) => (
                <button
                  key={p.id}
                  onClick={() => setPreset(p.id)}
                  aria-pressed={preset === p.id}
                  className={cn(
                    "h-9 rounded-full border px-3.5 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-ring/30",
                    preset === p.id
                      ? "border-primary bg-primary text-primary-foreground"
                      : "border-border bg-card text-foreground/80 hover:border-foreground/25",
                  )}
                >
                  {p.label}
                </button>
              ))}
            </div>
            {preset === "custom" ? (
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <Label htmlFor="report-start">From</Label>
                  <DatePicker id="report-start" value={customFrom} onChange={setCustomFrom} />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="report-end">To</Label>
                  <DatePicker id="report-end" value={customTo} onChange={setCustomTo} min={customFrom} />
                </div>
              </div>
            ) : (
              <p className="text-sm text-muted-foreground tabular">{periodText}</p>
            )}
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="report-branch">Branch</Label>
              <Select value={branch} onValueChange={setBranch}>
                <SelectTrigger id="report-branch">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">{isAdmin ? "All branches" : "All my branches"}</SelectItem>
                  {branches.map((b) => (
                    <SelectItem key={b.id} value={b.name}>
                      {b.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="report-type">Leave type</Label>
              <Select value={leaveType} onValueChange={setLeaveType} disabled={isLoadingLeaveTypes}>
                <SelectTrigger id="report-type">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All leave types</SelectItem>
                  {leaveTypes.map((t) => (
                    <SelectItem key={t.id} value={t.name}>
                      {t.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </div>

        {/* Export */}
        <aside className="surface space-y-4 p-5 sm:p-6 lg:sticky lg:top-20">
          <div className="flex items-center gap-3">
            <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-secondary text-foreground/70">
              <FileBarChart className="h-5 w-5" />
            </span>
            <div>
              <h2 className="text-[17px] font-semibold">Export</h2>
              <p className="text-xs text-muted-foreground tabular">{periodText}</p>
            </div>
          </div>
          <RadioGroup value={mode} onValueChange={setMode} className="space-y-1.5" aria-label="Which leave to include">
            {[
              { value: "overlap", title: "Overlapping", text: "Any leave that touches the period" },
              { value: "restrictive", title: "Within the period", text: "Only leave fully inside it" },
            ].map((o) => (
              <Label
                key={o.value}
                htmlFor={`mode-${o.value}`}
                className="flex cursor-pointer items-start gap-2.5 font-normal"
              >
                <RadioGroupItem value={o.value} id={`mode-${o.value}`} className="mt-0.5" />
                <span>
                  <span className="block text-sm font-semibold">{o.title}</span>
                  <span className="block text-xs text-muted-foreground">{o.text}</span>
                </span>
              </Label>
            ))}
          </RadioGroup>
          <div className="grid grid-cols-2 gap-2">
            <Button onClick={() => handleExport("excel")} disabled={isExporting || !period}>
              {isExporting ? <Loader2 className="animate-spin" /> : <FileSpreadsheet />}
              Excel
            </Button>
            <Button variant="outline" onClick={() => handleExport("csv")} disabled={isExporting || !period}>
              <FileText />
              CSV
            </Button>
          </div>
          {!period && <p className="text-center text-xs text-muted-foreground">Choose both dates to export.</p>}
        </aside>
      </div>

      {/* On screen */}
      {isError ? (
        <ErrorState title="Couldn't load leave" message={handleApiError(error)} onRetry={() => refetch()} />
      ) : isLoading ? (
        <div className="surface">
          <ListSkeleton rows={4} />
        </div>
      ) : !figures ? null : figures.entries === 0 ? (
        <div className="surface">
          <EmptyState
            icon={FileBarChart}
            title="No approved leave in this period"
            description="Try another period or filter."
          />
        </div>
      ) : (
        <div className="space-y-4 sm:space-y-6">
          <section aria-label="Totals" className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            <StatCard label="Days of leave" value={figures.days} detail={plural(figures.entries, "entry", "entries")} />
            <StatCard label="People" value={figures.people} detail="Took leave in the period" />
            <StatCard label="Annual leave" value={figures.annualDays} detail="Days, incl. working holiday" />
            <StatCard label="Sickness" value={figures.sickDays} detail="Days off sick" />
          </section>

          <div className="grid gap-4 sm:gap-6 lg:grid-cols-[minmax(0,3fr)_minmax(0,2fr)] lg:items-start [&>*]:min-w-0">
            <section className="surface overflow-hidden">
              <div className="p-5 pb-3 sm:p-6 sm:pb-3">
                <h2 className="text-[17px] font-semibold">By branch</h2>
                <p className="text-sm text-muted-foreground">Days of approved leave, by type</p>
              </div>
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow className="hover:bg-transparent">
                      <TableHead>Branch</TableHead>
                      {figures.types.map((t) => (
                        <TableHead key={t} className="text-right">
                          <span className="inline-flex items-center gap-1.5">
                            <span
                              className="h-2 w-2 rounded-full"
                              style={{ backgroundColor: leaveTypeColour(t) }}
                              aria-hidden
                            />
                            {t.replace(/ Leave$/, "")}
                          </span>
                        </TableHead>
                      ))}
                      <TableHead className="text-right">Total</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {figures.byBranch.map((b) => (
                      <TableRow key={b.branch}>
                        <TableCell>
                          <p className="font-semibold">{b.branch}</p>
                          <p className="text-xs text-muted-foreground">{plural(b.people, "person", "people")}</p>
                        </TableCell>
                        {figures.types.map((t) => (
                          <TableCell key={t} className="text-right tabular">
                            {b.byType[t] ?? <span className="text-muted-foreground/60">0</span>}
                          </TableCell>
                        ))}
                        <TableCell className="text-right font-semibold tabular">{b.days}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </section>

            <section className="surface p-5 sm:p-6">
              <h2 className="text-[17px] font-semibold">By month</h2>
              <p className="mb-4 text-sm text-muted-foreground">Days of approved leave</p>
              <ul className="space-y-2" aria-label="Days of leave by month">
                {figures.months.map((m) => (
                  <li key={m.key} className="grid grid-cols-[56px_minmax(0,1fr)_40px] items-center gap-2 text-sm">
                    <span className="text-muted-foreground">{m.label}</span>
                    <span className="h-2.5 overflow-hidden rounded-full bg-muted">
                      <span
                        className="block h-full rounded-full bg-primary/70"
                        style={{ width: `${(m.days / maxMonth) * 100}%` }}
                      />
                    </span>
                    <span className="text-right font-semibold tabular">{m.days}</span>
                  </li>
                ))}
              </ul>
            </section>
          </div>

          {figures.sickness.length > 0 && (
            <section className="surface overflow-hidden">
              <div className="flex items-start gap-3 p-5 pb-3 sm:p-6 sm:pb-3">
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-secondary text-foreground/70">
                  <Stethoscope className="h-4 w-4" />
                </span>
                <div>
                  <h2 className="text-[17px] font-semibold">Sickness (Bradford Factor)</h2>
                  <p className="text-sm text-muted-foreground">
                    Spells × spells × days. Many short absences score higher than one long one, so it helps spot
                    patterns worth a conversation. Highest first.
                  </p>
                </div>
              </div>
              <Table>
                <TableHeader>
                  <TableRow className="hover:bg-transparent">
                    <TableHead>Employee</TableHead>
                    <TableHead className="text-right">Spells</TableHead>
                    <TableHead className="text-right">Days</TableHead>
                    <TableHead className="text-right">Score</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {figures.sickness.slice(0, 10).map((s) => (
                    <TableRow key={`${s.name}-${s.branch}`}>
                      <TableCell>
                        <p className="font-semibold">{s.name}</p>
                        <p className="text-xs text-muted-foreground">{s.branch}</p>
                      </TableCell>
                      <TableCell className="text-right tabular">{s.spells}</TableCell>
                      <TableCell className="text-right tabular">{s.days}</TableCell>
                      <TableCell className="text-right font-semibold tabular">{s.bradford}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
              {figures.sickness.length > 10 && (
                <p className="border-t border-border/70 px-5 py-2.5 text-xs text-muted-foreground sm:px-6">
                  And {plural(figures.sickness.length - 10, "more person", "more people")}. Export for the full list.
                </p>
              )}
            </section>
          )}
        </div>
      )}
    </div>
  )
}
