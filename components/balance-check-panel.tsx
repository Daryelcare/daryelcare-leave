"use client"

// Settings → Leave periods: compare everyone's stored leave balance with the one
// worked out from their approved leave this leave year, and repair it in one go.
// Nothing changes until the admin confirms; the preview can be downloaded first.

import { useState } from "react"
import { useQuery, useQueryClient } from "@tanstack/react-query"
import { AlertTriangle, Download, Loader2, RefreshCw, Scale } from "lucide-react"
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
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { useToast } from "@/components/ui/use-toast"
import { fetchWithAuth, handleApiError } from "@/lib/api-utils"
import { paginate, type PageSize } from "@/lib/pagination"
import type { BalanceRow } from "@/lib/balances"
import { cn } from "@/lib/utils"
import { EmptyState, ErrorState, ListSkeleton, SectionHeader, StatCard, plural } from "./page-kit"
import { TablePagination } from "./table-pagination"

type Check = {
  year: { label: string; range: string }
  summary: { people: number; changed: number; negative: number; low: number; suspicious: number; daysUsed: number }
  rows: BalanceRow[]
}

const csvCell = (v: unknown) => {
  const t = v === null || v === undefined ? "" : String(v)
  return /[",\n]/.test(t) ? `"${t.replace(/"/g, '""')}"` : t
}

export function BalanceCheckPanel() {
  const { toast } = useToast()
  const queryClient = useQueryClient()
  const [asked, setAsked] = useState(false)
  const [showAll, setShowAll] = useState(false)
  const [confirm, setConfirm] = useState(false)
  const [applying, setApplying] = useState(false)
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState<PageSize>(50)

  const { data, isFetching, isError, error, refetch } = useQuery<Check>({
    queryKey: ["balance-check"],
    queryFn: () => fetchWithAuth("/api/leave-allocations/recalculate"),
    enabled: asked,
    staleTime: 0,
  })

  const rows = data ? (showAll ? data.rows : data.rows.filter((r) => r.changed)) : []
  const paged = paginate(rows, page, pageSize)

  const download = () => {
    if (!data) return
    const header = [
      "Employee",
      "Branch",
      "Stored taken",
      "Stored remaining",
      "Days used this year",
      "Should be remaining",
      "Leave entries",
      "Check",
    ]
    const lines = data.rows.map((r) =>
      [
        r.name,
        r.branch,
        r.daysTaken,
        r.daysRemaining,
        r.taken,
        r.remaining,
        r.entries,
        r.suspicious ? "Check entries" : "",
      ]
        .map(csvCell)
        .join(","),
    )
    const blob = new Blob(["﻿" + [header.join(","), ...lines].join("\r\n")], { type: "text/csv;charset=utf-8" })
    const url = URL.createObjectURL(blob)
    const a = Object.assign(document.createElement("a"), {
      href: url,
      download: `leave-balance-check-${data.year.label.replace("/", "-")}.csv`,
    })
    document.body.appendChild(a)
    a.click()
    a.remove()
    URL.revokeObjectURL(url)
  }

  const apply = async () => {
    setApplying(true)
    try {
      const result = await fetchWithAuth("/api/leave-allocations/recalculate", { method: "POST" })
      toast({
        title: result.changed ? `${plural(result.changed, "balance")} updated` : "Balances already match",
        description: `Balances for ${result.year} now come from the approved leave on record.`,
      })
      for (const key of ["employees", "employee", "dashboard", "balance-check", "leaveRequests", "leaveRequestsAll"]) {
        queryClient.invalidateQueries({ queryKey: [key] })
      }
      setConfirm(false)
    } catch (err) {
      console.error("Couldn't update balances:", err)
      toast({ title: "Couldn't update the balances", description: handleApiError(err), variant: "destructive" })
    } finally {
      setApplying(false)
    }
  }

  return (
    <div className="space-y-4">
      <SectionHeader
        title="Check balances"
        description="Compares each person's balance with the approved annual leave on record for this leave year (28 days each). Nothing changes until you confirm."
        actions={
          <Button variant="outline" onClick={() => (asked ? refetch() : setAsked(true))} disabled={isFetching}>
            {isFetching ? <Loader2 className="animate-spin" /> : <RefreshCw />}
            {asked ? "Check again" : "Check balances"}
          </Button>
        }
      />

      {!asked ? null : isFetching && !data ? (
        <div className="surface">
          <ListSkeleton rows={4} />
        </div>
      ) : isError ? (
        <ErrorState title="Couldn't check the balances" message={handleApiError(error)} onRetry={() => refetch()} />
      ) : data ? (
        <>
          <div className="tile-tray grid-cols-2 lg:grid-cols-4">
            <StatCard
              label="Need correcting"
              icon={Scale}
              value={data.summary.changed}
              detail={`of ${plural(data.summary.people, "current employee")}`}
              tone={data.summary.changed > 0 ? "warning" : "default"}
            />
            <StatCard
              label="Would be below zero"
              icon={AlertTriangle}
              value={data.summary.negative}
              detail="Used more than 28 days"
              tone={data.summary.negative > 0 ? "danger" : "default"}
            />
            <StatCard
              label="5 days or fewer left"
              value={data.summary.low}
              detail="After the correction"
              tone={data.summary.low > 0 ? "warning" : "default"}
            />
            <StatCard label="Days used" value={data.summary.daysUsed} detail={`Annual leave in ${data.year.label}`} />
          </div>

          {data.summary.suspicious > 0 && (
            <p className="flex items-start gap-2 rounded-xl bg-warning-soft px-4 py-3 text-sm text-warning">
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
              {plural(data.summary.suspicious, "person has", "people have")} more than 56 days of annual leave this
              year, which is usually a duplicate or mistyped entry. Check their leave before correcting.
            </p>
          )}

          <div className="surface overflow-hidden">
            <div className="flex flex-wrap items-center gap-2 px-4 py-3 text-sm sm:px-5">
              <span className="mr-auto text-muted-foreground">
                {data.year.range} ·{" "}
                {showAll
                  ? `everyone (${data.rows.length})`
                  : `${plural(data.summary.changed, "person", "people")} to correct`}
              </span>
              <Button
                size="sm"
                variant="ghost"
                onClick={() => {
                  setShowAll((v) => !v)
                  setPage(1)
                }}
              >
                {showAll ? "Only changes" : "Show everyone"}
              </Button>
              <Button size="sm" variant="outline" onClick={download}>
                <Download />
                Download preview
              </Button>
              <Button size="sm" onClick={() => setConfirm(true)} disabled={data.summary.changed === 0}>
                Correct {plural(data.summary.changed, "balance")}
              </Button>
            </div>
            {rows.length === 0 ? (
              <EmptyState
                icon={Scale}
                title="Every balance matches"
                description="Stored balances agree with the leave on record."
              />
            ) : (
              <>
                <Table>
                  <TableHeader>
                    <TableRow className="hover:bg-transparent">
                      <TableHead>Employee</TableHead>
                      <TableHead className="text-right">Now shows</TableHead>
                      <TableHead className="text-right">Days used</TableHead>
                      <TableHead className="text-right">Should show</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {paged.items.map((r) => (
                      <TableRow key={r.id}>
                        <TableCell>
                          <p className="font-semibold">{r.name}</p>
                          <p className="text-xs text-muted-foreground">
                            {r.branch} · {plural(r.entries, "entry", "entries")}
                            {r.suspicious && (
                              <Badge variant="warning" className="ml-2 px-2 text-[11px] leading-[18px]">
                                Check entries
                              </Badge>
                            )}
                          </p>
                        </TableCell>
                        <TableCell className="text-right tabular text-muted-foreground">
                          {r.daysRemaining} left
                        </TableCell>
                        <TableCell className="text-right tabular">{r.taken}</TableCell>
                        <TableCell
                          className={cn("text-right font-semibold tabular", r.remaining < 0 && "text-destructive")}
                        >
                          {r.remaining} left
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
                <TablePagination
                  page={paged.page}
                  pages={paged.pages}
                  from={paged.from}
                  to={paged.to}
                  total={rows.length}
                  pageSize={pageSize}
                  label={rows.length === 1 ? "person" : "people"}
                  onPageChange={setPage}
                  onPageSizeChange={(s) => {
                    setPageSize(s)
                    setPage(1)
                  }}
                />
              </>
            )}
          </div>
        </>
      ) : null}

      <AlertDialog open={confirm} onOpenChange={(o) => !applying && setConfirm(o)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Correct {data ? plural(data.summary.changed, "balance") : "balances"}?</AlertDialogTitle>
            <AlertDialogDescription>
              Each person&apos;s days taken and days left will be set from their approved annual leave in{" "}
              {data?.year.label}. Leave entries themselves don&apos;t change. You can run the check again at any time.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={applying}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => {
                e.preventDefault()
                apply()
              }}
              disabled={applying}
            >
              {applying && <Loader2 className="animate-spin" />}
              Correct balances
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
