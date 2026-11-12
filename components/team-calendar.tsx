"use client"

import { useEffect, useMemo, useState } from "react"
import { useQuery } from "@tanstack/react-query"
import { AlertTriangle, CalendarCheck, ChevronLeft, ChevronRight } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Skeleton } from "@/components/ui/skeleton"
import { useApp } from "./app-provider"
import { Avatar, EmptyState, ErrorState, PageHeader, plural } from "./page-kit"
import { useBranches } from "@/hooks/use-branches"
import { useLeaveTypes } from "@/hooks/use-leave-types"
import { fetchWithAuth, handleApiError } from "@/lib/api-utils"
import { addDays, parseDateToUtc, startOfWeek, toIsoDate, todayUtc } from "@/lib/dates"
import { cn } from "@/lib/utils"

type LeaveEntry = {
  id: string
  employeeId: string
  employeeName: string
  branch: string
  type: string
  startDate: string
  endDate: string
  start: string
  end: string
  duration: number
}

const WEEKDAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"]
const THRESHOLD_KEY = "teamCalendar.warnAt"
const DEFAULT_THRESHOLD = 3
const CHIPS_PER_DAY = 3

function readThreshold(): number {
  try {
    const value = Number(window.localStorage.getItem(THRESHOLD_KEY))
    return Number.isInteger(value) && value >= 2 ? value : DEFAULT_THRESHOLD
  } catch {
    return DEFAULT_THRESHOLD
  }
}

function monthLabel(year: number, month: number) {
  return new Date(Date.UTC(year, month, 1)).toLocaleDateString("en-GB", {
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  })
}

function dayLabel(iso: string) {
  const time = parseDateToUtc(iso) ?? 0
  return new Date(time).toLocaleDateString("en-GB", {
    weekday: "long",
    day: "numeric",
    month: "long",
    timeZone: "UTC",
  })
}

function shortDate(iso: string) {
  const time = parseDateToUtc(iso) ?? 0
  return new Date(time).toLocaleDateString("en-GB", { day: "numeric", month: "short", timeZone: "UTC" })
}

export function TeamCalendar() {
  const { user } = useApp()
  const isAdmin = user?.role === "admin"
  const myBranches = user?.branches || []
  const { data: allBranches = [] } = useBranches()
  const { data: leaveTypes = [] } = useLeaveTypes()

  const today = todayUtc()
  const todayIso = toIsoDate(today)
  const [view, setView] = useState(() => {
    const d = new Date(today)
    return { year: d.getUTCFullYear(), month: d.getUTCMonth() }
  })
  const [branch, setBranch] = useState("all")
  const [selectedDay, setSelectedDay] = useState<string>(todayIso)
  const [threshold, setThreshold] = useState(DEFAULT_THRESHOLD)

  // The warning level is a per-browser preference
  useEffect(() => setThreshold(readThreshold()), [])
  const updateThreshold = (value: number) => {
    const clean = Math.max(2, Math.min(50, Math.round(value) || DEFAULT_THRESHOLD))
    setThreshold(clean)
    try {
      window.localStorage.setItem(THRESHOLD_KEY, String(clean))
    } catch {
      // Storage unavailable: keep it for this visit only
    }
  }

  const branchOptions = isAdmin ? allBranches.map((b) => b.name) : myBranches

  // Whole weeks covering the month, Monday to Sunday
  const monthStart = Date.UTC(view.year, view.month, 1)
  const monthEnd = Date.UTC(view.year, view.month + 1, 0)
  const gridStart = startOfWeek(monthStart)
  const gridEnd = addDays(startOfWeek(monthEnd), 6)
  const from = toIsoDate(gridStart)
  const to = toIsoDate(gridEnd)

  const { data, isLoading, isError, error, refetch } = useQuery<{ leaves: LeaveEntry[] }>({
    queryKey: ["leave-calendar", from, to, branch],
    queryFn: () =>
      fetchWithAuth(`/api/leave-calendar?from=${from}&to=${to}&branch=${encodeURIComponent(branch)}`),
    enabled: !!user,
  })

  // Who is off on each day of the grid
  const byDay = useMemo(() => {
    const map = new Map<string, LeaveEntry[]>()
    for (const leave of data?.leaves || []) {
      const start = Math.max(parseDateToUtc(leave.start) ?? gridStart, gridStart)
      const end = Math.min(parseDateToUtc(leave.end) ?? start, gridEnd)
      for (let t = start; t <= end; t = addDays(t, 1)) {
        const key = toIsoDate(t)
        const list = map.get(key) || []
        list.push(leave)
        map.set(key, list)
      }
    }
    return map
  }, [data, gridStart, gridEnd])

  // Branches with `threshold` or more people off, per day
  const busyBranches = (iso: string) => {
    const counts = new Map<string, Set<string>>()
    for (const leave of byDay.get(iso) || []) {
      const people = counts.get(leave.branch) || new Set<string>()
      people.add(leave.employeeId)
      counts.set(leave.branch, people)
    }
    return [...counts.entries()]
      .filter(([, people]) => people.size >= threshold)
      .map(([name, people]) => ({ branch: name, count: people.size }))
      .sort((a, b) => b.count - a.count)
  }

  const days: number[] = []
  for (let t = gridStart; t <= gridEnd; t = addDays(t, 1)) days.push(t)

  const warningDays = days
    .filter((t) => t >= monthStart && t <= monthEnd)
    .map((t) => ({ iso: toIsoDate(t), busy: busyBranches(toIsoDate(t)) }))
    .filter((d) => d.busy.length > 0)

  const typeColor = (type: string) => leaveTypes.find((t) => t.name === type)?.color || "#6366f1"
  const typesInView = [...new Set((data?.leaves || []).map((l) => l.type))].sort()

  const goToMonth = (delta: number) => {
    const d = new Date(Date.UTC(view.year, view.month + delta, 1))
    setView({ year: d.getUTCFullYear(), month: d.getUTCMonth() })
  }
  const goToToday = () => {
    const d = new Date(today)
    setView({ year: d.getUTCFullYear(), month: d.getUTCMonth() })
    setSelectedDay(todayIso)
  }

  const selectedLeave = (byDay.get(selectedDay) || []).slice().sort(
    (a, b) => a.branch.localeCompare(b.branch) || a.employeeName.localeCompare(b.employeeName),
  )
  const selectedBusy = busyBranches(selectedDay)

  return (
    <div className="space-y-6 sm:space-y-8">
      <PageHeader
        title="Team Calendar"
        description="Who is off, by branch, with a warning when too many people are away at once."
      />

      {/* Controls */}
      <div className="surface flex flex-col gap-4 p-3 sm:p-4 lg:flex-row lg:items-end lg:justify-between">
        <div className="flex items-center gap-1.5">
          <Button variant="ghost" size="icon" className="shrink-0" onClick={() => goToMonth(-1)} aria-label="Previous month">
            <ChevronLeft />
          </Button>
          <h2 className="min-w-0 flex-1 truncate text-center text-lg font-semibold sm:min-w-[180px] sm:flex-none sm:text-xl">
            <span className="min-[400px]:hidden">
              {new Date(Date.UTC(view.year, view.month, 1)).toLocaleDateString("en-GB", { month: "short", year: "numeric", timeZone: "UTC" })}
            </span>
            <span className="hidden min-[400px]:inline">{monthLabel(view.year, view.month)}</span>
          </h2>
          <Button variant="ghost" size="icon" className="shrink-0" onClick={() => goToMonth(1)} aria-label="Next month">
            <ChevronRight />
          </Button>
          <Button variant="outline" size="sm" onClick={goToToday} className="ml-1 shrink-0">
            Today
          </Button>
        </div>

        <div className="grid grid-cols-1 gap-3 min-[400px]:grid-cols-2 sm:flex sm:items-end">
          {branchOptions.length > 1 && (
            <div className="space-y-1.5">
              <Label htmlFor="calendar-branch" className="text-xs text-muted-foreground">
                Branch
              </Label>
              <Select value={branch} onValueChange={setBranch}>
                <SelectTrigger id="calendar-branch" className="w-full sm:w-[190px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">{isAdmin ? "All branches" : "All my branches"}</SelectItem>
                  {branchOptions.map((name) => (
                    <SelectItem key={name} value={name}>
                      {name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}
          <div className={cn("space-y-1.5", branchOptions.length <= 1 && "min-[400px]:col-span-2")}>
            <Label htmlFor="calendar-threshold" className="text-xs text-muted-foreground">
              Warning level
            </Label>
            <Input
              id="calendar-threshold"
              type="number"
              inputMode="numeric"
              min={2}
              max={50}
              value={threshold}
              onChange={(e) => updateThreshold(Number(e.target.value))}
              title="Flag a day when this many people in one branch are off"
              className="w-full sm:w-[110px]"
            />
          </div>
        </div>
      </div>

      {isError && <ErrorState title="Couldn't load the calendar" message={handleApiError(error)} onRetry={() => refetch()} />}

      {warningDays.length > 0 && (
        <Alert variant="warning" className="page-enter">
          <AlertTriangle />
          <AlertTitle>
            {warningDays.length} {warningDays.length === 1 ? "day" : "days"} this month with {threshold} or more people off in one
            branch
          </AlertTitle>
          <AlertDescription>
            <ul className="mt-1 flex flex-wrap gap-1.5">
              {warningDays.map((d) => (
                <li key={d.iso}>
                  <button
                    className="min-h-8 rounded-full border border-warning/25 bg-card px-3 py-1.5 text-xs font-semibold text-foreground transition-colors hover:border-warning/50"
                    onClick={() => setSelectedDay(d.iso)}
                  >
                    {shortDate(d.iso)} · {d.busy.map((b) => `${b.branch} (${b.count})`).join(", ")}
                  </button>
                </li>
              ))}
            </ul>
          </AlertDescription>
        </Alert>
      )}

      <div className="grid gap-4 sm:gap-6 xl:grid-cols-[1fr_340px]">
        {/* Month grid */}
        <div className="surface overflow-hidden">
          <div className="grid grid-cols-7 border-b border-border/70 bg-muted/50">
            {WEEKDAYS.map((d, i) => (
              <div
                key={d}
                className={cn("py-2.5 text-center text-[11px] font-semibold uppercase tracking-wider text-muted-foreground", i >= 5 && "text-muted-foreground/60")}
              >
                <span className="sm:hidden">{d.charAt(0)}</span>
                <span className="hidden sm:inline">{d}</span>
              </div>
            ))}
          </div>
          <div className="grid grid-cols-7">
            {days.map((t, index) => {
              const iso = toIsoDate(t)
              const inMonth = t >= monthStart && t <= monthEnd
              const leave = byDay.get(iso) || []
              const busy = busyBranches(iso)
              const isWeekend = index % 7 >= 5
              const selected = selectedDay === iso
              return (
                <button
                  key={iso}
                  type="button"
                  onClick={() => setSelectedDay(iso)}
                  aria-label={`${dayLabel(iso)}: ${leave.length} off${busy.length ? ", too many off" : ""}`}
                  aria-pressed={selected}
                  className={cn(
                    "group relative flex min-h-[60px] flex-col gap-1 border-b border-r border-border/60 p-1 text-left transition-colors duration-150 hover:bg-muted/50 focus-visible:z-10 focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-inset focus-visible:ring-ring/30 sm:min-h-[104px] sm:p-2",
                    index % 7 === 6 && "border-r-0",
                    index >= days.length - 7 && "border-b-0",
                    isWeekend && "bg-muted/30",
                    !inMonth && "bg-muted/40 text-muted-foreground/60",
                    busy.length > 0 && "bg-warning-soft hover:bg-warning-soft",
                    selected && "bg-primary-soft/70 hover:bg-primary-soft/70",
                  )}
                >
                  {selected && <span className="pointer-events-none absolute inset-0 ring-2 ring-inset ring-primary" aria-hidden />}
                  <div className="flex items-center justify-between">
                    <span
                      className={cn(
                        "flex h-6 w-6 items-center justify-center rounded-full text-xs font-semibold tabular",
                        iso === todayIso && "bg-primary text-primary-foreground",
                      )}
                    >
                      {new Date(t).getUTCDate()}
                    </span>
                    {busy.length > 0 && <AlertTriangle className="h-3.5 w-3.5 text-warning" aria-hidden />}
                  </div>

                  {isLoading ? (
                    inMonth && <Skeleton className="hidden h-4 w-full sm:block" />
                  ) : (
                    <>
                      {/* Phones: coloured dots, one per person (up to 4) */}
                      {leave.length > 0 && (
                        <span className="flex flex-wrap items-center gap-0.5 px-0.5 sm:hidden">
                          {leave.slice(0, 4).map((l) => (
                            <span key={l.id} className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: typeColor(l.type) }} />
                          ))}
                          {leave.length > 4 && <span className="text-[9px] font-semibold text-muted-foreground">+{leave.length - 4}</span>}
                        </span>
                      )}
                      {/* Larger screens: names */}
                      <div className="hidden flex-col gap-0.5 sm:flex">
                        {leave.slice(0, CHIPS_PER_DAY).map((l) => (
                          <span
                            key={l.id}
                            className="truncate rounded-md px-1.5 py-0.5 text-[11px] font-semibold leading-4"
                            style={{ backgroundColor: `${typeColor(l.type)}1a`, color: typeColor(l.type) }}
                            title={`${l.employeeName} – ${l.type} (${l.branch})`}
                          >
                            {l.employeeName}
                          </span>
                        ))}
                        {leave.length > CHIPS_PER_DAY && (
                          <span className="px-1.5 text-[11px] font-medium text-muted-foreground">
                            +{leave.length - CHIPS_PER_DAY} more
                          </span>
                        )}
                      </div>
                    </>
                  )}
                </button>
              )
            })}
          </div>
        </div>

        {/* Selected day */}
        <div className="surface h-fit overflow-hidden">
          <div className="p-5 pb-4">
            <p className="eyebrow">{selectedDay === todayIso ? "Today" : "Selected day"}</p>
            <h3 className="mt-1 text-lg font-semibold">{dayLabel(selectedDay)}</h3>
            <p className="text-sm text-muted-foreground">
              {selectedLeave.length === 0 ? "Nobody off" : `${plural(selectedLeave.length, "person", "people")} off`}
            </p>
          </div>
          {selectedBusy.length > 0 && (
            <div className="mx-5 mb-4 flex gap-2.5 rounded-xl border border-warning/25 bg-warning-soft p-3 text-sm">
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-warning" />
              <span>
                Too many off: {selectedBusy.map((b) => `${b.count} in ${b.branch}`).join(", ")}{" "}
                <span className="text-muted-foreground">(warning level {threshold})</span>
              </span>
            </div>
          )}
          {selectedLeave.length > 0 ? (
            <ul className="divide-y divide-border/70 border-t border-border/70">
              {selectedLeave.map((l) => (
                <li key={l.id} className="flex items-center gap-3 px-5 py-3">
                  <Avatar name={l.employeeName} className="h-8 w-8 text-xs" />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold">{l.employeeName}</p>
                    <p className="flex items-center gap-1.5 truncate text-xs text-muted-foreground">
                      <span className="h-2 w-2 shrink-0 rounded-full" style={{ backgroundColor: typeColor(l.type) }} aria-hidden />
                      {l.type} · {l.branch}
                    </p>
                  </div>
                  <div className="shrink-0 text-right text-xs text-muted-foreground">
                    <p className="font-medium text-foreground tabular">
                      {l.start === l.end ? shortDate(l.start) : `${shortDate(l.start)} – ${shortDate(l.end)}`}
                    </p>
                    <p>{plural(l.duration, "day")}</p>
                  </div>
                </li>
              ))}
            </ul>
          ) : (
            <EmptyState icon={CalendarCheck} title="Nobody is off" description="Pick another day to see who's away." compact className="border-t border-border/70" />
          )}
        </div>
      </div>

      {typesInView.length > 0 && (
        <div className="flex flex-wrap gap-x-5 gap-y-2 text-[13px] text-muted-foreground">
          {typesInView.map((type) => (
            <span key={type} className="flex items-center gap-2">
              <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: typeColor(type) }} aria-hidden />
              {type}
            </span>
          ))}
        </div>
      )}
    </div>
  )
}
