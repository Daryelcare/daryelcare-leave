"use client"

import { useState, type ReactNode } from "react"
import Link from "next/link"
import { useQuery } from "@tanstack/react-query"
import { ArrowRight, CalendarDays, CalendarRange, FileWarning, PartyPopper, Plane, Scale, ShieldCheck } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Avatar, EmptyState, ErrorState, ListSkeleton, PageHeader, StatCard, plural } from "./page-kit"
import { useApp } from "./app-provider"
import { useBranches } from "@/hooks/use-branches"
import { useLeaveTypes } from "@/hooks/use-leave-types"
import { fetchWithAuth, handleApiError } from "@/lib/api-utils"
import { formatDisplayRange, parseDateToUtc } from "@/lib/dates"
import { LEAVE_CALENDAR_HREF } from "@/lib/navigation"
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

const LIST_LIMIT = 6

function formatDay(iso: string) {
  const time = parseDateToUtc(iso)
  if (time === null) return iso
  return new Date(time).toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short", timeZone: "UTC" })
}

function formatRange(entry: LeaveEntry) {
  return entry.start === entry.end ? formatDay(entry.start) : `${formatDay(entry.start)} – ${formatDay(entry.end)}`
}

function greeting() {
  const hour = Number(new Intl.DateTimeFormat("en-GB", { hour: "numeric", hour12: false, timeZone: "Europe/London" }).format(new Date()))
  if (hour < 12) return "Good morning"
  if (hour < 18) return "Good afternoon"
  return "Good evening"
}

export function DashboardHome() {
  const { user } = useApp()
  const isAdmin = user?.role === "admin"
  const myBranches = user?.branches || []
  const [branch, setBranch] = useState<string>("all")
  const [range, setRange] = useState<"today" | "week">("today")
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
  const documentItems = data?.documents ? [...data.documents.expired, ...data.documents.expiringSoon] : []
  const balanceItems = data ? [...data.balances.negative, ...data.balances.low] : []
  const offList = (range === "today" ? data?.offToday : data?.offThisWeek) || []
  const firstName = user?.name?.split(" ")[0]
  const todayLabel = data
    ? new Date(parseDateToUtc(data.today) ?? Date.now()).toLocaleDateString("en-GB", {
        weekday: "long",
        day: "numeric",
        month: "long",
        timeZone: "UTC",
      })
    : "\u00a0"

  return (
    <div className="space-y-6 sm:space-y-8">
      <PageHeader
        eyebrow={todayLabel}
        title={`${greeting()}${firstName ? `, ${firstName}` : ""}`}
        description="Here's who's away and what needs your attention."
        actions={
          <>
            {showBranchPicker && (
              <Select value={branch} onValueChange={setBranch}>
                <SelectTrigger className="h-10 w-full sm:w-[190px]" aria-label="Branch">
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
            <Button asChild variant="outline" className="hidden sm:inline-flex">
              <Link href={LEAVE_CALENDAR_HREF}>
                <CalendarRange />
                Leave calendar
              </Link>
            </Button>
          </>
        }
      />

      {isError && <ErrorState title="Couldn't load the dashboard" message={handleApiError(error)} onRetry={() => refetch()} />}

      {/* Headline numbers */}
      <div className={cn("grid grid-cols-2 gap-3 sm:gap-4", isAdmin ? "lg:grid-cols-4" : "lg:grid-cols-3")}>
        <StatCard
          label="Off today"
          icon={Plane}
          loading={isLoading}
          value={data?.offToday.length ?? "–"}
          detail={data ? (data.offToday.length === 1 ? "person on leave" : "people on leave") : undefined}
        />
        <StatCard
          label="Off this week"
          icon={CalendarDays}
          loading={isLoading}
          value={peopleOffThisWeek}
          detail={data ? `${formatDay(data.weekStart)} – ${formatDay(data.weekEnd)}` : undefined}
        />
        {isAdmin && (
          <StatCard
            label="Documents"
            icon={FileWarning}
            loading={isLoading}
            value={documentItems.length}
            tone={data?.documents?.expired.length ? "danger" : documentItems.length ? "warning" : "success"}
            detail={
              data?.documents
                ? `${data.documents.expired.length} expired · ${data.documents.expiringSoon.length} due in ${data.documents.warningDays}d`
                : undefined
            }
          />
        )}
        <StatCard
          label="Balances"
          icon={Scale}
          loading={isLoading}
          value={balanceItems.length}
          tone={data?.balances.negative.length ? "danger" : balanceItems.length ? "warning" : "success"}
          className={cn(!isAdmin && "col-span-2 lg:col-span-1")}
          detail={data ? `${data.balances.negative.length} negative · ${data.balances.low.length} low` : undefined}
        />
      </div>

      <div className="grid gap-4 sm:gap-6 lg:grid-cols-5 lg:items-start [&>*]:min-w-0">
        {/* Who's off */}
        <section className="surface overflow-hidden lg:col-span-3">
          <div className="flex flex-col gap-3 p-5 pb-4 sm:flex-row sm:items-center sm:justify-between sm:p-6 sm:pb-4">
            <div>
              <h2 className="text-[17px] font-semibold">Who&apos;s off</h2>
              <p className="text-sm text-muted-foreground">
                {range === "today"
                  ? "Approved leave covering today"
                  : data
                    ? `${formatDay(data.weekStart)} – ${formatDay(data.weekEnd)}`
                    : "This week"}
              </p>
            </div>
            <Tabs value={range} onValueChange={(v) => setRange(v as "today" | "week")}>
              <TabsList>
                <TabsTrigger value="today">Today</TabsTrigger>
                <TabsTrigger value="week">This week</TabsTrigger>
              </TabsList>
            </Tabs>
          </div>
          {isLoading ? (
            <ListSkeleton rows={3} />
          ) : offList.length ? (
            <>
              <ul className="divide-y divide-border/70 border-t border-border/70">
                {offList.slice(0, LIST_LIMIT).map((leave) => (
                  <LeaveRow key={leave.id} leave={leave} color={typeColor(leave.type)} />
                ))}
              </ul>
              <PanelFooter href={LEAVE_CALENDAR_HREF}>
                {offList.length > LIST_LIMIT ? `${offList.length - LIST_LIMIT} more in the team calendar` : "Open the team calendar"}
              </PanelFooter>
            </>
          ) : (
            <EmptyState
              icon={PartyPopper}
              title={range === "today" ? "Everyone is in today" : "No leave this week"}
              description="Approved leave will appear here."
              compact
              className="border-t border-border/70"
            />
          )}
        </section>

        {/* Needs attention */}
        <div className="space-y-4 sm:space-y-6 lg:col-span-2">
          {isAdmin && (
            <section className="surface overflow-hidden">
              <PanelHeading
                title="Documents"
                description={`Expired or due within ${data?.documents?.warningDays ?? 30} days`}
                count={isLoading ? undefined : documentItems.length}
              />
              {isLoading ? (
                <ListSkeleton rows={2} />
              ) : documentItems.length ? (
                <>
                  <ul className="divide-y divide-border/70 border-t border-border/70">
                    {documentItems.slice(0, LIST_LIMIT).map((doc) => (
                      <li key={`${doc.id}-${doc.document}`} className="flex items-center gap-3 px-5 py-3 sm:px-6">
                        <Avatar name={doc.employeeName} className="h-8 w-8 text-xs" />
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm font-semibold">{doc.employeeName}</p>
                          <p className="truncate text-xs text-muted-foreground">
                            {doc.document} · {doc.expiry}
                            {doc.isSponsored && " · Sponsored"}
                          </p>
                        </div>
                        <Badge
                          dot
                          variant={doc.daysLeft <= 0 ? "destructive" : doc.daysLeft <= 7 ? "warning" : "secondary"}
                          className="shrink-0"
                        >
                          {doc.daysLeft < 0 ? `${Math.abs(doc.daysLeft)}d overdue` : doc.daysLeft === 0 ? "Today" : `${doc.daysLeft}d`}
                        </Badge>
                      </li>
                    ))}
                  </ul>
                  <PanelFooter href="/dashboard/document-tracker">
                    {documentItems.length > LIST_LIMIT ? `${documentItems.length - LIST_LIMIT} more in Documents` : "Open Documents"}
                  </PanelFooter>
                </>
              ) : (
                <EmptyState icon={ShieldCheck} title="All documents in date" compact className="border-t border-border/70" />
              )}
            </section>
          )}

          <section className="surface overflow-hidden">
            <PanelHeading
              title="Leave balances"
              description={`Negative, or ${data?.balances.lowThreshold ?? 5} days or less left`}
              count={isLoading ? undefined : balanceItems.length}
            />
            {isLoading ? (
              <ListSkeleton rows={3} />
            ) : balanceItems.length ? (
              <>
                <ul className="divide-y divide-border/70 border-t border-border/70">
                  {balanceItems.slice(0, LIST_LIMIT).map((emp) => (
                    <li key={emp.id} className="flex items-center gap-3 px-5 py-3 sm:px-6">
                      <Avatar name={emp.name} className="h-8 w-8 text-xs" />
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-semibold">{emp.name}</p>
                        <p className="truncate text-xs text-muted-foreground">
                          {emp.branch} · {plural(emp.daysTaken, "day")} taken
                        </p>
                      </div>
                      <Badge dot variant={emp.daysRemaining < 0 ? "destructive" : "warning"} className="shrink-0 tabular">
                        {plural(emp.daysRemaining, "day")}
                      </Badge>
                    </li>
                  ))}
                </ul>
                <PanelFooter href="/dashboard/employees">
                  {balanceItems.length > LIST_LIMIT ? `${balanceItems.length - LIST_LIMIT} more in Employees` : "Open Employees"}
                </PanelFooter>
              </>
            ) : (
              <EmptyState icon={Scale} title="Nobody is low on leave" compact className="border-t border-border/70" />
            )}
          </section>
        </div>
      </div>
    </div>
  )
}

function PanelHeading({ title, description, count }: { title: string; description: string; count?: number }) {
  return (
    <div className="flex items-start justify-between gap-3 p-5 pb-4 sm:p-6 sm:pb-4">
      <div>
        <h2 className="text-[17px] font-semibold">{title}</h2>
        <p className="text-sm text-muted-foreground">{description}</p>
      </div>
      {count !== undefined && count > 0 && (
        <span className="rounded-full bg-secondary px-2.5 py-0.5 text-xs font-semibold tabular text-foreground/80">{count}</span>
      )}
    </div>
  )
}

function LeaveRow({ leave, color }: { leave: LeaveEntry; color: string }) {
  return (
    <li className="flex items-center gap-3 px-5 py-3 sm:px-6">
      <Avatar name={leave.employeeName} />
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-semibold">{leave.employeeName}</p>
        <p className="flex min-w-0 items-center gap-1.5 text-xs text-muted-foreground">
          <span className="h-2 w-2 shrink-0 rounded-full" style={{ backgroundColor: color }} aria-hidden />
          <span className="truncate">
            {leave.type} · {leave.branch}
          </span>
        </p>
      </div>
      <div className="shrink-0 text-right">
        <p className="hidden text-sm font-medium tabular sm:block">{formatRange(leave)}</p>
        <p className="text-sm font-medium tabular sm:hidden">{formatDisplayRange(leave.startDate, leave.endDate).replace(/ \d{4}$/, "")}</p>
        <p className="text-xs text-muted-foreground">{plural(leave.duration, "day")}</p>
      </div>
    </li>
  )
}

function PanelFooter({ href, children }: { href: string; children: ReactNode }) {
  return (
    <Link
      href={href}
      className="group flex items-center justify-between border-t border-border/70 px-5 py-3 text-sm font-semibold text-primary transition-colors hover:bg-primary-soft/50 sm:px-6"
    >
      {children}
      <ArrowRight className="h-4 w-4 transition-transform duration-200 ease-smooth group-hover:translate-x-0.5" />
    </Link>
  )
}
