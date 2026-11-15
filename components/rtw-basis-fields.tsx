"use client"

import { useQuery } from "@tanstack/react-query"
import { format } from "date-fns"
import { Check, Info } from "lucide-react"
import { DatePicker } from "@/components/ui/date-picker"
import { Label } from "@/components/ui/label"
import { fetchWithAuth } from "@/lib/api-utils"
import { RTW_BASES, isOneOff, rtwNextCheck, rtwProblem, type RtwBasis } from "@/lib/rtw"
import { cn } from "@/lib/utils"

export type RtwValue = {
  basis: RtwBasis | null
  /** When right to work was checked */
  checkedOn?: Date
  /** Permission end date (time-limited), or the plain expiry date while no basis is recorded */
  endDate?: Date
}

/** Whether "how it's held" can be saved yet (the one-off database update has been run) */
export function useRtwTracking() {
  const { data } = useQuery<{ available: boolean }>({
    queryKey: ["rtw-tracking"],
    queryFn: () => fetchWithAuth("/api/documents/rtw-basis"),
    staleTime: 5 * 60_000,
  })
  return data?.available ?? false
}

const uk = (d?: Date) => (d ? format(d, "dd/MM/yyyy") : null)

/** What a basis and its dates mean, in one line */
export function rtwSummary(v: RtwValue): { text: string; tone: "ok" | "info" | "todo" } | null {
  if (!v.basis) return null
  const problem = rtwProblem(v.basis, uk(v.checkedOn), uk(v.endDate))
  if (problem) return { text: problem, tone: "todo" }
  if (isOneOff(v.basis)) return { text: "No recheck needed: one check is enough", tone: "ok" }
  const next = rtwNextCheck(v.basis, uk(v.checkedOn), uk(v.endDate))
  return next ? { text: `Check again by ${next}`, tone: "info" } : null
}

/** The request fields for a right-to-work value */
export function rtwPayload(v: RtwValue, available: boolean): Record<string, string | null> {
  // Before the database update: the plain expiry date as always (left out when
  // empty, so it isn't cleared)
  if (!available) return v.endDate ? { rightToWorkExpiry: uk(v.endDate) } : {}
  // The basis is always sent, so clearing it is saved too. With no basis (or a
  // time-limited one) the date field is the expiry; otherwise it's worked out.
  return {
    rtwBasis: v.basis,
    rtwCheckedOn: v.basis ? uk(v.checkedOn) : null,
    rightToWorkExpiry: !v.basis || v.basis === "time_limited" ? uk(v.endDate) : null,
  }
}

/** A problem that should stop the form saving, or null */
export const rtwValueProblem = (v: RtwValue, available: boolean) =>
  available && v.basis ? rtwProblem(v.basis, uk(v.checkedOn), uk(v.endDate)) : null

/**
 * How right to work is held, the date it was checked, and (for time-limited
 * permission) when that permission ends. Until a basis is chosen, it's the
 * plain expiry date field it always was.
 */
export function RtwBasisFields({
  value,
  onChange,
  available,
  idPrefix = "rtw",
}: {
  value: RtwValue
  onChange: (v: RtwValue) => void
  available: boolean
  idPrefix?: string
}) {
  const today = new Date()
  const summary = rtwSummary(value)
  const showEnd = !available || !value.basis || value.basis === "time_limited"

  return (
    <div className="space-y-3">
      {available ? (
        <div role="radiogroup" aria-label="How right to work is held" className="grid gap-1.5 sm:grid-cols-2">
          {RTW_BASES.map((b) => {
            const active = value.basis === b.id
            return (
              <button
                key={b.id}
                type="button"
                role="radio"
                aria-checked={active}
                onClick={() => onChange({ ...value, basis: active ? null : b.id })}
                className={cn(
                  "flex items-start gap-2.5 rounded-2xl p-3 text-left transition-colors",
                  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/70",
                  active ? "bg-primary text-primary-foreground" : "bg-card text-foreground shadow-soft hover:shadow-soft-hover",
                )}
              >
                <span
                  className={cn(
                    "mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-full",
                    active ? "bg-white text-primary" : "ring-1 ring-inset ring-muted-foreground/50",
                  )}
                  aria-hidden
                >
                  {active && <Check className="h-3 w-3" strokeWidth={3} />}
                </span>
                <span className="min-w-0">
                  <span className="block text-sm font-semibold leading-5">{b.label}</span>
                  <span className={cn("block text-xs leading-4", active ? "text-primary-foreground/85" : "text-muted-foreground")}>
                    {b.hint}
                  </span>
                </span>
              </button>
            )
          })}
        </div>
      ) : (
        <p className="flex gap-2 text-xs text-muted-foreground">
          <Info className="mt-px h-3.5 w-3.5 shrink-0" />
          Recording how right to work is held (British, permanent, time-limited or pending) needs a one-off database
          update. Until then, enter the expiry date as before.
        </p>
      )}

      {(value.basis || showEnd) && (
        <div className="grid gap-3 sm:grid-cols-2">
          {available && value.basis && (
            <div className="space-y-1.5">
              <Label htmlFor={`${idPrefix}-checked`}>Date checked</Label>
              <DatePicker
                id={`${idPrefix}-checked`}
                value={value.checkedOn}
                max={today}
                onChange={(d) => onChange({ ...value, checkedOn: d })}
              />
            </div>
          )}
          {showEnd && (
            <div className="space-y-1.5">
              <Label htmlFor={`${idPrefix}-end`}>{value.basis === "time_limited" ? "Permission ends" : "Expiry date"}</Label>
              <DatePicker id={`${idPrefix}-end`} value={value.endDate} onChange={(d) => onChange({ ...value, endDate: d })} />
            </div>
          )}
        </div>
      )}

      {summary && (
        <p
          className={cn(
            "text-xs font-semibold",
            summary.tone === "ok" ? "text-success" : summary.tone === "todo" ? "text-warning" : "text-primary-text",
          )}
          aria-live="polite"
        >
          {summary.text}
        </p>
      )}
      {available && !value.basis && (
        <p className="text-xs text-muted-foreground">
          Choose how it&apos;s held to have the next check worked out. Without it, the expiry date is used as before.
        </p>
      )}
    </div>
  )
}

/** "dd/mm/yyyy" → Date, for filling the fields from a saved record */
export function ukToDate(value: string | null | undefined): Date | undefined {
  if (!value) return undefined
  const m = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(value)
  if (!m) return undefined
  const d = new Date(Number(m[3]), Number(m[2]) - 1, Number(m[1]))
  return Number.isNaN(d.getTime()) ? undefined : d
}

