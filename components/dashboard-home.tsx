"use client"

import { useState, type ReactNode } from "react"
import { leaveTypeColour } from "@/lib/leave-type-colour"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { AddLeaveModal } from "./add-leave-modal"
import { AddDocumentModal } from "./add-document-modal"
import { useQuery } from "@tanstack/react-query"
import {
  ArrowRight,
  CalendarDays,
  CalendarRange,
  FilePlus2,
  FileWarning,
  PartyPopper,
  Plane,
  Plus,
  Scale,
  ShieldCheck,
} from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Avatar, EmptyState, ErrorState, ListSkeleton, PageHeader, StatCard, plural } from "./page-kit"
import { useApp } from "./app-provider"
import { useBranches } from "@/hooks/use-branches"
import { fetchWithAuth, handleApiError } from "@/lib/api-utils"
import { formatDisplayDate, formatDisplayRange } from "@/lib/dates"
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

// "Mon 09/11/2026"
function formatDay(iso: string) {
  return formatDisplayDate(iso, { weekday: true })
}

function formatRange(entry: LeaveEntry) {
  return entry.start === entry.end ? formatDay(entry.start) : `${formatDay(entry.start)} – ${formatDay(entry.end)}`
}

function greeting() {
  const hour = Number(
    new Intl.DateTimeFormat("en-GB", { hour: "numeric", hour12: false, timeZone: "Europe/London" }).format(new Date()),
  )
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
  const router = useRouter()
  const [addLeave, setAddLeave] = useState(false)
  const [addDocument, setAddDocument] = useState(false)
  const canManage = isAdmin || myBranches.length > 0

  const branchOptions = isAdmin ? allBranches.map((b) => b.name) : myBranches
  const showBranchPicker = branchOptions.length > 1

  const { data, isLoading, isError, error, refetch } = useQuery<DashboardData>({
    queryKey: ["dashboard", branch],
    queryFn: () => fetchWithAuth(`/api/dashboard?branch=${encodeURIComponent(branch)}`),
    enabled: !!user,
    refetchInterval: 5 * 60 * 1000,
  })
  // Leave waiting for a decision: only shown when there is some
  const { data: pending = [] } = useQuery<
    {
      id: string
      employee: string
      branch: string
      type: string
      startDate: string
      endDate: string
      duration: number
    }[]
  >({
    queryKey: ["leaveRequests", "pending", branch],
    queryFn: () =>
      fetchWithAuth(
        `/api/leave-requests?status=Pending${branch !== "all" ? `&branch=${encodeURIComponent(branch)}` : ""}`,
      ),
    enabled: !!user,
  })

  const typeColor = (type: string) => leaveTypeColour(type)

  const peopleOffThisWeek = new Set(data?.offThisWeek.map((l) => l.employeeId)).size
  // Right to work is the check that matters most: it leads, other documents follow
  const allDocumentItems = data?.documents ? [...data.documents.expired, ...data.documents.expiringSoon] : []
  const documentItems = allDocumentItems.filter((d) => d.document === "Right to work")
  const otherDocumentItems = allDocumentItems.filter((d) => d.document !== "Right to work")
  const rtwExpired = documentItems.filter((d) => d.daysLeft <= 0).length
  const balanceItems = data ? [...data.balances.negative, ...data.balances.low] : []
  const offList = (range === "today" ? data?.offToday : data?.offThisWeek) || []
  const firstName = user?.name?.split(" ")[0]
  // "Friday 13/11/2026"
  const todayLabel = data ? formatDisplayDate(data.today, { weekday: "long" }) : "\u00a0"

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
            {isAdmin && (
              <Button variant="outline" onClick={() => setAddDocument(true)} className="hidden sm:inline-flex">
                <FilePlus2 />
                Add document
              </Button>
            )}
            {canManage && (
              <Button onClick={() => setAddLeave(true)}>
                <Plus />
                Add leave
              </Button>
            )}
          </>
        }
      />

      {isError && (
        <ErrorState title="Couldn't load the dashboard" message={handleApiError(error)} onRetry={() => refetch()} />
      )}

      {/* Headline numbers */}
      <div className={cn("tile-tray grid-cols-2", isAdmin ? "lg:grid-cols-4" : "lg:grid-cols-3")}>
        <StatCard
          label="Off today"
          icon={Plane}
          loading={isLoading}
          value={data?.offToday.length ?? "–"}
          detail={data ? (data.offToday.length === 1 ? "person on leave" : "people on leave") : undefined}
          onClick={() => router.push("/dashboard/leave-management?status=Approved&dates=today&year=all")}
          actionLabel="Show who is off today"
        />
        <StatCard
          label="Off this week"
          icon={CalendarDays}
          loading={isLoading}
          value={peopleOffThisWeek}
          detail={data ? `${formatDay(data.weekStart)} – ${formatDay(data.weekEnd)}` : undefined}
          onClick={() => router.push(LEAVE_CALENDAR_HREF)}
          actionLabel="Open the team calendar"
        />
        {isAdmin && (
          <StatCard
            label="Right to work"
            icon={FileWarning}
            loading={isLoading}
            value={documentItems.length}
            tone={rtwExpired ? "danger" : documentItems.length ? "warning" : "default"}
            onClick={() => router.push("/dashboard/document-tracker?status=rtw_action")}
            actionLabel="Show whose right to work needs action"
            detail={
              data?.documents
                ? `${rtwExpired} expired · ${documentItems.length - rtwExpired} due in ${data.documents.warningDays}d`
                : undefined
            }
          />
        )}
        <StatCard
          label="Balances"
          icon={Scale}
          loading={isLoading}
          value={balanceItems.length}
          tone={data?.balances.negative.length ? "danger" : balanceItems.length ? "warning" : "default"}
          onClick={() => router.push("/dashboard/employees?sort=leave_low")}
          actionLabel="Show who has least leave left"
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
              <ul className="flex flex-col gap-1.5 px-3 pb-3 [&>li]:rounded-2xl [&>li]:bg-background [&>li>*]:rounded-2xl">
                {offList.slice(0, LIST_LIMIT).map((leave) => (
                  <LeaveRow key={leave.id} leave={leave} color={typeColor(leave.type)} />
                ))}
              </ul>
              <PanelFooter href={LEAVE_CALENDAR_HREF}>
                {offList.length > LIST_LIMIT
                  ? `${offList.length - LIST_LIMIT} more in the team calendar`
                  : "Open the team calendar"}
              </PanelFooter>
            </>
          ) : (
            <EmptyState
              icon={PartyPopper}
              title={range === "today" ? "Everyone is in today" : "No leave this week"}
              description="Approved leave will appear here."
              compact
              
            />
          )}
        </section>

        {/* Needs attention */}
        <div className="space-y-4 sm:space-y-6 lg:col-span-2">
          {pending.length > 0 && (
            <section className="surface overflow-hidden">
              <PanelHeading
                title="Needs a decision"
                description="Leave waiting to be approved or rejected"
                count={pending.length}
              />
              <ul className="flex flex-col gap-1.5 px-3 pb-3 [&>li]:rounded-2xl [&>li]:bg-background [&>li>*]:rounded-2xl">
                {pending.slice(0, LIST_LIMIT).map((l) => (
                  <li key={l.id}>
                    <Link
                      href={`/dashboard/leave-management?request=${l.id}`}
                      className="flex items-center gap-3 px-5 py-3 transition-colors hover:bg-muted/50 sm:px-6"
                    >
                      <Avatar name={l.employee} className="h-8 w-8 text-xs" />
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-semibold">{l.employee}</p>
                        <p className="truncate text-xs text-muted-foreground">
                          {l.type} · {formatDisplayRange(l.startDate, l.endDate)}
                        </p>
                      </div>
                      <Badge dot variant="warning" className="shrink-0">
                        Pending
                      </Badge>
                    </Link>
                  </li>
                ))}
              </ul>
              <PanelFooter href="/dashboard/leave-management?status=Pending&year=all">
                {pending.length > LIST_LIMIT ? `${pending.length - LIST_LIMIT} more to decide` : "Open pending leave"}
              </PanelFooter>
            </section>
          )}
          {isAdmin && (
            <section className="surface overflow-hidden">
              <PanelHeading
                title="Right to work"
                description={`Expired or due within ${data?.documents?.warningDays ?? 30} days`}
                count={isLoading ? undefined : documentItems.length}
              />
              {isLoading ? (
                <ListSkeleton rows={2} />
              ) : documentItems.length ? (
                <>
                  <ul className="flex flex-col gap-1.5 px-3 pb-3 [&>li]:rounded-2xl [&>li]:bg-background [&>li>*]:rounded-2xl">
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
                          {doc.daysLeft < 0
                            ? `${Math.abs(doc.daysLeft)}d overdue`
                            : doc.daysLeft === 0
                              ? "Today"
                              : `${doc.daysLeft}d`}
                        </Badge>
                      </li>
                    ))}
                  </ul>
                  <PanelFooter href="/dashboard/document-tracker?expiry=within30">
                    {documentItems.length > LIST_LIMIT
                      ? `${documentItems.length - LIST_LIMIT} more in Documents`
                      : "Open Documents"}
                  </PanelFooter>
                </>
              ) : (
                <EmptyState
                  icon={ShieldCheck}
                  title="Right to work all in date"
                  compact
                  
                />
              )}
              {/* Other documents: a quiet one-line summary */}
              {!isLoading && otherDocumentItems.length > 0 && (
                <Link
                  href="/dashboard/document-tracker?type=all&expiry=within30"
                  className="flex items-center justify-between gap-3 px-5 py-2.5 text-xs text-muted-foreground transition-colors hover:text-foreground sm:px-6"
                >
                  <span>
                    Other documents: {otherDocumentItems.filter((d) => d.daysLeft <= 0).length} expired ·{" "}
                    {otherDocumentItems.filter((d) => d.daysLeft > 0).length} due soon
                  </span>
                  <ArrowRight className="h-3.5 w-3.5" />
                </Link>
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
                <ul className="flex flex-col gap-1.5 px-3 pb-3 [&>li]:rounded-2xl [&>li]:bg-background [&>li>*]:rounded-2xl">
                  {balanceItems.slice(0, LIST_LIMIT).map((emp) => (
                    <li key={emp.id} className="flex items-center gap-3 px-5 py-3 sm:px-6">
                      <Avatar name={emp.name} className="h-8 w-8 text-xs" />
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-semibold">{emp.name}</p>
                        <p className="truncate text-xs text-muted-foreground">
                          {emp.branch} · {plural(emp.daysTaken, "day")} taken
                        </p>
                      </div>
                      <Badge
                        dot
                        variant={emp.daysRemaining < 0 ? "destructive" : "warning"}
                        className="shrink-0 tabular"
                      >
                        {plural(emp.daysRemaining, "day")}
                      </Badge>
                    </li>
                  ))}
                </ul>
                <PanelFooter href="/dashboard/employees">
                  {balanceItems.length > LIST_LIMIT
                    ? `${balanceItems.length - LIST_LIMIT} more in Employees`
                    : "Open Employees"}
                </PanelFooter>
              </>
            ) : (
              <EmptyState icon={Scale} title="Nobody is low on leave" compact  />
            )}
          </section>
        </div>
      </div>

      <AddLeaveModal open={addLeave} onOpenChange={setAddLeave} />
      {isAdmin && <AddDocumentModal open={addDocument} onOpenChange={setAddDocument} />}
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
        <span className="rounded-full bg-secondary px-2.5 py-0.5 text-xs font-semibold tabular text-foreground/80">
          {count}
        </span>
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
        {/* Phones: the dates go under the name, so the name keeps its room */}
        <p className="mt-0.5 text-xs font-medium tabular text-foreground/80 sm:hidden">
          {formatDisplayRange(leave.startDate, leave.endDate)} · {plural(leave.duration, "day")}
        </p>
      </div>
      <div className="hidden shrink-0 text-right sm:block">
        <p className="text-sm font-medium tabular">{formatRange(leave)}</p>
        <p className="text-xs text-muted-foreground">{plural(leave.duration, "day")}</p>
      </div>
    </li>
  )
}

function PanelFooter({ href, children }: { href: string; children: ReactNode }) {
  return (
    <Link
      href={href}
      className="group flex items-center justify-between px-5 py-3 text-sm font-semibold text-primary-text transition-colors hover:bg-primary-soft/50 sm:px-6"
    >
      {children}
      <ArrowRight className="h-4 w-4 transition-transform duration-200 ease-smooth group-hover:translate-x-0.5" />
    </Link>
  )
}
