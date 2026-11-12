"use client"

import { useState, type ReactNode } from "react"
import Link from "next/link"
import { useQuery } from "@tanstack/react-query"
import { AlertTriangle, CalendarDays, CalendarRange, FileWarning, Plane, Scale } from "lucide-react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { useApp } from "./app-provider"
import { useBranches } from "@/hooks/use-branches"
import { useLeaveTypes } from "@/hooks/use-leave-types"
import { fetchWithAuth, handleApiError } from "@/lib/api-utils"
import { parseDateToUtc } from "@/lib/dates"
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

type BalanceEntry = { id: string; name: string; branch: string; daysRemaining: number; daysTaken: number }

type DocumentEntry = {
  id: string
  employeeName: string
  branch: string
  document: string
  expiry: string
  daysLeft: number
  isSponsored: boolean
}

type DashboardData = {
  today: string
  weekStart: string
  weekEnd: string
  offToday: LeaveEntry[]
  offThisWeek: LeaveEntry[]
  balances: { lowThreshold: number; negative: BalanceEntry[]; low: BalanceEntry[] }
  documents: { warningDays: number; expired: DocumentEntry[]; expiringSoon: DocumentEntry[] } | null
}

const LIST_LIMIT = 8

function formatDay(iso: string) {
  const time = parseDateToUtc(iso)
  if (time === null) return iso
  return new Date(time).toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short", timeZone: "UTC" })
}

function formatRange(entry: LeaveEntry) {
  return entry.start === entry.end ? formatDay(entry.start) : `${formatDay(entry.start)} – ${formatDay(entry.end)}`
}

export function DashboardHome() {
  const { user } = useApp()
  const isAdmin = user?.role === "admin"
  const myBranches = user?.branches || []
  const [branch, setBranch] = useState<string>("all")
  const { data: allBranches = [] } = useBranches()
  const { data: leaveTypes = [] } = useLeaveTypes()

  const branchOptions = isAdmin ? allBranches.map((b) => b.name) : myBranches
  const showBranchPicker = branchOptions.length > 1

  const { data, isLoading, isError, error, refetch } = useQuery<DashboardData>({
    queryKey: ["dashboard", branch],
    queryFn: () => fetchWithAuth(`/api/dashboard?branch=${encodeURIComponent(branch)}`),
    enabled: !!user,
    refetchInterval: 5 * 60 * 1000,
  })

  const typeColor = (type: string) => leaveTypes.find((t) => t.name === type)?.color || "#6366f1"

  const peopleOffThisWeek = new Set(data?.offThisWeek.map((l) => l.employeeId)).size
  const documentProblems = data?.documents ? data.documents.expired.length + data.documents.expiringSoon.length : 0
  const balanceProblems = data ? data.balances.negative.length + data.balances.low.length : 0

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Dashboard</h1>
          <p className="text-muted-foreground">
            {data
              ? `Today is ${new Date(parseDateToUtc(data.today) ?? Date.now()).toLocaleDateString("en-GB", {
                  weekday: "long",
                  day: "numeric",
                  month: "long",
                  year: "numeric",
                  timeZone: "UTC",
                })}`
              : "Who's off, documents to renew and leave balances to watch"}
          </p>
        </div>
        <div className="flex items-center gap-2">
          {showBranchPicker && (
            <Select value={branch} onValueChange={setBranch}>
              <SelectTrigger className="w-[200px]" aria-label="Branch">
                <SelectValue placeholder="All branches" />
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
          )}
          <Button asChild variant="outline">
            <Link href="/dashboard/calendar">
              <CalendarRange className="mr-2 h-4 w-4" />
              Team calendar
            </Link>
          </Button>
        </div>
      </div>

      {isError && (
        <div className="rounded-md bg-destructive/15 p-4 text-destructive">
          <p className="font-medium">Couldn&apos;t load the dashboard</p>
          <p className="text-sm">{handleApiError(error)}</p>
          <Button variant="outline" size="sm" onClick={() => refetch()} className="mt-2">
            Try again
          </Button>
        </div>
      )}

      {/* Headline numbers */}
      <div className={cn("grid gap-4 sm:grid-cols-2", isAdmin ? "lg:grid-cols-4" : "lg:grid-cols-3")}>
        <StatCard
          title="Off today"
          icon={Plane}
          loading={isLoading}
          value={data?.offToday.length}
          detail={data ? (data.offToday.length === 1 ? "person on leave" : "people on leave") : ""}
        />
        <StatCard
          title="Off this week"
          icon={CalendarDays}
          loading={isLoading}
          value={peopleOffThisWeek}
          detail={data ? `${formatDay(data.weekStart)} – ${formatDay(data.weekEnd)}` : ""}
        />
        {isAdmin && (
          <StatCard
            title="Documents to act on"
            icon={FileWarning}
            loading={isLoading}
            value={documentProblems}
            tone={data?.documents?.expired.length ? "danger" : documentProblems ? "warning" : undefined}
            detail={
              data?.documents
                ? `${data.documents.expired.length} expired · ${data.documents.expiringSoon.length} within ${data.documents.warningDays} days`
                : ""
            }
          />
        )}
        <StatCard
          title="Leave balance warnings"
          icon={Scale}
          loading={isLoading}
          value={balanceProblems}
          tone={data?.balances.negative.length ? "danger" : balanceProblems ? "warning" : undefined}
          detail={
            data
              ? `${data.balances.negative.length} negative · ${data.balances.low.length} at ${data.balances.lowThreshold} days or less`
              : ""
          }
        />
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Off today */}
        <Card>
          <CardHeader>
            <CardTitle>Off today</CardTitle>
            <CardDescription>Approved leave covering today</CardDescription>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <ListSkeleton />
            ) : data?.offToday.length ? (
              <ul className="divide-y">
                {data.offToday.map((leave) => (
                  <LeaveRow key={leave.id} leave={leave} color={typeColor(leave.type)} />
                ))}
              </ul>
            ) : (
              <Empty>Everyone is in today.</Empty>
            )}
          </CardContent>
        </Card>

        {/* This week */}
        <Card>
          <CardHeader>
            <CardTitle>This week</CardTitle>
            <CardDescription>Leave overlapping Monday to Sunday</CardDescription>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <ListSkeleton />
            ) : data?.offThisWeek.length ? (
              <>
                <ul className="divide-y">
                  {data.offThisWeek.slice(0, LIST_LIMIT).map((leave) => (
                    <LeaveRow key={leave.id} leave={leave} color={typeColor(leave.type)} />
                  ))}
                </ul>
                {data.offThisWeek.length > LIST_LIMIT && (
                  <MoreLink href="/dashboard/calendar">
                    {data.offThisWeek.length - LIST_LIMIT} more – open the team calendar
                  </MoreLink>
                )}
              </>
            ) : (
              <Empty>No leave booked this week.</Empty>
            )}
          </CardContent>
        </Card>

        {/* Documents (admins) */}
        {isAdmin && (
          <Card>
            <CardHeader>
              <CardTitle>Documents needing attention</CardTitle>
              <CardDescription>
                Expired, or expiring within {data?.documents?.warningDays ?? 30} days
              </CardDescription>
            </CardHeader>
            <CardContent>
              {isLoading ? (
                <ListSkeleton />
              ) : documentProblems && data?.documents ? (
                <>
                  <ul className="divide-y">
                    {[...data.documents.expired, ...data.documents.expiringSoon].slice(0, LIST_LIMIT).map((doc) => (
                      <li key={`${doc.id}-${doc.document}`} className="flex items-center justify-between gap-3 py-2">
                        <div className="min-w-0">
                          <p className="truncate font-medium">{doc.employeeName}</p>
                          <p className="text-sm text-muted-foreground">
                            {doc.document} · {doc.expiry} · {doc.branch}
                            {doc.isSponsored && " · Sponsored"}
                          </p>
                        </div>
                        <Badge
                          variant="outline"
                          className={cn(
                            "shrink-0",
                            doc.daysLeft <= 0
                              ? "border-red-200 bg-red-50 text-red-700"
                              : doc.daysLeft <= 7
                                ? "border-orange-200 bg-orange-50 text-orange-700"
                                : "border-yellow-200 bg-yellow-50 text-yellow-800",
                          )}
                        >
                          {doc.daysLeft < 0
                            ? `Expired ${Math.abs(doc.daysLeft)}d ago`
                            : doc.daysLeft === 0
                              ? "Expires today"
                              : `${doc.daysLeft} days left`}
                        </Badge>
                      </li>
                    ))}
                  </ul>
                  <MoreLink href="/dashboard/document-tracker">
                    {documentProblems > LIST_LIMIT
                      ? `${documentProblems - LIST_LIMIT} more – open the Document Tracker`
                      : "Open the Document Tracker"}
                  </MoreLink>
                </>
              ) : (
                <Empty>No documents expired or expiring soon.</Empty>
              )}
            </CardContent>
          </Card>
        )}

        {/* Balances */}
        <Card>
          <CardHeader>
            <CardTitle>Leave balances to watch</CardTitle>
            <CardDescription>
              Active staff with a negative balance or {data?.balances.lowThreshold ?? 5} days or less remaining
            </CardDescription>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <ListSkeleton />
            ) : balanceProblems && data ? (
              <>
                <ul className="divide-y">
                  {[...data.balances.negative, ...data.balances.low].slice(0, LIST_LIMIT).map((emp) => (
                    <li key={emp.id} className="flex items-center justify-between gap-3 py-2">
                      <div className="min-w-0">
                        <p className="truncate font-medium">{emp.name}</p>
                        <p className="text-sm text-muted-foreground">
                          {emp.branch} · {emp.daysTaken} days taken
                        </p>
                      </div>
                      <Badge
                        variant="outline"
                        className={cn(
                          "shrink-0",
                          emp.daysRemaining < 0
                            ? "border-red-200 bg-red-50 text-red-700"
                            : "border-yellow-200 bg-yellow-50 text-yellow-800",
                        )}
                      >
                        {emp.daysRemaining} {Math.abs(emp.daysRemaining) === 1 ? "day" : "days"} left
                      </Badge>
                    </li>
                  ))}
                </ul>
                <MoreLink href="/dashboard/employees">
                  {balanceProblems > LIST_LIMIT
                    ? `${balanceProblems - LIST_LIMIT} more – open Employees`
                    : "Open Employees"}
                </MoreLink>
              </>
            ) : (
              <Empty>Nobody is low on leave.</Empty>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}

function StatCard({
  title,
  icon: Icon,
  value,
  detail,
  loading,
  tone,
}: {
  title: string
  icon: typeof Plane
  value: number | undefined
  detail: string
  loading: boolean
  tone?: "warning" | "danger"
}) {
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium">{title}</CardTitle>
        {tone ? (
          <AlertTriangle className={cn("h-4 w-4", tone === "danger" ? "text-red-500" : "text-amber-500")} />
        ) : (
          <Icon className="h-4 w-4 text-muted-foreground" />
        )}
      </CardHeader>
      <CardContent>
        {loading ? (
          <Skeleton className="h-8 w-16" />
        ) : (
          <div
            className={cn(
              "text-3xl font-bold",
              tone === "danger" && "text-red-600",
              tone === "warning" && "text-amber-600",
            )}
          >
            {value ?? "–"}
          </div>
        )}
        <p className="mt-1 text-xs text-muted-foreground">{loading ? " " : detail}</p>
      </CardContent>
    </Card>
  )
}

function LeaveRow({ leave, color }: { leave: LeaveEntry; color: string }) {
  return (
    <li className="flex items-center justify-between gap-3 py-2">
      <div className="flex min-w-0 items-center gap-3">
        <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ backgroundColor: color }} aria-hidden />
        <div className="min-w-0">
          <p className="truncate font-medium">{leave.employeeName}</p>
          <p className="text-sm text-muted-foreground">
            {leave.type} · {leave.branch}
          </p>
        </div>
      </div>
      <span className="shrink-0 text-right text-sm text-muted-foreground">{formatRange(leave)}</span>
    </li>
  )
}

function ListSkeleton() {
  return (
    <div className="space-y-3">
      {[0, 1, 2].map((i) => (
        <Skeleton key={i} className="h-10 w-full" />
      ))}
    </div>
  )
}

function Empty({ children }: { children: ReactNode }) {
  return <p className="py-6 text-center text-sm text-muted-foreground">{children}</p>
}

function MoreLink({ href, children }: { href: string; children: ReactNode }) {
  return (
    <Link href={href} className="mt-3 inline-block text-sm font-medium text-primary hover:underline">
      {children}
    </Link>
  )
}
