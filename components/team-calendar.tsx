"use client"

import { useEffect, useMemo, useState } from "react"
import { useQuery } from "@tanstack/react-query"
import { AlertTriangle, ChevronLeft, ChevronRight } from "lucide-react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Skeleton } from "@/components/ui/skeleton"
import { useApp } from "./app-provider"
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
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Team Calendar</h1>
        <p className="text-muted-foreground">Who is off, by branch, with a warning when too many are off at once</p>
      </div>

      {/* Controls */}
      <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div className="flex items-center gap-2">
          <Button variant="outline" size="icon" onClick={() => goToMonth(-1)} aria-label="Previous month">
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <h2 className="min-w-[132px] text-center text-lg font-semibold sm:min-w-[170px] sm:text-xl">
            {monthLabel(view.year, view.month)}
          </h2>
          <Button variant="outline" size="icon" onClick={() => goToMonth(1)} aria-label="Next month">
            <ChevronRight className="h-4 w-4" />
          </Button>
          <Button variant="outline" onClick={goToToday}>
            Today
          </Button>
        </div>

        <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
          {branchOptions.length > 1 && (
            <div className="space-y-1">
              <Label htmlFor="calendar-branch">Branch</Label>
              <Select value={branch} onValueChange={setBranch}>
                <SelectTrigger id="calendar-branch" className="w-full sm:w-[200px]">
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
          <div className="space-y-1">
            <Label htmlFor="calendar-threshold">Warn at (people off in one branch)</Label>
            <Input
              id="calendar-threshold"
              type="number"
              min={2}
              max={50}
              value={threshold}
              onChange={(e) => updateThreshold(Number(e.target.value))}
              className="w-full sm:w-[120px]"
            />
          </div>
        </div>
      </div>

      {isError && (
        <div className="rounded-md bg-destructive/15 p-4 text-destructive">
          <p className="font-medium">Couldn&apos;t load the calendar</p>
          <p className="text-sm">{handleApiError(error)}</p>
          <Button variant="outline" size="sm" onClick={() => refetch()} className="mt-2">
            Try again
          </Button>
        </div>
      )}

      {warningDays.length > 0 && (
        <Alert className="border-amber-300 bg-amber-50 text-amber-900 [&>svg]:text-amber-600">
          <AlertTriangle className="h-4 w-4" />
          <AlertTitle>
            {warningDays.length} {warningDays.length === 1 ? "day" : "days"} this month with {threshold} or more
            people off in one branch
          </AlertTitle>
          <AlertDescription>
            <ul className="mt-1 flex flex-wrap gap-x-4 gap-y-1">
              {warningDays.map((d) => (
                <li key={d.iso}>
                  <button className="underline-offset-2 hover:underline" onClick={() => setSelectedDay(d.iso)}>
                    {shortDate(d.iso)}: {d.busy.map((b) => `${b.branch} (${b.count})`).join(", ")}
                  </button>
                </li>
              ))}
            </ul>
          </AlertDescription>
        </Alert>
      )}

      <div className="grid gap-6 xl:grid-cols-[1fr_320px]">
        {/* Month grid */}
        <Card className="overflow-hidden">
          <div className="grid grid-cols-7 border-b bg-muted/50 text-center text-xs font-medium text-muted-foreground">
            {WEEKDAYS.map((d) => (
              <div key={d} className="py-2">
                {d}
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
              return (
                <button
                  key={iso}
                  type="button"
                  onClick={() => setSelectedDay(iso)}
                  aria-label={`${dayLabel(iso)}: ${leave.length} off${busy.length ? ", too many off" : ""}`}
                  aria-pressed={selectedDay === iso}
                  className={cn(
                    "relative flex min-h-[64px] flex-col gap-1 border-b border-r p-1 text-left align-top transition-colors hover:bg-muted/60 sm:min-h-[112px] sm:p-1.5",
                    index % 7 === 6 && "border-r-0",
                    !inMonth && "bg-muted/30 text-muted-foreground",
                    isWeekend && inMonth && "bg-muted/20",
                    busy.length > 0 && "bg-amber-50 ring-2 ring-inset ring-amber-400 hover:bg-amber-100",
                    selectedDay === iso && "ring-2 ring-inset ring-primary",
                  )}
                >
                  <div className="flex items-center justify-between">
                    <span
                      className={cn(
                        "flex h-6 w-6 items-center justify-center rounded-full text-xs font-medium",
                        iso === todayIso && "bg-primary text-primary-foreground",
                      )}
                    >
                      {new Date(t).getUTCDate()}
                    </span>
                    {busy.length > 0 && <AlertTriangle className="h-3.5 w-3.5 text-amber-600" aria-hidden />}
                  </div>

                  {isLoading ? (
                    inMonth && <Skeleton className="hidden h-4 w-full sm:block" />
                  ) : (
                    <>
                      {/* Phones: just a count */}
                      {leave.length > 0 && (
                        <span className="rounded bg-primary/10 px-1 text-center text-[11px] font-medium text-primary sm:hidden">
                          {leave.length} off
                        </span>
                      )}
                      {/* Larger screens: names */}
                      <div className="hidden flex-col gap-0.5 sm:flex">
                        {leave.slice(0, CHIPS_PER_DAY).map((l) => (
                          <span
                            key={l.id}
                            className="truncate rounded px-1 py-0.5 text-[11px] font-medium text-white"
                            style={{ backgroundColor: typeColor(l.type) }}
                            title={`${l.employeeName} – ${l.type} (${l.branch})`}
                          >
                            {l.employeeName}
                          </span>
                        ))}
                        {leave.length > CHIPS_PER_DAY && (
                          <span className="px-1 text-[11px] text-muted-foreground">
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
        </Card>

        {/* Selected day */}
        <Card className="h-fit">
          <CardHeader>
            <CardTitle className="text-lg">{dayLabel(selectedDay)}</CardTitle>
            <CardDescription>
              {selectedLeave.length === 0
                ? "Nobody off"
                : `${selectedLeave.length} ${selectedLeave.length === 1 ? "person" : "people"} off`}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {selectedBusy.length > 0 && (
              <div className="flex gap-2 rounded-md border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900">
                <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-600" />
                <span>
                  Too many off:{" "}
                  {selectedBusy.map((b) => `${b.count} in ${b.branch}`).join(", ")} (warning level {threshold})
                </span>
              </div>
            )}
            {selectedLeave.length > 0 && (
              <ul className="space-y-3">
                {selectedLeave.map((l) => (
                  <li key={l.id} className="flex gap-3">
                    <span
                      className="mt-1.5 h-2.5 w-2.5 shrink-0 rounded-full"
                      style={{ backgroundColor: typeColor(l.type) }}
                      aria-hidden
                    />
                    <div className="min-w-0">
                      <p className="font-medium">{l.employeeName}</p>
                      <p className="text-sm text-muted-foreground">
                        {l.type} · {l.branch}
                      </p>
                      <p className="text-sm text-muted-foreground">
                        {l.start === l.end ? shortDate(l.start) : `${shortDate(l.start)} – ${shortDate(l.end)}`} ·{" "}
                        {l.duration} {l.duration === 1 ? "day" : "days"}
                      </p>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      </div>

      {typesInView.length > 0 && (
        <div className="flex flex-wrap gap-x-4 gap-y-2 text-sm text-muted-foreground">
          {typesInView.map((type) => (
            <span key={type} className="flex items-center gap-1.5">
              <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: typeColor(type) }} aria-hidden />
              {type}
            </span>
          ))}
        </div>
      )}
    </div>
  )
}
