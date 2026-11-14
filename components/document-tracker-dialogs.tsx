"use client"

// The Documents page's two quick-edit dialogs, as in CarerHR's Document
// Tracker: change one document's expiry date from its cell, and mark one
// document type renewed for several people at once.

import { useEffect, useState } from "react"
import { useQueryClient } from "@tanstack/react-query"
import { Loader2 } from "lucide-react"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { DatePicker } from "@/components/ui/date-picker"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { useToast } from "@/components/ui/use-toast"
import { fetchWithAuth, handleApiError } from "@/lib/api-utils"
import { DAY_MS, formatLocalDate, localDateToUtc, todayUtc } from "@/lib/dates"
import { DOC_KINDS, daysLabel, entriesFor, type DocKind } from "@/lib/document-view"
import type { TrackerDocument } from "@/lib/types"
import { plural } from "./page-kit"

/** The API field for each document's expiry date */
export const EXPIRY_KEY: Record<DocKind, string> = {
  passport: "passportExpiry",
  rightToWork: "rightToWorkExpiry",
  brp: "brpExpiry",
  other: "otherDocumentExpiry",
}

const kindLabel = (kind: DocKind) => DOC_KINDS.find((k) => k.id === kind)!.label

/** Everything that shows documents, so a change appears everywhere at once */
export function useRefreshDocuments() {
  const queryClient = useQueryClient()
  return () => {
    for (const key of ["documents-tracker", "documents", "dashboard"]) {
      queryClient.invalidateQueries({ queryKey: [key] })
    }
  }
}

function parseUk(value: string | null | undefined): Date | undefined {
  const m = value?.match(/^(\d{2})\/(\d{2})\/(\d{4})$/)
  return m ? new Date(Number(m[3]), Number(m[2]) - 1, Number(m[1])) : undefined
}

const daysFromToday = (d: Date) => Math.round((localDateToUtc(d) - todayUtc()) / DAY_MS)

// ---------------------------------------------------------------- one cell

export function DocumentDateDialog({
  target,
  onOpenChange,
}: {
  target: { doc: TrackerDocument; kind: DocKind } | null
  onOpenChange: (open: boolean) => void
}) {
  const { toast } = useToast()
  const refresh = useRefreshDocuments()
  const [date, setDate] = useState<Date | undefined>()
  const [otherName, setOtherName] = useState("")
  const [busy, setBusy] = useState(false)

  const current = target ? entriesFor(target.doc, target.kind)[0] : undefined
  useEffect(() => {
    if (!target) return
    setDate(parseUk(current?.date))
    setOtherName(target.doc.otherDocumentType || "")
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [target])

  if (!target) return null
  const { doc, kind } = target
  const label = kind === "other" ? doc.otherDocumentType || "Other document" : kindLabel(kind)

  const save = async (value: Date | null) => {
    if (!doc.recordId) return
    setBusy(true)
    try {
      const body: Record<string, unknown> = { [EXPIRY_KEY[kind]]: value ? formatLocalDate(value) : null }
      if (kind === "other" && otherName.trim()) body.otherDocumentType = otherName.trim()
      await fetchWithAuth(`/api/documents/${doc.recordId}`, { method: "PUT", body: JSON.stringify(body) })
      toast({
        title: value ? `${label} updated` : `${label} date removed`,
        description: value
          ? `${doc.employeeName}'s ${label.toLowerCase()} now expires on ${formatLocalDate(value)}.`
          : `${doc.employeeName}'s ${label.toLowerCase()} has no expiry date recorded.`,
      })
      refresh()
      onOpenChange(false)
    } catch (error) {
      console.error("Couldn't save the document date:", error)
      toast({ title: "Couldn't save the date", description: handleApiError(error), variant: "destructive" })
    } finally {
      setBusy(false)
    }
  }

  return (
    <Dialog open onOpenChange={(o) => !busy && onOpenChange(o)}>
      <DialogContent className="sm:max-w-[420px]">
        <DialogHeader>
          <DialogTitle>{label}</DialogTitle>
          <DialogDescription>
            {doc.employeeName}
            {current ? ` · currently ${current.date}` : " · no expiry date recorded"}
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          {kind === "other" && (
            <div className="space-y-1.5">
              <Label htmlFor="doc-other-name">Document name</Label>
              <Input
                id="doc-other-name"
                value={otherName}
                onChange={(e) => setOtherName(e.target.value)}
                placeholder="For example: DBS certificate"
              />
            </div>
          )}
          <div className="space-y-1.5">
            <Label htmlFor="doc-expiry">Expiry date</Label>
            <DatePicker id="doc-expiry" value={date} onChange={setDate} />
            {date && <p className="text-xs text-muted-foreground">{daysLabel(daysFromToday(date))}</p>}
          </div>
        </div>
        <DialogFooter className="gap-2 sm:justify-between">
          {current ? (
            <Button
              variant="ghost"
              className="text-destructive hover:text-destructive"
              onClick={() => save(null)}
              disabled={busy}
            >
              Remove date
            </Button>
          ) : (
            <span />
          )}
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => onOpenChange(false)} disabled={busy}>
              Cancel
            </Button>
            <Button onClick={() => date && save(date)} disabled={busy || !date}>
              {busy && <Loader2 className="animate-spin" />}
              Save
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

// ---------------------------------------------------------------- many people

export function RenewDocumentsDialog({
  people,
  open,
  onOpenChange,
  onDone,
}: {
  people: TrackerDocument[]
  open: boolean
  onOpenChange: (open: boolean) => void
  onDone: () => void
}) {
  const { toast } = useToast()
  const refresh = useRefreshDocuments()
  const [kind, setKind] = useState<DocKind>("rightToWork")
  const [date, setDate] = useState<Date | undefined>()
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    if (open) setDate(undefined)
  }, [open])

  const withRecord = people.filter((p) => p.recordId)
  const skipped = people.length - withRecord.length
  const label = kindLabel(kind)

  const submit = async () => {
    if (!date || withRecord.length === 0) return
    setBusy(true)
    const value = formatLocalDate(date)
    const results = await Promise.allSettled(
      withRecord.map((p) =>
        fetchWithAuth(`/api/documents/${p.recordId}`, {
          method: "PUT",
          body: JSON.stringify({ [EXPIRY_KEY[kind]]: value }),
        }),
      ),
    )
    setBusy(false)
    refresh()
    const failed = results.filter((r) => r.status === "rejected") as PromiseRejectedResult[]
    const ok = results.length - failed.length
    if (ok > 0) {
      toast({
        title: `${label} renewed for ${plural(ok, "person", "people")}`,
        description:
          `New expiry date ${value}.` +
          (skipped > 0 ? ` ${plural(skipped, "person", "people")} skipped: no documents on file yet.` : ""),
      })
    }
    if (failed.length) {
      console.error(
        "Couldn't renew some documents:",
        failed.map((f) => f.reason),
      )
      toast({
        title: `${plural(failed.length, "record")} couldn't be updated`,
        description: handleApiError(failed[0].reason),
        variant: "destructive",
      })
    }
    if (failed.length === 0) {
      onOpenChange(false)
      onDone()
    }
  }

  return (
    <Dialog open={open} onOpenChange={(o) => !busy && onOpenChange(o)}>
      <DialogContent className="sm:max-w-[440px]">
        <DialogHeader>
          <DialogTitle>Mark renewed for {plural(people.length, "person", "people")}</DialogTitle>
          <DialogDescription>
            Sets one new expiry date on the chosen document for everyone selected. Whether it reads valid or expiring
            follows from the date.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="renew-kind">Document</Label>
            <Select value={kind} onValueChange={(v) => setKind(v as DocKind)}>
              <SelectTrigger id="renew-kind">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {DOC_KINDS.map((k) => (
                  <SelectItem key={k.id} value={k.id}>
                    {k.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="renew-date">New expiry date</Label>
            <DatePicker id="renew-date" value={date} onChange={setDate} min={new Date()} />
          </div>
          {skipped > 0 && (
            <p className="rounded-xl bg-muted/60 px-3.5 py-2.5 text-sm text-muted-foreground">
              {plural(skipped, "person has", "people have")} no documents on file, so they&apos;ll be skipped. Add their
              documents first.
            </p>
          )}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={busy}>
            Cancel
          </Button>
          <Button onClick={submit} disabled={busy || !date || withRecord.length === 0}>
            {busy && <Loader2 className="animate-spin" />}
            Mark renewed
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
