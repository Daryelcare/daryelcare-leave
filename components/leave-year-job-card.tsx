"use client"

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { CheckCircle2, Clock, Loader2, RotateCw, TriangleAlert } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import { useToast } from "@/components/ui/use-toast"
import { fetchWithAuth, handleApiError } from "@/lib/api-utils"
import type { JobResult, JobRun } from "@/lib/leave-year-job"
import { cn } from "@/lib/utils"

type Status = { scheduled: boolean; recording: boolean; allowances: boolean; runs: JobRun[] }

/** "16/11/2026, 01:00" in UK time, whatever the browser's settings */
function when(isoTime: string) {
  const d = new Date(isoTime)
  if (Number.isNaN(d.getTime())) return isoTime
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Europe/London",
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).formatToParts(d)
  const get = (t: string) => parts.find((p) => p.type === t)?.value ?? ""
  return `${get("day")}/${get("month")}/${get("year")}, ${get("hour")}:${get("minute")}`
}

/**
 * The automatic leave year: what it does, whether it's switched on, the last
 * runs, and a button to run it now. Lives in Settings → Leave periods.
 */
export function LeaveYearJobCard() {
  const { toast } = useToast()
  const queryClient = useQueryClient()
  const { data, isLoading, isError, error } = useQuery<Status>({
    queryKey: ["leave-year-job"],
    queryFn: () => fetchWithAuth("/api/leave-year-job"),
  })

  const run = useMutation<JobResult>({
    mutationFn: () => fetchWithAuth("/api/leave-year-job", { method: "POST" }),
    onSuccess: (r) => {
      toast({ title: r.newYearStarted ? "New leave year started" : "Balances checked", description: r.message })
      for (const key of ["leave-year-job", "leavePeriods", "employees", "dashboard", "balance-check"]) {
        queryClient.invalidateQueries({ queryKey: [key] })
      }
    },
    onError: (e) => {
      console.error("Leave year check failed:", e)
      toast({ title: "Couldn't run the check", description: handleApiError(e), variant: "destructive" })
      queryClient.invalidateQueries({ queryKey: ["leave-year-job"] })
    },
  })

  const last = data?.runs[0]

  return (
    <div className="surface space-y-4 p-5 sm:p-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex gap-3">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-secondary text-secondary-foreground">
            <Clock className="h-[18px] w-[18px]" />
          </span>
          <div className="space-y-1">
            <h3 className="text-[15px] font-bold">Automatic leave year</h3>
            <p className="max-w-xl text-sm text-muted-foreground">
              Every night the next leave year starts by itself once the current one ends, and everyone&apos;s balance is
              brought in line with their allowance and the approved leave on record. Unused days don&apos;t carry over.
            </p>
          </div>
        </div>
        <Button variant="outline" className="shrink-0" onClick={() => run.mutate()} disabled={run.isPending}>
          {run.isPending ? <Loader2 className="animate-spin" /> : <RotateCw />}
          Run now
        </Button>
      </div>

      {isLoading ? (
        <Skeleton className="h-12 w-full rounded-2xl" />
      ) : isError ? (
        <p className="text-sm text-destructive">{handleApiError(error)}</p>
      ) : data ? (
        <div className="space-y-2">
          <StatusRow
            tone={data.scheduled ? "ok" : "todo"}
            text={
              data.scheduled
                ? "Runs every night at about 01:00."
                : "Not switched on yet: the nightly schedule needs one setting in Vercel (CRON_SECRET). You can still run it here."
            }
          />
          {!data.allowances && (
            <StatusRow
              tone="todo"
              text="Per-person allowances need a one-off database update. Until then everyone is counted on 28 days."
            />
          )}
          {last ? (
            <StatusRow
              tone={last.ok ? "ok" : "error"}
              text={`Last ${last.trigger === "manual" ? "run by hand" : "automatic run"}: ${when(last.ranAt)}. ${last.message ?? ""}`}
            />
          ) : (
            data.recording && <StatusRow tone="info" text="Hasn't run yet." />
          )}
          {data.runs.length > 1 && (
            <details className="rounded-2xl bg-background px-3.5 py-2.5 text-sm">
              <summary className="cursor-pointer font-semibold text-secondary-foreground">Earlier runs</summary>
              <ul className="mt-2 space-y-1.5 text-muted-foreground">
                {data.runs.slice(1).map((r) => (
                  <li key={r.ranAt}>
                    <span className="font-medium text-foreground tabular">{when(r.ranAt)}</span>
                    {r.trigger === "manual" ? " (by hand)" : ""} · {r.message}
                  </li>
                ))}
              </ul>
            </details>
          )}
        </div>
      ) : null}
    </div>
  )
}

function StatusRow({ tone, text }: { tone: "ok" | "todo" | "error" | "info"; text: string }) {
  const Icon = tone === "ok" ? CheckCircle2 : tone === "info" ? Clock : TriangleAlert
  return (
    <p
      className={cn(
        "flex items-start gap-2.5 rounded-2xl px-3.5 py-2.5 text-sm",
        tone === "ok" && "bg-success-soft text-success",
        tone === "todo" && "bg-warning-soft text-warning",
        tone === "error" && "bg-danger-soft text-destructive",
        tone === "info" && "bg-background text-muted-foreground",
      )}
    >
      <Icon className="mt-0.5 h-4 w-4 shrink-0" />
      <span>{text}</span>
    </p>
  )
}
