"use client"

import type React from "react"
import { useMemo, useRef, useState } from "react"
import { useQueryClient } from "@tanstack/react-query"
import { AlertCircle, ArrowLeft, CheckCircle, ChevronRight, FileSpreadsheet, Loader2, Upload, X } from "lucide-react"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Switch } from "@/components/ui/switch"
import { Label } from "@/components/ui/label"
import { useToast } from "@/components/ui/use-toast"
import { authHeaders, handleApiError } from "@/lib/api-utils"
import { cn } from "@/lib/utils"
import { TemplateDownload } from "./template-download"

interface ImportDocumentsModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
}

type Basis = "british_irish" | "indefinite" | "time_limited" | "pending_application"
type Rtw = { basis: Basis | null; checkedOn: string | null; expiry: string | null }
type Action = "update" | "create" | "clear" | "skip" | "error"
type PlanRow = {
  row: number
  code: string
  name: string
  branch: string | null
  action: Action
  problems: string[]
  notes: string[]
  rtwBefore: Rtw | null
  rtwAfter?: Rtw | null
  otherChanges: string[]
}
type Plan = { rows: PlanRow[]; counts: Record<Action, number>; missingCodeColumn: boolean }
type Result = {
  updated: number
  created: number
  cleared: number
  failed: number
  invalid: number
  errors?: { row: number; message: string }[]
}

const BASIS_LABEL: Record<Basis, string> = {
  british_irish: "British or Irish citizen",
  indefinite: "Permanent permission",
  time_limited: "Time-limited permission",
  pending_application: "Pending application",
}

const CHECK_TYPES: { type: string; examples: string; enter: string; due: string }[] = [
  { type: BASIS_LABEL.british_irish, examples: "British or Irish passport", enter: "Date Checked", due: "Never" },
  {
    type: BASIS_LABEL.indefinite,
    examples: "Indefinite leave to remain, EU settled status",
    enter: "Date Checked",
    due: "Never",
  },
  {
    type: BASIS_LABEL.time_limited,
    examples: "Visa, pre-settled status, eVisa or BRP with an end date",
    enter: "Date Checked and Right to Work Expiry",
    due: "On the expiry date",
  },
  {
    type: BASIS_LABEL.pending_application,
    examples: "Employer Checking Service result",
    enter: "Date Checked",
    due: "6 months after the check",
  },
]

type Filter = "all" | "changes" | "error"

/** "Time-limited · checked 05/11/2026 · next check 31/03/2028" */
function describe(r: Rtw | null | undefined) {
  if (!r || (!r.basis && !r.checkedOn && !r.expiry)) return null
  const parts = [r.basis ? BASIS_LABEL[r.basis] : "No check type"]
  if (r.checkedOn) parts.push(`checked ${r.checkedOn}`)
  parts.push(r.expiry ? `next check ${r.expiry}` : r.basis ? "never due again" : "no date")
  return parts.join(" · ")
}

const ACTION_PILL: Record<Action, { label: string; className: string }> = {
  update: { label: "Update", className: "bg-primary-soft text-primary-text" },
  create: { label: "New record", className: "bg-primary-soft text-primary-text" },
  clear: { label: "Cleared", className: "bg-warning-soft text-warning" },
  skip: { label: "No change", className: "bg-secondary text-muted-foreground" },
  error: { label: "Problem", className: "bg-destructive-soft text-destructive" },
}

/**
 * Import documents, mainly right to work checks, from the template. Three
 * steps: download the template, fill it in, upload. The preview shows every
 * person's change (before → after) and any problems before anything is saved.
 */
export function ImportDocumentsModal({ open, onOpenChange }: ImportDocumentsModalProps) {
  const [file, setFile] = useState<File | null>(null)
  const [dragActive, setDragActive] = useState(false)
  const [plan, setPlan] = useState<Plan | null>(null)
  const [result, setResult] = useState<Result | null>(null)
  const [busy, setBusy] = useState<"preview" | "import" | "template" | null>(null)
  const [skipProblems, setSkipProblems] = useState(true)
  const [filter, setFilter] = useState<Filter>("all")
  const inputRef = useRef<HTMLInputElement>(null)
  const { toast } = useToast()
  const queryClient = useQueryClient()

  const reset = () => {
    setFile(null)
    setPlan(null)
    setResult(null)
    setFilter("all")
    setSkipProblems(true)
  }
  const close = () => {
    if (busy === "import") return
    reset()
    onOpenChange(false)
  }

  const pick = (files: FileList | null) => {
    const f = files?.[0]
    if (!f) return
    if (!/\.(csv|xlsx|xls)$/i.test(f.name)) {
      toast({
        title: "That isn't a spreadsheet",
        description: "Choose the template saved as Excel (.xlsx) or CSV.",
        variant: "destructive",
      })
      return
    }
    if (f.size > 5 * 1024 * 1024) {
      toast({ title: "File too large", description: "Choose a file smaller than 5MB.", variant: "destructive" })
      return
    }
    setFile(f)
    setPlan(null)
    setResult(null)
  }

  const onDrag = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault()
    e.stopPropagation()
    setDragActive(e.type === "dragenter" || e.type === "dragover")
  }

  const post = async (url: string, extra?: Record<string, string>) => {
    const form = new FormData()
    form.append("file", file as File)
    for (const [k, v] of Object.entries(extra ?? {})) form.append(k, v)
    const res = await fetch(url, { method: "POST", headers: await authHeaders(), body: form })
    const body = await res.json().catch(() => ({}))
    if (!res.ok) throw new Error(body.error || "Something went wrong")
    return body
  }

  const preview = async () => {
    if (!file) return
    setBusy("preview")
    try {
      const p = (await post("/api/import/documents/preview")) as Plan
      setPlan(p)
      setFilter(p.counts.error > 0 ? "error" : "all")
    } catch (error) {
      console.error("Document import preview failed:", error)
      toast({ title: "Couldn't read the file", description: handleApiError(error), variant: "destructive" })
    } finally {
      setBusy(null)
    }
  }

  const runImport = async () => {
    if (!file) return
    setBusy("import")
    try {
      const r = (await post("/api/import/documents", { skipInvalid: String(skipProblems) })) as Result
      setResult(r)
      queryClient.invalidateQueries({ queryKey: ["documents"] })
      queryClient.invalidateQueries({ queryKey: ["documents-tracker"] })
      queryClient.invalidateQueries({ queryKey: ["employees"] })
      toast({ title: "Import finished", description: `${r.updated + r.created + r.cleared} people updated.` })
    } catch (error) {
      console.error("Document import failed:", error)
      toast({ title: "Import failed", description: handleApiError(error), variant: "destructive" })
    } finally {
      setBusy(null)
    }
  }

  const downloadTemplate = async (format: "excel" | "csv") => {
    setBusy("template")
    try {
      const res = await fetch(`/api/templates/document-import?format=${format}`, { headers: await authHeaders() })
      if (!res.ok) throw new Error("Couldn't download the template")
      const url = URL.createObjectURL(await res.blob())
      const a = document.createElement("a")
      a.href = url
      a.download = `right-to-work-import-template.${format === "csv" ? "csv" : "xlsx"}`
      document.body.appendChild(a)
      a.click()
      a.remove()
      URL.revokeObjectURL(url)
    } catch (error) {
      console.error("Template download failed:", error)
      toast({ title: "Download failed", description: handleApiError(error), variant: "destructive" })
    } finally {
      setBusy(null)
    }
  }

  const counts = plan?.counts
  const changes = counts ? counts.update + counts.create + counts.clear : 0
  const shown = useMemo(() => {
    const rows = plan?.rows ?? []
    if (filter === "error") return rows.filter((r) => r.action === "error")
    if (filter === "changes") return rows.filter((r) => r.action !== "skip" && r.action !== "error")
    return rows
  }, [plan, filter])
  const blocked = !!counts && counts.error > 0 && !skipProblems

  return (
    <Dialog open={open} onOpenChange={(o) => (o ? onOpenChange(true) : close())}>
      <DialogContent className={cn("max-h-[92dvh] overflow-y-auto", plan ? "sm:max-w-5xl" : "sm:max-w-xl")}>
        <DialogHeader>
          <DialogTitle>
            {result ? "Import finished" : plan ? "Check the changes" : "Import right to work checks"}
          </DialogTitle>
          <DialogDescription>
            {result
              ? "Here's what was saved."
              : plan
                ? `Nothing has been saved yet. This is what importing ${file?.name} will do, person by person.`
                : "Update many people's right to work checks at once from a spreadsheet."}
          </DialogDescription>
        </DialogHeader>

        {result ? (
          <ResultView result={result} />
        ) : plan && counts ? (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-5">
              <Tile label="Will be updated" value={counts.update} />
              <Tile label="New records" value={counts.create} />
              <Tile label="Cleared" value={counts.clear} tone={counts.clear ? "warning" : undefined} />
              <Tile label="No change" value={counts.skip} />
              <Tile label="Problems" value={counts.error} tone={counts.error ? "danger" : undefined} />
            </div>

            {plan.missingCodeColumn && (
              <Notice tone="danger">
                The file has no <strong>Employee Code</strong> column. People are matched by their code, so use the
                template&apos;s columns.
              </Notice>
            )}
            {counts.error > 0 && (
              <Notice tone="danger">
                <span className="block font-semibold">
                  {counts.error} row{counts.error === 1 ? " has a problem" : "s have problems"}.
                </span>
                Fix {counts.error === 1 ? "it" : "them"} in the spreadsheet and upload it again, or skip{" "}
                {counts.error === 1 ? "it" : "them"} and import the rest.
                <span className="mt-2 flex items-center gap-2.5">
                  <Switch id="skip-problems" checked={skipProblems} onCheckedChange={setSkipProblems} />
                  <Label htmlFor="skip-problems" className="text-sm font-medium text-foreground">
                    Skip the rows with problems
                  </Label>
                </span>
              </Notice>
            )}
            {counts.clear > 0 && (
              <Notice tone="warning">
                {counts.clear} {counts.clear === 1 ? "person has" : "people have"} no right to work details in the file,
                so their current check will be <strong>cleared</strong>. Remove those rows from the file if you
                don&apos;t want that.
              </Notice>
            )}

            <div
              role="tablist"
              aria-label="Show"
              className="inline-flex gap-[3px] rounded-full bg-card p-1 shadow-soft"
            >
              {(
                [
                  ["all", `All rows (${plan.rows.length})`],
                  ["changes", `Changes (${changes})`],
                  ["error", `Problems (${counts.error})`],
                ] as [Filter, string][]
              ).map(([id, label]) => (
                <button
                  key={id}
                  type="button"
                  role="tab"
                  aria-selected={filter === id}
                  onClick={() => setFilter(id)}
                  className={cn(
                    "h-8 rounded-full px-3.5 text-xs font-bold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/70",
                    filter === id
                      ? "bg-primary text-primary-foreground"
                      : "text-muted-foreground hover:text-foreground",
                  )}
                >
                  {label}
                </button>
              ))}
            </div>

            <ul className="flex max-h-[44dvh] flex-col gap-1.5 overflow-y-auto pr-1" aria-label="Rows in the file">
              {shown.length === 0 && (
                <li className="rounded-2xl bg-background px-4 py-6 text-center text-sm text-muted-foreground">
                  Nothing to show here.
                </li>
              )}
              {shown.map((r) => (
                <li key={r.row} className="rounded-2xl bg-background px-4 py-3 text-sm">
                  <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                    <span className="w-14 shrink-0 text-xs text-muted-foreground">Row {r.row}</span>
                    <span className="min-w-0 flex-1 font-semibold">
                      {r.name || "—"}
                      <span className="ml-2 text-xs font-normal text-muted-foreground">
                        #{r.code || "no code"}
                        {r.branch ? ` · ${r.branch}` : ""}
                      </span>
                    </span>
                    <span
                      className={cn("rounded-full px-2.5 py-0.5 text-xs font-bold", ACTION_PILL[r.action].className)}
                    >
                      {ACTION_PILL[r.action].label}
                    </span>
                  </div>
                  <div className="mt-1.5 space-y-1 pl-0 sm:pl-[68px]">
                    {r.rtwAfter !== undefined && (
                      <p className="text-[13px]">
                        <span className="text-muted-foreground">Right to work: </span>
                        <span className="text-muted-foreground line-through decoration-muted-foreground/50">
                          {describe(r.rtwBefore) ?? "nothing recorded"}
                        </span>
                        <span className="px-1.5 text-muted-foreground">→</span>
                        <span className="font-medium">{describe(r.rtwAfter) ?? "cleared"}</span>
                      </p>
                    )}
                    {r.action === "skip" && r.rtwBefore && (
                      <p className="text-[13px] text-muted-foreground">
                        Already saved: {describe(r.rtwBefore) ?? "nothing recorded"}
                      </p>
                    )}
                    {r.otherChanges.length > 0 && <p className="text-[13px]">{r.otherChanges.join(" · ")}</p>}
                    {r.problems.map((p) => (
                      <p key={p} className="flex gap-1.5 text-[13px] font-medium text-destructive">
                        <AlertCircle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                        {p}
                      </p>
                    ))}
                    {r.notes.map((n) => (
                      <p key={n} className="text-xs text-muted-foreground">
                        {n}
                      </p>
                    ))}
                  </div>
                </li>
              ))}
            </ul>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl bg-background px-4 py-3">
              <div className="min-w-0">
                <p className="text-sm font-semibold">Start from the template</p>
                <p className="text-xs text-muted-foreground">One row per person, matched by Employee Code.</p>
              </div>
              <TemplateDownload onDownload={downloadTemplate} busy={busy === "template"} />
            </div>
            <div
              className={cn(
                "rounded-2xl border-2 border-dashed p-6 text-center transition-colors",
                dragActive ? "border-primary bg-primary-soft/60" : "border-border hover:border-foreground/20",
              )}
              onDragEnter={onDrag}
              onDragOver={onDrag}
              onDragLeave={onDrag}
              onDrop={(e) => {
                onDrag(e)
                setDragActive(false)
                pick(e.dataTransfer.files)
              }}
            >
              <input
                ref={inputRef}
                type="file"
                accept=".csv,.xls,.xlsx"
                className="hidden"
                onChange={(e) => pick(e.target.files)}
                aria-label="Choose a file"
              />
              {file ? (
                <div className="flex items-center justify-center gap-2">
                  <FileSpreadsheet className="h-5 w-5 text-muted-foreground" />
                  <span className="font-medium">{file.name}</span>
                  <span className="text-xs text-muted-foreground">{(file.size / 1024).toFixed(0)} KB</span>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7 rounded-full"
                    onClick={() => setFile(null)}
                    aria-label="Remove file"
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </div>
              ) : (
                <div className="flex flex-col items-center gap-1.5">
                  <Upload className="h-5 w-5 text-muted-foreground" />
                  <p className="text-sm font-medium">
                    Drag the filled-in template here, or{" "}
                    <button
                      type="button"
                      className="text-primary-text hover:underline focus:outline-none"
                      onClick={() => inputRef.current?.click()}
                    >
                      choose a file
                    </button>
                  </p>
                  <p className="text-xs text-muted-foreground">Excel or CSV, up to 5MB</p>
                </div>
              )}
            </div>
            <p className="text-xs text-muted-foreground">
              Nothing is saved until you&apos;ve checked the changes and pressed Import.
            </p>

            <details className="group rounded-2xl bg-background px-4 py-3 text-sm">
              <summary className="cursor-pointer list-none font-semibold outline-none focus-visible:ring-2 focus-visible:ring-primary/70 [&::-webkit-details-marker]:hidden">
                <span className="inline-flex items-center gap-1.5">
                  <ChevronRight className="h-4 w-4 text-muted-foreground transition-transform group-open:rotate-90" />
                  How to fill it in
                </span>
              </summary>
              <div className="mt-3 space-y-3 text-muted-foreground">
                <p>
                  Pick a <strong className="text-foreground">Check Type</strong>; it decides which dates you need. Dates
                  are dd/mm/yyyy.
                </p>
                <ul className="flex flex-col gap-1.5">
                  {CHECK_TYPES.map((t) => (
                    <li key={t.type} className="rounded-xl bg-card px-3 py-2">
                      <span className="block font-semibold text-foreground">{t.type}</span>
                      <span className="block text-xs">
                        {t.examples} · fill in {t.enter} · next check: {t.due.toLowerCase()}
                      </span>
                    </li>
                  ))}
                </ul>
                <ul className="list-disc space-y-1 pl-5">
                  <li>All three right to work cells empty clears that person&apos;s current check.</li>
                  <li>is_sponsored and is_20_hrs: yes or no; empty counts as no.</li>
                  <li>Status and Country are optional; empty keeps what&apos;s saved.</li>
                  <li>Delete the sample rows before importing.</li>
                </ul>
              </div>
            </details>
          </div>
        )}

        <DialogFooter className="gap-2 sm:justify-between">
          {plan && !result ? (
            <Button variant="outline" onClick={() => setPlan(null)} disabled={busy === "import"} className="gap-2">
              <ArrowLeft className="h-4 w-4" />
              Choose another file
            </Button>
          ) : (
            <span />
          )}
          <div className="flex gap-2">
            <Button variant="outline" onClick={close} disabled={busy === "import"}>
              {result ? "Close" : "Cancel"}
            </Button>
            {!result &&
              (plan ? (
                <Button onClick={runImport} disabled={busy === "import" || blocked || changes === 0}>
                  {busy === "import" && <Loader2 className="animate-spin" />}
                  {changes === 0 ? "Nothing to import" : `Import ${changes} change${changes === 1 ? "" : "s"}`}
                </Button>
              ) : (
                <Button onClick={preview} disabled={!file || busy === "preview"}>
                  {busy === "preview" && <Loader2 className="animate-spin" />}
                  Check the changes
                </Button>
              ))}
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

function Tile({ label, value, tone }: { label: string; value: number; tone?: "warning" | "danger" }) {
  return (
    <div className="rounded-2xl bg-background px-3.5 py-2.5">
      <span
        className={cn(
          "block text-xl font-extrabold tabular",
          tone === "danger" && "text-destructive",
          tone === "warning" && "text-warning",
        )}
      >
        {value}
      </span>
      <span className="block text-xs text-muted-foreground">{label}</span>
    </div>
  )
}

function Notice({ tone, children }: { tone: "warning" | "danger"; children: React.ReactNode }) {
  return (
    <div
      className={cn(
        "rounded-2xl px-4 py-3 text-sm",
        tone === "danger" ? "bg-destructive-soft text-destructive" : "bg-warning-soft text-warning",
      )}
    >
      {children}
    </div>
  )
}

function ResultView({ result }: { result: Result }) {
  return (
    <div className="space-y-3">
      <div className="flex gap-2.5 rounded-2xl bg-success-soft px-4 py-3 text-sm text-success">
        <CheckCircle className="mt-0.5 h-4 w-4 shrink-0" />
        <span>
          {result.updated} updated, {result.created} new record{result.created === 1 ? "" : "s"}, {result.cleared}{" "}
          cleared.
          {result.invalid > 0 && ` ${result.invalid} row${result.invalid === 1 ? "" : "s"} with problems skipped.`}
        </span>
      </div>
      {result.failed > 0 && (
        <div className="rounded-2xl bg-destructive-soft px-4 py-3 text-sm text-destructive">
          {result.failed} row{result.failed === 1 ? "" : "s"} couldn&apos;t be saved. Try importing the file again.
        </div>
      )}
      {result.errors && result.errors.length > 0 && (
        <div className="rounded-2xl bg-background px-4 py-3 text-sm">
          <p className="mb-1 font-semibold">Skipped rows</p>
          <ul className="max-h-40 space-y-0.5 overflow-y-auto text-muted-foreground">
            {result.errors.map((e) => (
              <li key={e.row}>
                Row {e.row}: {e.message}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  )
}
