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
  icon: Icon,
  className,
}: {
  title: ReactNode
  description?: ReactNode
  actions?: ReactNode
  eyebrow?: ReactNode
  /** Optional neutral icon beside the title */
  icon?: ComponentType<{ className?: string }>
  className?: string
}) {
  return (
    <div className={cn("flex flex-wrap items-end justify-between gap-x-6 gap-y-4", className)}>
      <div className="flex min-w-0 flex-[1_1_260px] items-center gap-3.5">
        {Icon && (
          <span className="hidden h-11 w-11 shrink-0 items-center justify-center rounded-full bg-secondary text-secondary-foreground sm:flex">
            <Icon className="h-5 w-5" />
          </span>
        )}
        <div className="min-w-0 space-y-1">
          {eyebrow && <p className="text-[13px] font-semibold text-muted-foreground">{eyebrow}</p>}
          <h1 className="text-[26px] font-extrabold leading-[1.15] tracking-[-0.02em] sm:text-[28px]">{title}</h1>
          {description && <p className="max-w-2xl text-sm font-semibold leading-relaxed text-muted-foreground">{description}</p>}
        </div>
      </div>
      {actions && (
        // Selects here sit on the canvas, so they get the white pill look of the buttons
        <div className="flex w-full flex-wrap items-center gap-2 sm:w-auto [&>*]:flex-1 sm:[&>*]:flex-none [&_[role=combobox]]:rounded-full [&_[role=combobox]]:bg-card [&_[role=combobox]]:shadow-soft">
          {actions}
        </div>
      )}
    </div>
  )
}

/** Heading for a section within a page (e.g. a Settings section): title, description, actions. */
export function SectionHeader({
  title,
  description,
  actions,
  className,
}: {
  title: ReactNode
  description?: ReactNode
  actions?: ReactNode
  className?: string
}) {
  return (
    <div className={cn("flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between", className)}>
      <div className="min-w-0 space-y-1">
        <h2 className="text-[19px] font-semibold leading-tight tracking-[-0.02em]">{title}</h2>
        {description && <p className="max-w-xl text-sm leading-relaxed text-muted-foreground">{description}</p>}
      </div>
      {actions && <div className="flex gap-2 [&>*]:flex-1 sm:shrink-0 sm:[&>*]:flex-none">{actions}</div>}
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

// Icons stay neutral: only the figure carries a status colour
const toneIcon: Record<Tone, string> = {
  default: "bg-secondary text-secondary-foreground",
  success: "bg-secondary text-secondary-foreground",
  warning: "bg-secondary text-secondary-foreground",
  danger: "bg-secondary text-secondary-foreground",
}

/**
 * Headline number with a label and a short supporting line. A white 16px
 * tile, meant to sit inside a grey `.tile-tray`.
 */
export function StatCard({
  label,
  value,
  detail,
  icon: Icon,
  tone = "default",
  loading,
  className,
  onClick,
  actionLabel,
  active,
}: {
  label: string
  value: ReactNode
  detail?: ReactNode
  icon?: ComponentType<{ className?: string }>
  tone?: Tone
  loading?: boolean
  className?: string
  /** Makes the card a shortcut (e.g. to the list behind its number) */
  onClick?: () => void
  /** What clicking does, for screen readers */
  actionLabel?: string
  /** A clickable card that is currently filtering the list (pressed) */
  active?: boolean
}) {
  const Root = onClick ? "button" : "div"
  return (
    <Root
      {...(onClick
        ? {
            type: "button" as const,
            onClick,
            ...(active !== undefined ? { "aria-pressed": active } : {}),
            title: actionLabel,
            "aria-label": actionLabel
              ? `${label}: ${typeof value === "number" || typeof value === "string" ? value : ""}. ${actionLabel}`
              : undefined,
          }
        : {})}
      className={cn(
        "flex flex-col gap-2.5 rounded-2xl bg-card p-4 text-left",
        onClick &&
          "transition-shadow duration-200 ease-smooth hover:shadow-soft-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/70",
        active && "ring-2 ring-primary",
        className,
      )}
    >
      <div className="flex items-center justify-between gap-3">
        <p className="text-[13px] font-bold text-secondary-foreground">{label}</p>
        {Icon && (
          <span className={cn("flex h-8 w-8 items-center justify-center rounded-full", toneIcon[tone])}>
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
          <p
            className={cn(
              "font-display text-[30px] font-extrabold leading-none tracking-[-0.03em] tabular",
              toneText[tone],
            )}
          >
            {value}
          </p>
          {detail && <p className="text-xs font-semibold leading-5 text-muted-foreground">{detail}</p>}
        </div>
      )}
    </Root>
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
        "flex flex-col gap-3 rounded-2xl bg-destructive-soft p-4 sm:flex-row sm:items-center sm:justify-between",
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
    <div className={cn("space-y-1.5", className)}>
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="soft-row flex items-center gap-3 px-4 py-3">
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

const AVATAR_GRADIENTS = [
  // Deep enough for white initials to stay readable
  "linear-gradient(135deg,#60a5fa,#4f46e5)",
  "linear-gradient(135deg,#f87171,#db2777)",
  "linear-gradient(135deg,#34d399,#0f766e)",
  "linear-gradient(135deg,#f59e0b,#c2410c)",
  "linear-gradient(135deg,#a78bfa,#6d28d9)",
]

/** Circle with a person's initials. */
export function Avatar({ name, className }: { name?: string | null; className?: string }) {
  const initials =
    (name || "?")
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((part) => part[0]?.toUpperCase())
      .join("") || "?"
  // One gradient style, picked deterministically from the name
  let hash = 0
  for (const ch of name || "") hash = (hash * 31 + ch.charCodeAt(0)) >>> 0
  const gradient = AVATAR_GRADIENTS[hash % AVATAR_GRADIENTS.length]
  return (
    <span
      aria-hidden
      className={cn(
        "flex h-9 w-9 shrink-0 select-none items-center justify-center rounded-full text-[12px] font-bold text-white",
        className,
      )}
      style={{ backgroundImage: gradient }}
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
export { plural } from "@/lib/plural"
