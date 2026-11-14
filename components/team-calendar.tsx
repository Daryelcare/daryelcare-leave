"use client"

// Team calendar: a month timeline in the style of CarerHR's client admin
// calendar. One row per leave entry that touches the month (someone with two
// separate periods gets two rows), a bar across the days it covers, coloured
// by leave type. Approved leave is a solid bar; pending leave is a pale, dashed
// version of the same colour. Rejected leave is never shown.

import { type ReactNode, useEffect, useMemo, useRef, useState } from "react"
import { useQuery } from "@tanstack/react-query"
import { AlertTriangle, CalendarDays, ChevronLeft, ChevronRight } from "lucide-react"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Skeleton } from "@/components/ui/skeleton"
import { useApp } from "./app-provider"
import { Avatar, EmptyState, ErrorState, plural } from "./page-kit"
import { useBranches } from "@/hooks/use-branches"
import { useLeaveTypes } from "@/hooks/use-leave-types"
import { fetchWithAuth, handleApiError } from "@/lib/api-utils"
import { formatDisplayRange, toIsoDate, todayUtc } from "@/lib/dates"
import { cn } from "@/lib/utils"

type LeaveEntry = {
  id: string
  employeeId: string
  employeeName: string
  branch: string
  type: string
  startDate: string
  endDate: string
  start: string // YYYY-MM-DD
  end: string
  duration: number
  status: string
}

const WEEKDAY_LETTERS = ["S", "M", "T", "W", "T", "F", "S"]
const ROW = 48 // height of one person's row, px
const DAY_WIDTH = 26 // minimum width of a day column, px
const THRESHOLD_KEY = "teamCalendar.warnAt"
const DEFAULT_THRESHOLD = 3

function readThreshold(): number {
  try {
    const value = Number(window.localStorage.getItem(THRESHOLD_KEY))
    return Number.isInteger(value) && value >= 2 ? value : DEFAULT_THRESHOLD
  } catch {
    return DEFAULT_THRESHOLD
  }
}

function monthTitle(year: number, month: number) {
  return new Date(Date.UTC(year, month, 1)).toLocaleDateString("en-GB", {
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  })
}

// Leave-type colours come from Settings → Leave types. Light colours get dark
// text on the bar so the label stays readable.
function textOn(hex: string) {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex)
  if (!m) return "#fff"
  const n = parseInt(m[1], 16)
  const [r, g, b] = [(n >> 16) & 255, (n >> 8) & 255, n & 255].map((c) => {
    const v = c / 255
    return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4
  })
  const luminance = 0.2126 * r + 0.7152 * g + 0.0722 * b
  return luminance > 0.45 ? "hsl(var(--foreground))" : "#fff"
}
const tint = (hex: string, alpha = "1f") => (/^#[0-9a-f]{6}$/i.test(hex) ? `${hex}${alpha}` : hex)

export function TeamCalendar({
  onOpen,
  actions,
  typeFilter = "all",
  search = "",
}: {
  onOpen?: (id: string) => void
  /** Page actions (view switch, Who's on leave, Add leave) shown in the controls row */
  actions?: ReactNode
  /** The list's leave type filter, so both views show the same leave */
  typeFilter?: string
  /** The list's employee search */
  search?: string
}) {
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

  const monthStart = Date.UTC(view.year, view.month, 1)
  const numDays = new Date(Date.UTC(view.year, view.month + 1, 0)).getUTCDate()
  const from = toIsoDate(monthStart)
  const to = toIsoDate(Date.UTC(view.year, view.month, numDays))
  const title = monthTitle(view.year, view.month)
  const isCurrentMonth = todayIso.slice(0, 7) === from.slice(0, 7)
  const dayPct = 100 / numDays

  const { data, isLoading, isFetching, isError, error, refetch } = useQuery<{ leaves: LeaveEntry[] }>({
    queryKey: ["leave-calendar", from, to, branch],
    queryFn: () => fetchWithAuth(`/api/leave-calendar?from=${from}&to=${to}&branch=${encodeURIComponent(branch)}`),
    enabled: !!user,
    placeholderData: (previous) => previous,
  })

  const typeColor = (type: string) => leaveTypes.find((t) => t.name === type)?.color || "#6366f1"

  // One row per leave entry, its bar clamped to this month
  const rows = useMemo(() => {
    return (data?.leaves || [])
      .filter(
        (l) =>
          l.status !== "Rejected" &&
          l.start <= to &&
          l.end >= from &&
          (typeFilter === "all" || l.type === typeFilter) &&
          (!search.trim() || l.employeeName.toLowerCase().includes(search.trim().toLowerCase())),
      )
      .sort((a, b) => a.start.localeCompare(b.start) || a.employeeName.localeCompare(b.employeeName))
      .map((l) => {
        const startDay = Number((l.start < from ? from : l.start).slice(8, 10))
        const endDay = Number((l.end > to ? to : l.end).slice(8, 10))
        const pending = l.status === "Pending"
        return {
          leave: l,
          pending,
          // A one- or two-day bar is too narrow for its label: the label sits
          // beside it instead (before it near the end of the month)
          short: endDay - startDay + 1 <= 2,
          labelBefore: endDay > numDays - 4,
          left: (startDay - 1) * dayPct,
          width: (endDay - startDay + 1) * dayPct,
          label: pending ? `${l.type} (pending)` : l.type,
        }
      })
  }, [data, from, to, numDays, dayPct, typeFilter, search])

  // Branches with `threshold` or more people off (approved leave) on each day
  const busyByDay = useMemo(() => {
    const map = new Map<number, { branch: string; count: number }[]>()
    for (let n = 1; n <= numDays; n++) {
      const iso = toIsoDate(Date.UTC(view.year, view.month, n))
      const counts = new Map<string, Set<string>>()
      for (const { leave } of rows) {
        if (leave.status !== "Approved" || leave.start > iso || leave.end < iso) continue
        const people = counts.get(leave.branch) || new Set<string>()
        people.add(leave.employeeId)
        counts.set(leave.branch, people)
      }
      const busy = [...counts.entries()]
        .filter(([, people]) => people.size >= threshold)
        .map(([name, people]) => ({ branch: name, count: people.size }))
        .sort((a, b) => b.count - a.count)
      if (busy.length) map.set(n, busy)
    }
    return map
  }, [rows, numDays, view.year, view.month, threshold])

  const days = Array.from({ length: numDays }, (_, i) => {
    const n = i + 1
    const dow = new Date(Date.UTC(view.year, view.month, n)).getUTCDay()
    return {
      n,
      letter: WEEKDAY_LETTERS[dow],
      weekend: dow === 0 || dow === 6,
      isToday: isCurrentMonth && n === Number(todayIso.slice(8, 10)),
      busy: busyByDay.get(n),
    }
  })
  const todayLeft = isCurrentMonth ? (Number(todayIso.slice(8, 10)) - 0.5) * dayPct : null
  const peopleAway = new Set(rows.map((r) => r.leave.employeeId)).size
  const legendTypes = [...new Set(rows.map((r) => r.leave.type))].sort((a, b) => a.localeCompare(b))
  const hasPending = rows.some((r) => r.pending)
  const busyDays = days.filter((d) => d.busy)

  // On narrow screens the days scroll sideways: bring today into view
  const scrollRef = useRef<HTMLDivElement>(null)
  const ready = !isLoading && rows.length > 0
  useEffect(() => {
    const box = scrollRef.current
    if (!box || !ready) return
    if (!isCurrentMonth || box.scrollWidth <= box.clientWidth) {
      box.scrollLeft = 0
      return
    }
    const nameCol = box.firstElementChild?.firstElementChild?.clientWidth ?? 0
    const daysWidth = box.scrollWidth - nameCol
    const todayX = nameCol + ((Number(todayIso.slice(8, 10)) - 1) / numDays) * daysWidth
    box.scrollLeft = Math.max(0, todayX - nameCol - (box.clientWidth - nameCol) / 3)
  }, [ready, isCurrentMonth, todayIso, numDays, from])

  const goToMonth = (delta: number) => {
    const d = new Date(Date.UTC(view.year, view.month + delta, 1))
    setView({ year: d.getUTCFullYear(), month: d.getUTCMonth() })
  }
  const goToToday = () => {
    const d = new Date(today)
    setView({ year: d.getUTCFullYear(), month: d.getUTCMonth() })
  }

  const pill =
    "inline-flex h-9 items-center justify-center rounded-full border border-border/80 bg-card text-foreground/80 shadow-card transition-[color,box-shadow] duration-150 hover:text-primary hover:shadow-raised focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-ring/30"

  return (
    <div className="surface p-4 sm:p-5">
      {/* Title and month */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-secondary text-foreground/70">
            <CalendarDays className="h-5 w-5" />
          </span>
          <div>
            <h2 className="text-lg font-semibold">Team calendar</h2>
            <p className="text-xs font-semibold text-muted-foreground" aria-live="polite">
              {isLoading ? "Loading…" : `${plural(peopleAway, "person", "people")} away in ${title}`}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-1.5">
          <button type="button" onClick={() => goToMonth(-1)} className={cn(pill, "w-9")} aria-label="Previous month">
            <ChevronLeft className="h-4 w-4" />
          </button>
          <span className="min-w-[132px] text-center font-display text-base font-semibold tabular">{title}</span>
          <button type="button" onClick={() => goToMonth(1)} className={cn(pill, "w-9")} aria-label="Next month">
            <ChevronRight className="h-4 w-4" />
          </button>
          {!isCurrentMonth && (
            <button type="button" onClick={goToToday} className={cn(pill, "ml-1 px-3.5 text-xs font-semibold")}>
              Today
            </button>
          )}
        </div>
        {actions && (
          <div className="flex w-full flex-wrap items-center gap-2 lg:ml-2 lg:w-auto [&>*]:flex-1 lg:[&>*]:flex-none">
            {actions}
          </div>
        )}
      </div>

      {/* Branch, warning level and legend */}
      <div className="mt-4 flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
        <div className="flex flex-wrap items-center gap-2">
          {legendTypes.map((type) => (
            <span
              key={type}
              className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold"
              style={{ backgroundColor: tint(typeColor(type)), color: typeColor(type) }}
            >
              <span
                className="h-2 w-2 shrink-0 rounded-full"
                style={{ backgroundColor: typeColor(type) }}
                aria-hidden
              />
              {type}
            </span>
          ))}
          {hasPending && (
            <span className="inline-flex items-center gap-1.5 rounded-full bg-secondary px-2.5 py-1 text-xs font-semibold text-foreground/75">
              <span
                aria-hidden
                className="h-2.5 w-4 shrink-0 rounded-full border-[1.5px] border-dashed border-muted-foreground"
                style={{
                  backgroundImage:
                    "repeating-linear-gradient(135deg, rgb(255 255 255 / 0.7) 0 3px, transparent 3px 6px)",
                }}
              />
              Pending (dashed)
            </span>
          )}
        </div>
        <div className="grid grid-cols-2 gap-2.5 sm:flex sm:items-end">
          {branchOptions.length > 1 && (
            <div className="space-y-1.5">
              <Label htmlFor="calendar-branch" className="text-xs text-muted-foreground">
                Branch
              </Label>
              <Select value={branch} onValueChange={setBranch}>
                <SelectTrigger id="calendar-branch" className="w-full sm:w-[180px]">
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
          <div className={cn("space-y-1.5", branchOptions.length <= 1 && "col-span-2")}>
            <Label htmlFor="calendar-threshold" className="text-xs text-muted-foreground">
              Warn at (per branch)
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
              className="w-full sm:w-[120px]"
            />
          </div>
        </div>
      </div>

      {/* Days with too many people off in one branch */}
      {busyDays.length > 0 && (
        <div className="mt-4 flex gap-2.5 rounded-xl border border-warning/25 bg-warning-soft p-3 text-sm">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-warning" />
          <div className="min-w-0">
            <p className="font-semibold">
              {plural(busyDays.length, "day")} with {threshold} or more people off in one branch
            </p>
            <p className="text-muted-foreground">
              {busyDays
                .map(
                  (d) =>
                    `${String(d.n).padStart(2, "0")}/${String(view.month + 1).padStart(2, "0")}: ${d.busy!.map((b) => `${b.branch} (${b.count})`).join(", ")}`,
                )
                .join(" · ")}
            </p>
          </div>
        </div>
      )}

      <div className="mt-4">
        {isError ? (
          <ErrorState title="Couldn't load the calendar" message={handleApiError(error)} onRetry={() => refetch()} />
        ) : isLoading ? (
          <div className="space-y-3 py-2">
            {[0, 1, 2, 3].map((i) => (
              <div key={i} className="flex items-center gap-3">
                <Skeleton className="h-8 w-8 rounded-full" />
                <Skeleton className="h-4 w-32" />
                <Skeleton className="h-6 flex-1 rounded-full" style={{ marginLeft: `${i * 8}%`, maxWidth: "40%" }} />
              </div>
            ))}
          </div>
        ) : rows.length === 0 ? (
          <EmptyState
            icon={CalendarDays}
            title={`Nobody is away in ${title}`}
            description="Approved and pending leave overlapping this month will appear here."
          />
        ) : (
          <div ref={scrollRef} className={cn("overflow-x-auto transition-opacity", isFetching && "opacity-60")}>
            <div
              className="grid [--name-col:172px] sm:[--name-col:200px]"
              style={{
                gridTemplateColumns: "var(--name-col) minmax(0,1fr)",
                minWidth: `calc(var(--name-col) + ${numDays * DAY_WIDTH}px)`,
              }}
            >
              {/* Names, pinned while the days scroll */}
              <div className="sticky left-0 z-20 flex flex-col bg-card shadow-[8px_0_12px_-10px_rgb(16_24_40_/_0.25)]">
                <div className="h-11" />
                {rows.map((r) => (
                  <button
                    type="button"
                    key={r.leave.id}
                    onClick={() => onOpen?.(r.leave.id)}
                    tabIndex={-1}
                    className="flex w-full items-center gap-2 border-t border-border/60 pr-2 text-left transition-colors hover:bg-muted/50 sm:gap-2.5"
                    style={{ height: ROW }}
                  >
                    <Avatar name={r.leave.employeeName} className="hidden h-7 w-7 text-[11px] sm:flex" />
                    <div className="min-w-0">
                      <p className="truncate text-[13px] font-semibold">{r.leave.employeeName}</p>
                      <p className="truncate text-xs text-muted-foreground tabular">
                        {formatDisplayRange(r.leave.start, r.leave.end)}
                      </p>
                    </div>
                  </button>
                ))}
              </div>

              <div className="relative">
                {/* Day header: weekday letter and date, today circled */}
                <div className="grid h-11" style={{ gridTemplateColumns: `repeat(${numDays}, 1fr)` }}>
                  {days.map((d) => (
                    <div
                      key={d.n}
                      className={cn(
                        "flex flex-col items-center justify-center gap-0.5",
                        d.weekend && "bg-muted/60",
                        d.busy && "bg-warning-soft",
                      )}
                      title={
                        d.busy
                          ? `Too many off: ${d.busy.map((b) => `${b.count} in ${b.branch}`).join(", ")}`
                          : undefined
                      }
                    >
                      <span
                        className={cn(
                          "text-[11px] font-semibold leading-none",
                          d.busy ? "text-warning" : d.weekend ? "text-muted-foreground/60" : "text-muted-foreground",
                        )}
                      >
                        {d.busy ? <AlertTriangle className="h-3 w-3" aria-label="Too many off" /> : d.letter}
                      </span>
                      <span
                        className={cn(
                          "flex h-[22px] w-[22px] items-center justify-center rounded-full text-xs font-semibold tabular",
                          d.isToday
                            ? "bg-primary text-primary-foreground"
                            : d.weekend
                              ? "text-muted-foreground/60"
                              : "text-foreground/80",
                        )}
                      >
                        {d.n}
                      </span>
                    </div>
                  ))}
                </div>

                <div className="relative">
                  {todayLeft !== null && (
                    <div
                      aria-hidden
                      className="pointer-events-none absolute bottom-0 top-0 z-10 w-0.5 -translate-x-1/2 rounded-full bg-primary/60"
                      style={{ left: `${todayLeft}%` }}
                    />
                  )}
                  {/* Row backgrounds with weekend shading */}
                  {rows.map((r) => (
                    <div
                      key={`bg-${r.leave.id}`}
                      className="grid border-t border-border/60"
                      style={{ height: ROW, gridTemplateColumns: `repeat(${numDays}, 1fr)` }}
                    >
                      {days.map((d) => (
                        <div key={d.n} className={cn(d.weekend && "bg-muted/60", d.busy && "bg-warning-soft/60")} />
                      ))}
                    </div>
                  ))}
                  {/* Bars */}
                  {rows.map((r, i) => {
                    const colour = typeColor(r.leave.type)
                    const range = formatDisplayRange(r.leave.start, r.leave.end)
                    return (
                      <button
                        key={`bar-${r.leave.id}`}
                        type="button"
                        onClick={() => onOpen?.(r.leave.id)}
                        className="absolute flex items-center rounded-full px-2.5 text-left before:absolute before:-inset-x-1.5 before:-inset-y-[11px] before:content-[''] transition-[filter,box-shadow] duration-150 hover:shadow-raised hover:brightness-105 focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-ring/40"
                        style={{
                          left: `${r.left}%`,
                          width: `${r.width}%`,
                          top: i * ROW + 11,
                          height: 26,
                          backgroundColor: r.pending ? tint(colour, "26") : colour,
                          backgroundImage: r.pending
                            ? "repeating-linear-gradient(135deg, rgb(255 255 255 / 0.65) 0 6px, transparent 6px 12px)"
                            : "none",
                          color: r.pending ? colour : textOn(colour),
                          border: r.pending ? `1.5px dashed ${colour}` : "none",
                        }}
                        aria-label={`${r.leave.employeeName}, ${r.label}, ${range}, ${r.leave.branch}`}
                        title={`${r.leave.employeeName} · ${r.label} · ${range} · ${plural(r.leave.duration, "day")} · ${r.leave.branch}`}
                      >
                        {!r.short && <span className="min-w-0 truncate text-xs font-semibold">{r.label}</span>}
                      </button>
                    )
                  })}
                  {/* Labels beside the short bars */}
                  {rows.map((r, i) =>
                    r.short ? (
                      <span
                        key={`label-${r.leave.id}`}
                        aria-hidden
                        className="pointer-events-none absolute whitespace-nowrap text-xs font-semibold leading-[26px] text-foreground/75"
                        style={{
                          top: i * ROW + 11,
                          ...(r.labelBefore
                            ? { right: `calc(${100 - r.left}% + 6px)` }
                            : { left: `calc(${r.left + r.width}% + 6px)` }),
                        }}
                      >
                        {r.label}
                      </span>
                    ) : null,
                  )}
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
