"use client"

import Image from "next/image"
import Link from "next/link"
import { usePathname } from "next/navigation"
import { useQuery } from "@tanstack/react-query"
import { ChevronsUpDown, KeyRound, LogOut, Search, Settings } from "lucide-react"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { fetchWithAuth } from "@/lib/api-utils"
import { LEAVE_PATH, findNavItem, settingsHref, visibleGroups } from "@/lib/navigation"
import { useLogout } from "@/hooks/use-logout"
import { cn } from "@/lib/utils"
import { useApp } from "./app-provider"
import { Avatar } from "./page-kit"
import { THEME_OPTIONS, useThemeChoice } from "./theme-switch"
import { openQuickSearch, useShortcutLabel } from "./quick-search"

/** Leave requests waiting for a decision (same query the dashboard uses). */
export function usePendingCount() {
  const { user } = useApp()
  const { data } = useQuery<unknown[]>({
    queryKey: ["leaveRequests", "pending", "all"],
    queryFn: () => fetchWithAuth("/api/leave-requests?status=Pending"),
    enabled: !!user,
    staleTime: 60_000,
  })
  return Array.isArray(data) ? data.length : 0
}

/**
 * The floating sidebar: logo, the main pages as pills with round icon chips,
 * and the account card at the bottom. Used as a fixed column from `lg` up and
 * inside the menu sheet below that.
 */
export function SidebarContent({ onNavigate }: { onNavigate?: () => void }) {
  const pathname = usePathname()
  const { user } = useApp()
  const isAdmin = user?.role === "admin"
  const activeHref = findNavItem(pathname)?.href
  const pending = usePendingCount()
  const shortcut = useShortcutLabel()

  return (
    <div className="flex h-full flex-col gap-1 px-3.5 py-5">
      <Link
        href="/dashboard"
        onClick={onNavigate}
        aria-label="DaryelCare home"
        className="mb-4 flex items-center gap-2.5 rounded-2xl px-2 py-1.5 outline-none focus-visible:ring-2 focus-visible:ring-primary/70"
      >
        <Image src="/images/daryelcare-mark.png" alt="" width={36} height={36} priority className="h-9 w-9" />
        <span className="flex min-w-0 flex-col">
          <span className="font-display text-[15px] font-bold leading-5 tracking-[-0.01em]">DaryelCare</span>
          <span className="text-xs font-medium text-muted-foreground">Leave &amp; compliance</span>
        </span>
      </Link>

      <button
        type="button"
        onClick={() => {
          onNavigate?.()
          openQuickSearch()
        }}
        className="mb-4 flex h-10 items-center gap-2.5 rounded-full bg-background pl-3.5 pr-2 text-sm text-muted-foreground outline-none transition-colors hover:bg-secondary hover:text-foreground focus-visible:ring-2 focus-visible:ring-primary/70"
      >
        <Search className="h-4 w-4" />
        <span className="flex-1 text-left">Search</span>
        <kbd className="rounded-md bg-card font-sans px-1.5 py-0.5 text-[11px] font-semibold text-muted-foreground shadow-soft">
          {shortcut}
        </kbd>
      </button>

      <nav aria-label="Main" className="flex flex-col gap-4">
        {visibleGroups(isAdmin, user?.permissions).map((group) => (
          <div key={group.label}>
            <p className="px-2.5 pb-1.5 text-[11px] font-bold uppercase tracking-[0.06em] text-muted-foreground">
              {group.label}
            </p>
            <ul className="flex flex-col gap-1">
              {group.items.map((item) => {
                const active = activeHref === item.href
                const badge = item.href === LEAVE_PATH && pending > 0 ? pending : 0
                return (
                  <li key={item.href}>
                    <Link
                      href={item.href}
                      onClick={onNavigate}
                      aria-current={active ? "page" : undefined}
                      className={cn(
                        "flex h-10 items-center gap-2.5 rounded-full pl-1 pr-3 text-sm outline-none transition-colors duration-150",
                        "focus-visible:ring-2 focus-visible:ring-primary/70 focus-visible:ring-offset-2",
                        active
                          ? "bg-primary font-semibold text-primary-foreground shadow-[0_6px_14px_-6px_rgba(37,99,235,0.55)]"
                          : "font-medium text-secondary-foreground hover:bg-secondary hover:text-foreground",
                      )}
                    >
                      <span
                        className={cn(
                          "flex h-8 w-8 shrink-0 items-center justify-center rounded-full",
                          active ? "bg-white/20" : "bg-secondary text-muted-foreground",
                        )}
                      >
                        <item.icon className="h-4 w-4" />
                      </span>
                      <span className="min-w-0 flex-1 truncate">{item.title}</span>
                      {badge > 0 && (
                        <span
                          className={cn(
                            "flex h-5 min-w-5 items-center justify-center rounded-full px-1.5 text-[11px] font-bold tabular",
                            active ? "bg-white/25 text-white" : "bg-warning-soft text-warning",
                          )}
                          aria-label={`${badge} waiting for a decision`}
                        >
                          {badge}
                        </span>
                      )}
                    </Link>
                  </li>
                )
              })}
            </ul>
          </div>
        ))}
      </nav>

      <div className="mt-auto pt-4">
        <AccountCard />
      </div>
    </div>
  )
}

export function branchSummary(user: { role?: string; branches?: string[] } | null) {
  if (user?.role === "admin") return "All branches"
  return user?.branches && user.branches.length > 0 ? user.branches.join(", ") : "No branches assigned"
}

/** Account card at the foot of the sidebar; opens the account menu. */
function AccountCard() {
  const { user } = useApp()
  const isAdmin = user?.role === "admin"
  const summary = branchSummary(user)
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          aria-label="Account menu"
          className="flex w-full items-center gap-2.5 rounded-[20px] bg-background p-2.5 text-left outline-none transition-colors hover:bg-secondary focus-visible:ring-2 focus-visible:ring-primary/70"
        >
          <Avatar name={user?.name} className="h-9 w-9" />
          <span className="min-w-0 flex-1">
            <span className="block truncate text-[13px] font-bold leading-5">{user?.name || "Account"}</span>
            <span className="block truncate text-xs text-muted-foreground">
              {isAdmin ? "Admin" : "Manager"} · {summary}
            </span>
          </span>
          <ChevronsUpDown className="h-4 w-4 shrink-0 text-muted-foreground" />
        </button>
      </DropdownMenuTrigger>
      <AccountMenuItems side="top" />
    </DropdownMenu>
  )
}

/** The account menu's contents, shared by the sidebar card and the compact top bar. */
export function AccountMenuItems({ side = "bottom" }: { side?: "top" | "bottom" }) {
  const { user } = useApp()
  const handleLogout = useLogout()
  const isAdmin = user?.role === "admin"
  const { theme, setTheme } = useThemeChoice()
  return (
    <DropdownMenuContent side={side} align={side === "top" ? "start" : "end"} sideOffset={8} className="w-64">
      <DropdownMenuLabel className="space-y-0.5">
        <p className="truncate font-semibold">{user?.name}</p>
        <p className="truncate text-xs font-normal text-muted-foreground">{user?.email}</p>
        <p className="pt-1 text-xs font-medium text-primary-text">
          {isAdmin ? "Administrator" : "Branch manager"} ·{" "}
          <span className="text-muted-foreground">{branchSummary(user)}</span>
        </p>
      </DropdownMenuLabel>
      <DropdownMenuSeparator />
      <DropdownMenuItem asChild>
        <Link href="/dashboard/settings">
          <Settings />
          Settings
        </Link>
      </DropdownMenuItem>
      <DropdownMenuItem asChild>
        <Link href={settingsHref("password")}>
          <KeyRound />
          Change password
        </Link>
      </DropdownMenuItem>
      <DropdownMenuSeparator />
      <DropdownMenuLabel className="pb-1 pt-1.5 text-xs font-semibold text-muted-foreground">Appearance</DropdownMenuLabel>
      <DropdownMenuRadioGroup value={theme} onValueChange={setTheme}>
        {THEME_OPTIONS.map((o) => (
          <DropdownMenuRadioItem key={o.value} value={o.value}>
            <o.icon />
            {o.label}
          </DropdownMenuRadioItem>
        ))}
      </DropdownMenuRadioGroup>
      <DropdownMenuSeparator />
      <DropdownMenuItem
        onClick={handleLogout}
        className="text-destructive focus:text-destructive [&_svg]:!text-destructive"
      >
        <LogOut />
        Log out
      </DropdownMenuItem>
    </DropdownMenuContent>
  )
}
