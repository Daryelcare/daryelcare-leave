"use client"

// "Who's on leave", as on CarerHR's client admin Leave page: pick today, this
// week, this month or your own dates and see everyone with approved leave in
// that period. Branch managers only see their own branches (the API scopes it).

import { useEffect, useMemo, useState } from "react"
import { useQuery } from "@tanstack/react-query"
import { AlertTriangle, Loader2, PartyPopper, Users } from "lucide-react"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { DatePicker } from "@/components/ui/date-picker"
import { Avatar, plural } from "./page-kit"
import { useLeaveTypes } from "@/hooks/use-leave-types"
import { fetchWithAuth } from "@/lib/api-utils"
import {
  addDays,
  formatDisplayRange,
  localDateToUtc,
  startOfWeek,
  toIsoDate,
  todayUtc,
  utcToLocalDate,
} from "@/lib/dates"
import { cn } from "@/lib/utils"

type Preset = "today" | "week" | "month" | "custom"
type LeaveEntry = {
  id: string
  employeeId: string
  employeeName: string
  branch: string
  type: string
  start: string
  end: string
  duration: number
  status: string
}

const PRESETS: { value: Preset; label: string }[] = [
  { value: "today", label: "Today" },
  { value: "week", label: "This week" },
  { value: "month", label: "This month" },
  { value: "custom", label: "Custom" },
]

/** The days a preset covers (Monday–Sunday weeks), as UTC-midnight timestamps */
function presetRange(preset: Exclude<Preset, "custom">, today: number): { from: number; to: number } {
  if (preset === "today") return { from: today, to: today }
  if (preset === "week") {
    const monday = startOfWeek(today)
    return { from: monday, to: addDays(monday, 6) }
  }
  const d = new Date(today)
  return {
    from: Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), 1),
    to: Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 0),
  }
}

export function WhosOnLeaveDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (open: boolean) => void }) {
  const { data: leaveTypes = [] } = useLeaveTypes()
  const [preset, setPreset] = useState<Preset>("today")
  // Read "today" when the dialog opens, so a page left open overnight moves on
  const [today, setToday] = useState(() => todayUtc())
  useEffect(() => {
    if (open) setToday(todayUtc())
  }, [open])
  const [customFrom, setCustomFrom] = useState<Date | undefined>(() => utcToLocalDate(todayUtc()))
  const [customTo, setCustomTo] = useState<Date | undefined>(() => utcToLocalDate(todayUtc()))

  const range = useMemo(() => {
    if (preset !== "custom") return presetRange(preset, today)
    if (!customFrom || !customTo) return null
    return { from: localDateToUtc(customFrom), to: localDateToUtc(customTo) }
  }, [preset, today, customFrom, customTo])
  const badRange = !range || range.to < range.from || range.to - range.from > 366 * 86_400_000
  const from = range ? toIsoDate(range.from) : ""
  const to = range ? toIsoDate(range.to) : ""

  const { data, isLoading, isError, refetch, isFetching } = useQuery<{ leaves: LeaveEntry[] }>({
    queryKey: ["whos-on-leave", from, to],
    queryFn: () => fetchWithAuth(`/api/leave-calendar?from=${from}&to=${to}&branch=all`),
    enabled: open && !badRange,
    retry: 1,
  })

  // Approved leave only, like CarerHR; sorted by start date then name
  const rows = useMemo(
    () =>
      (data?.leaves || [])
        .filter((l) => l.status === "Approved")
        .sort((a, b) => a.start.localeCompare(b.start) || a.employeeName.localeCompare(b.employeeName)),
    [data],
  )
  // People, not bookings: two separate periods in one week is one person away
  const peopleAway = new Set(rows.map((r) => r.employeeId)).size
  const typeColor = (type: string) => leaveTypes.find((t) => t.name === type)?.color || "#6366f1"

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="gap-0 p-0 sm:max-w-[600px]">
        <DialogHeader className="px-5 pb-4 pt-5 text-left sm:px-6 sm:pt-6">
          <div className="flex items-center gap-3 pr-8">
            <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-secondary text-foreground/70">
              <Users className="h-5 w-5" />
            </span>
            <div className="min-w-0 flex-1">
              <DialogTitle className="text-lg">Who&apos;s on leave</DialogTitle>
              <DialogDescription className="mt-0.5">
                Approved leave overlapping{" "}
                <strong className="font-semibold text-foreground tabular">
                  {range && !badRange ? formatDisplayRange(from, to) : "—"}
                </strong>
              </DialogDescription>
            </div>
            {!isLoading && !isError && !badRange && (
              <span className="shrink-0 rounded-full border border-border/80 bg-card px-3 py-1 text-xs font-semibold tabular shadow-card">
                {peopleAway} away
              </span>
            )}
          </div>
        </DialogHeader>

        <div className="space-y-3 px-5 pb-3 sm:px-6">
          <div role="group" aria-label="Period" className="grid w-full grid-cols-4 gap-1 rounded-full bg-secondary p-1 sm:inline-flex sm:w-auto">
            {PRESETS.map((p) => {
              const active = preset === p.value
              return (
                <button
                  key={p.value}
                  type="button"
                  onClick={() => setPreset(p.value)}
                  aria-pressed={active}
                  className={cn(
                    "h-8 whitespace-nowrap rounded-full px-1.5 text-[13px] font-semibold transition-colors duration-150 sm:px-3.5",
                    "focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-ring/30",
                    active
                      ? "bg-primary text-primary-foreground shadow-raised"
                      : "text-muted-foreground hover:text-foreground",
                  )}
                >
                  {p.label}
                </button>
              )
            })}
          </div>

          {preset === "custom" && (
            <div className="space-y-1.5">
              <div className="grid grid-cols-2 gap-2 sm:max-w-sm">
                <div className="space-y-1">
                  <Label htmlFor="on-leave-from" className="text-xs text-muted-foreground">
                    From
                  </Label>
                  <DatePicker id="on-leave-from" value={customFrom} onChange={setCustomFrom} />
                </div>
                <div className="space-y-1">
                  <Label htmlFor="on-leave-to" className="text-xs text-muted-foreground">
                    To
                  </Label>
                  <DatePicker id="on-leave-to" value={customTo} min={customFrom} onChange={setCustomTo} />
                </div>
              </div>
              {badRange && (
                <p role="alert" className="text-xs font-medium text-muted-foreground">
                  Pick a start and an end date, with the end on or after the start (up to a year).
                </p>
              )}
            </div>
          )}
        </div>

        <div className="max-h-[55vh] overflow-y-auto px-3 pb-5 sm:px-4">
          {badRange ? null : isLoading ? (
            <div className="flex h-32 items-center justify-center" role="status">
              <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
              <span className="sr-only">Loading who&apos;s on leave</span>
            </div>
          ) : isError ? (
            <div
              role="alert"
              className="mx-2 flex flex-col items-center rounded-2xl bg-muted/60 px-6 py-10 text-center"
            >
              <AlertTriangle className="h-6 w-6 text-foreground/70" />
              <p className="mt-3 font-semibold">Couldn&apos;t load who is on leave</p>
              <p className="mt-0.5 text-sm text-muted-foreground">
                This isn&apos;t a list of who is away. Try again in a moment.
              </p>
              <Button className="mt-4" variant="outline" onClick={() => refetch()} disabled={isFetching}>
                Try again
              </Button>
            </div>
          ) : rows.length === 0 ? (
            <div className="mx-2 flex flex-col items-center rounded-2xl bg-success-soft px-6 py-10 text-center">
              <span className="flex h-12 w-12 items-center justify-center rounded-full bg-card shadow-card">
                <PartyPopper className="h-6 w-6 text-success" />
              </span>
              <p className="mt-3 font-display font-semibold text-success">Everyone&apos;s in</p>
              <p className="mt-0.5 text-sm text-muted-foreground">Nobody is on leave during this period.</p>
            </div>
          ) : (
            <ul className={cn("space-y-1.5 px-1 transition-opacity", isFetching && "opacity-60")}>
              {rows.map((r) => {
                const colour = typeColor(r.type)
                return (
                  <li
                    key={r.id}
                    className="flex items-center gap-3 rounded-2xl bg-muted/50 px-3 py-2.5 transition-colors hover:bg-muted"
                  >
                    <Avatar name={r.employeeName} className="h-9 w-9 text-xs" />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-semibold">{r.employeeName}</p>
                      <p className="truncate text-xs text-muted-foreground">
                        {r.branch}
                        <span className="sm:hidden">
                          {" "}
                          · {r.type} · {formatDisplayRange(r.start, r.end)}
                        </span>
                      </p>
                    </div>
                    <div className="hidden shrink-0 flex-col items-end gap-1 sm:flex">
                      <span
                        className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-semibold"
                        style={{ backgroundColor: `${colour}1f`, color: colour }}
                      >
                        <span
                          className="h-1.5 w-1.5 shrink-0 rounded-full"
                          style={{ backgroundColor: colour }}
                          aria-hidden
                        />
                        {r.type}
                      </span>
                      <span className="whitespace-nowrap text-xs font-medium text-muted-foreground tabular">
                        {formatDisplayRange(r.start, r.end)}
                      </span>
                    </div>
                    <span
                      className="shrink-0 rounded-full border border-border/80 bg-card px-2.5 py-1 text-xs font-semibold tabular shadow-card"
                      aria-label={plural(r.duration, "day")}
                    >
                      {r.duration}d
                    </span>
                  </li>
                )
              })}
            </ul>
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}
