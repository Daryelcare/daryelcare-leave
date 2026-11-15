"use client"

import { useEffect, useState } from "react"
import { useQueryClient } from "@tanstack/react-query"
import { Check, Loader2 } from "lucide-react"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { DatePicker } from "@/components/ui/date-picker"
import { Label } from "@/components/ui/label"
import { useToast } from "@/components/ui/use-toast"
import { fetchWithAuth, handleApiError } from "@/lib/api-utils"
import { formatLocalDate } from "@/lib/dates"
import { PENDING_RECHECK_MONTHS, RTW_BASES, addMonthsUk, rtwBasisLabel, type RtwBasis } from "@/lib/rtw"
import type { TrackerDocument } from "@/lib/types"
import { cn } from "@/lib/utils"
import { plural } from "./page-kit"

// Time-limited permission needs each person's own end date, so it isn't offered here
const BULK_BASES = RTW_BASES.filter((b) => b.id !== "time_limited")

/**
 * Set how right to work is held for several people at once: British or Irish,
 * permanent permission, or pending applications checked on the same day.
 */
export function RtwBulkDialog({
  people,
  open,
  onOpenChange,
  initialBasis = null,
  onDone,
}: {
  people: TrackerDocument[]
  open: boolean
  onOpenChange: (open: boolean) => void
  initialBasis?: RtwBasis | null
  onDone?: () => void
}) {
  const { toast } = useToast()
  const queryClient = useQueryClient()
  const [basis, setBasis] = useState<RtwBasis | null>(initialBasis)
  const [checkedOn, setCheckedOn] = useState<Date | undefined>()
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    if (open) {
      setBasis(initialBasis)
      setCheckedOn(undefined)
    }
  }, [open, initialBasis])

  const withoutRecord = people.filter((p) => p.noRecord)
  const willSkip = basis && basis !== "british_irish" ? withoutRecord.length : 0
  const needsDate = basis === "pending_application"
  const recheck = needsDate && checkedOn ? addMonthsUk(formatLocalDate(checkedOn), PENDING_RECHECK_MONTHS) : null
  const canSave = !!basis && (!needsDate || !!checkedOn) && people.length > willSkip

  const submit = async () => {
    if (!basis || !canSave) return
    setBusy(true)
    try {
      const res: { updated: number; created: number; skipped: string[] } = await fetchWithAuth(
        "/api/documents/rtw-basis",
        {
          method: "POST",
          body: JSON.stringify({
            employeeIds: people.map((p) => p.employeeId),
            basis,
            checkedOn: checkedOn ? formatLocalDate(checkedOn) : null,
          }),
        },
      )
      const done = res.updated + res.created
      toast({
        title: `Right to work set for ${plural(done, "person", "people")}`,
        description:
          `${rtwBasisLabel(basis)}.` +
          (res.created ? ` ${plural(res.created, "new record", "new records")} added.` : "") +
          (res.skipped.length
            ? ` ${plural(res.skipped.length, "person", "people")} skipped: no documents on file yet (${res.skipped.slice(0, 3).join(", ")}${res.skipped.length > 3 ? "…" : ""}).`
            : ""),
      })
      for (const key of ["documents-tracker", "documents", "dashboard", "employees"]) {
        queryClient.invalidateQueries({ queryKey: [key] })
      }
      onDone?.()
      onOpenChange(false)
    } catch (error) {
      console.error("Couldn't set right to work:", error)
      toast({ title: "Couldn't save", description: handleApiError(error), variant: "destructive" })
    } finally {
      setBusy(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Set right to work</DialogTitle>
          <DialogDescription>
            How right to work is held for {plural(people.length, "person", "people")}. Time-limited permission needs
            each person&apos;s own end date, so set that from their record.
          </DialogDescription>
        </DialogHeader>

        <div role="radiogroup" aria-label="How right to work is held" className="grid gap-1.5">
          {BULK_BASES.map((b) => {
            const active = basis === b.id
            return (
              <button
                key={b.id}
                type="button"
                role="radio"
                aria-checked={active}
                onClick={() => setBasis(b.id)}
                className={cn(
                  "flex items-start gap-2.5 rounded-2xl p-3 text-left transition-colors",
                  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/70",
                  active ? "bg-primary text-primary-foreground" : "bg-background text-foreground hover:bg-secondary",
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
                <span>
                  <span className="block text-sm font-semibold leading-5">{b.label}</span>
                  <span className={cn("block text-xs", active ? "text-primary-foreground/85" : "text-muted-foreground")}>
                    {b.hint}
                  </span>
                </span>
              </button>
            )
          })}
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="rtw-bulk-checked">Date checked{needsDate ? "" : " (optional)"}</Label>
          <DatePicker id="rtw-bulk-checked" value={checkedOn} max={new Date()} onChange={setCheckedOn} />
          {recheck && <p className="text-xs font-semibold text-primary-text">Check again by {recheck}</p>}
        </div>

        {willSkip > 0 && (
          <p className="rounded-2xl bg-warning-soft px-3.5 py-2.5 text-xs text-warning">
            {plural(willSkip, "person has", "people have")} no documents on file yet and will be skipped. Add their
            record first.
          </p>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={busy}>
            Cancel
          </Button>
          <Button onClick={submit} disabled={!canSave || busy}>
            {busy && <Loader2 className="animate-spin" />}
            Save for {plural(people.length - willSkip, "person", "people")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
