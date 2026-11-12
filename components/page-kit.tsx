"use client"

import type { ComponentType, ReactNode } from "react"
import { AlertTriangle, Inbox, RotateCw } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import { cn } from "@/lib/utils"

// Building blocks shared by every page, so all screens line up the same way.

/** Page title row: title, optional description, and actions on the right. */
export function PageHeader({
  title,
  description,
  actions,
  eyebrow,
  className,
}: {
  title: ReactNode
  description?: ReactNode
  actions?: ReactNode
  eyebrow?: ReactNode
  className?: string
}) {
  return (
    <div className={cn("flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between", className)}>
      <div className="min-w-0 space-y-1.5">
        {eyebrow && <p className="eyebrow">{eyebrow}</p>}
        <h1 className="text-[26px] font-semibold leading-[1.15] tracking-[-0.03em] sm:text-[30px]">{title}</h1>
        {description && <p className="max-w-2xl text-[15px] leading-relaxed text-muted-foreground">{description}</p>}
      </div>
      {actions && (
        <div className="flex flex-wrap items-center gap-2 [&>*]:flex-1 sm:shrink-0 sm:justify-end sm:[&>*]:flex-none">{actions}</div>
      )}
    </div>
  )
}

/** Horizontal bar of filters (search, selects) above a list. Wraps on small screens. */
export function Toolbar({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <div className={cn("flex flex-col gap-2.5 sm:flex-row sm:flex-wrap sm:items-center", className)}>{children}</div>
  )
}

type Tone = "default" | "success" | "warning" | "danger"

const toneText: Record<Tone, string> = {
  default: "text-foreground",
  success: "text-success",
  warning: "text-warning",
  danger: "text-destructive",
}

const toneIcon: Record<Tone, string> = {
  default: "bg-secondary text-foreground/70",
  success: "bg-success-soft text-success",
  warning: "bg-warning-soft text-warning",
  danger: "bg-destructive-soft text-destructive",
}

/** Headline number with a label and a short supporting line. */
export function StatCard({
  label,
  value,
  detail,
  icon: Icon,
  tone = "default",
  loading,
  className,
}: {
  label: string
  value: ReactNode
  detail?: ReactNode
  icon?: ComponentType<{ className?: string }>
  tone?: Tone
  loading?: boolean
  className?: string
}) {
  return (
    <div className={cn("surface flex flex-col gap-3 p-4 sm:p-5", className)}>
      <div className="flex items-center justify-between gap-3">
        <p className="text-[13px] font-semibold text-muted-foreground">{label}</p>
        {Icon && (
          <span className={cn("flex h-8 w-8 items-center justify-center rounded-lg", toneIcon[tone])}>
            <Icon className="h-4 w-4" />
          </span>
        )}
      </div>
      {loading ? (
        <div className="space-y-2">
          <Skeleton className="h-8 w-14" />
          <Skeleton className="h-3.5 w-28" />
        </div>
      ) : (
        <div className="space-y-1">
          <p className={cn("font-display text-[30px] font-semibold leading-none tracking-[-0.03em] tabular", toneText[tone])}>
            {value}
          </p>
          {detail && <p className="text-xs leading-5 text-muted-foreground">{detail}</p>}
        </div>
      )}
    </div>
  )
}

/** Friendly placeholder for an empty list or panel. */
export function EmptyState({
  icon: Icon = Inbox,
  title,
  description,
  action,
  className,
  compact,
}: {
  icon?: ComponentType<{ className?: string }>
  title: ReactNode
  description?: ReactNode
  action?: ReactNode
  className?: string
  compact?: boolean
}) {
  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center text-center",
        compact ? "gap-2 px-4 py-8" : "gap-3 px-6 py-14",
        className,
      )}
    >
      <span className="flex h-11 w-11 items-center justify-center rounded-full bg-secondary text-muted-foreground">
        <Icon className="h-5 w-5" />
      </span>
      <div className="space-y-1">
        <p className="font-display text-[15px] font-semibold tracking-[-0.01em]">{title}</p>
        {description && <p className="mx-auto max-w-sm text-sm leading-relaxed text-muted-foreground">{description}</p>}
      </div>
      {action && <div className="pt-1">{action}</div>}
    </div>
  )
}

/** Inline error panel with a retry button. */
export function ErrorState({
  title = "Something went wrong",
  message,
  onRetry,
  className,
}: {
  title?: string
  message?: ReactNode
  onRetry?: () => void
  className?: string
}) {
  return (
    <div
      role="alert"
      className={cn(
        "flex flex-col gap-3 rounded-xl border border-destructive/20 bg-destructive-soft p-4 sm:flex-row sm:items-center sm:justify-between",
        className,
      )}
    >
      <div className="flex gap-3">
        <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-destructive" />
        <div className="space-y-0.5">
          <p className="text-sm font-semibold">{title}</p>
          {message && <p className="text-sm text-foreground/70">{message}</p>}
        </div>
      </div>
      {onRetry && (
        <Button variant="outline" size="sm" onClick={onRetry} className="self-start sm:self-auto">
          <RotateCw />
          Try again
        </Button>
      )}
    </div>
  )
}

/** Rows of skeletons shaped like a list. */
export function ListSkeleton({ rows = 5, className }: { rows?: number; className?: string }) {
  return (
    <div className={cn("divide-y divide-border/70", className)}>
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="flex items-center gap-3 px-4 py-3.5 sm:px-5">
          <Skeleton className="h-9 w-9 rounded-full" />
          <div className="flex-1 space-y-2">
            <Skeleton className="h-3.5 w-1/3" />
            <Skeleton className="h-3 w-1/2" />
          </div>
          <Skeleton className="hidden h-6 w-16 rounded-full sm:block" />
        </div>
      ))}
    </div>
  )
}

/** Circle with a person's initials. */
export function Avatar({ name, className }: { name?: string | null; className?: string }) {
  const initials =
    (name || "?")
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((part) => part[0]?.toUpperCase())
      .join("") || "?"
  // Stable soft colour per name
  const hues = [204, 152, 262, 24, 340, 186, 45]
  let hash = 0
  for (const ch of name || "") hash = (hash * 31 + ch.charCodeAt(0)) >>> 0
  const hue = hues[hash % hues.length]
  return (
    <span
      aria-hidden
      className={cn(
        "flex h-9 w-9 shrink-0 select-none items-center justify-center rounded-full font-display text-[13px] font-semibold",
        className,
      )}
      style={{ backgroundColor: `hsl(${hue} 70% 94%)`, color: `hsl(${hue} 55% 32%)` }}
    >
      {initials}
    </span>
  )
}

/** One label/value pair inside a details view. */
export function Field({ label, children, className }: { label: string; children: ReactNode; className?: string }) {
  return (
    <div className={cn("min-w-0 space-y-1", className)}>
      <dt className="text-xs font-semibold text-muted-foreground">{label}</dt>
      <dd className="break-words text-sm font-medium text-foreground">{children ?? "—"}</dd>
    </div>
  )
}

/** "1 day" / "3 days" */
export function plural(count: number, one: string, many = `${one}s`) {
  return `${count} ${Math.abs(count) === 1 ? one : many}`
}
