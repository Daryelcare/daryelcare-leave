"use client"

// Settings → Data health: what's wrong in the records, why it matters, and
// either a one-click tidy-up (confirmed first) or a link to deal with it.

import { useState } from "react"
import Link from "next/link"
import { useQuery, useQueryClient } from "@tanstack/react-query"
import { ArrowRight, CheckCircle2, Loader2, RefreshCw, Stethoscope } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { useToast } from "@/components/ui/use-toast"
import { fetchWithAuth, handleApiError } from "@/lib/api-utils"
import type { HealthCheck } from "@/lib/data-health"
import { cn } from "@/lib/utils"
import { EmptyState, ErrorState, ListSkeleton, SectionHeader, plural } from "./page-kit"

const SEVERITY: Record<HealthCheck["severity"], { label: string; variant: "destructive" | "warning" | "secondary" }> = {
  fix: { label: "Fix", variant: "warning" },
  review: { label: "Review", variant: "secondary" },
  info: { label: "Info", variant: "secondary" },
}

export function DataHealth() {
  const { toast } = useToast()
  const queryClient = useQueryClient()
  const [pending, setPending] = useState<HealthCheck | null>(null)
  const [running, setRunning] = useState(false)
  const { data, isLoading, isFetching, isError, error, refetch } = useQuery<{ people: number; checks: HealthCheck[] }>({
    queryKey: ["data-health"],
    queryFn: () => fetchWithAuth("/api/data-health"),
    retry: 1,
  })

  const problems = (data?.checks ?? []).filter((c) => c.count > 0 && c.severity !== "info")
  const fine = (data?.checks ?? []).filter((c) => c.count === 0 || c.severity === "info")

  const run = async () => {
    if (!pending?.action) return
    setRunning(true)
    try {
      const res = await fetchWithAuth("/api/data-health", {
        method: "POST",
        body: JSON.stringify({ action: pending.action.id }),
      })
      toast({ title: `${plural(res.changed, "record")} tidied`, description: pending.title })
      for (const key of ["data-health", "employees", "employee", "documents-tracker", "leaveRequests", "dashboard"]) {
        queryClient.invalidateQueries({ queryKey: [key] })
      }
      setPending(null)
    } catch (err) {
      console.error("Tidy-up failed:", err)
      toast({ title: "Couldn't finish the tidy-up", description: handleApiError(err), variant: "destructive" })
    } finally {
      setRunning(false)
    }
  }

  return (
    <div className="space-y-4">
      <SectionHeader
        title="Data health"
        description="Problems in your records that make screens, counts and reports wrong. Tidy-ups only change what they list, and ask first."
        actions={
          <Button variant="outline" onClick={() => refetch()} disabled={isFetching}>
            {isFetching ? <Loader2 className="animate-spin" /> : <RefreshCw />}
            Check again
          </Button>
        }
      />

      {isLoading ? (
        <div className="surface">
          <ListSkeleton rows={5} />
        </div>
      ) : isError ? (
        <ErrorState title="Couldn't check your data" message={handleApiError(error)} onRetry={() => refetch()} />
      ) : (
        <>
          {problems.length === 0 ? (
            <div className="surface">
              <EmptyState
                icon={CheckCircle2}
                title="Your records look healthy"
                description="Nothing needs fixing right now."
              />
            </div>
          ) : (
            <ul className="space-y-3" aria-label="Problems found">
              {problems.map((c) => (
                <li key={c.id} className="surface flex flex-col gap-3 p-4 sm:flex-row sm:items-start sm:p-5">
                  <div className="min-w-0 flex-1 space-y-1">
                    <p className="flex flex-wrap items-center gap-2">
                      <span className="font-semibold">{c.title}</span>
                      <Badge variant={SEVERITY[c.severity].variant} className="px-2 text-[11px] leading-[18px]">
                        {c.count}
                      </Badge>
                    </p>
                    <p className="text-sm text-muted-foreground">{c.detail}</p>
                    {c.examples && c.examples.length > 0 && (
                      <ul className="mt-1.5 space-y-0.5 text-xs text-muted-foreground">
                        {c.examples.map((x) => (
                          <li key={x} className="truncate">
                            · {x}
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                  <div className="flex shrink-0 flex-wrap gap-2">
                    {c.action && (
                      <Button size="sm" onClick={() => setPending(c)}>
                        {c.action.label}
                      </Button>
                    )}
                    {c.link && (
                      <Button size="sm" variant="outline" asChild>
                        <Link href={c.link.href}>
                          {c.link.label}
                          <ArrowRight />
                        </Link>
                      </Button>
                    )}
                  </div>
                </li>
              ))}
            </ul>
          )}

          {fine.length > 0 && (
            <div className="surface p-4 sm:p-5">
              <p className="mb-2 flex items-center gap-2 text-sm font-semibold">
                <Stethoscope className="h-4 w-4 text-muted-foreground" />
                Also checked
              </p>
              <ul className="grid gap-1.5 text-sm text-muted-foreground sm:grid-cols-2">
                {fine.map((c) => (
                  <li key={c.id} className={cn("flex items-start gap-2")}>
                    <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-success" />
                    <span>{c.count === 0 ? `${c.title}: none` : c.detail}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </>
      )}

      <AlertDialog open={!!pending} onOpenChange={(o) => !running && !o && setPending(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{pending?.action?.label}</AlertDialogTitle>
            <AlertDialogDescription>
              {pending?.action?.confirm} Nothing else changes, and you can check again afterwards.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={running}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => {
                e.preventDefault()
                run()
              }}
              disabled={running}
            >
              {running && <Loader2 className="animate-spin" />}
              {pending?.action?.label}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
