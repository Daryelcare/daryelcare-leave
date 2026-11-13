"use client"

import { Fragment, useEffect, useState } from "react"
import Image from "next/image"
import Link from "next/link"
import { usePathname } from "next/navigation"
import { ChevronDown, KeyRound, LogOut, Settings } from "lucide-react"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { useApp } from "./app-provider"
import { useLogout } from "@/hooks/use-logout"
import { findNavItem, pageTitle, settingsHref, visibleGroups } from "@/lib/navigation"
import { cn } from "@/lib/utils"
import { Avatar } from "./page-kit"

/**
 * Floating top bar: logo on the left, the main pages in the middle, the
 * account menu on the right. Groups (Overview, People, Workspace) are
 * separated by hairline dividers. On phones the pages live in the bottom
 * tab bar, so the bar shows the logo, the page name once you scroll, and
 * the account menu.
 */
export function TopNav() {
  const pathname = usePathname()
  const { user } = useApp()
  const isAdmin = user?.role === "admin"
  const activeHref = findNavItem(pathname)?.href
  const groups = visibleGroups(isAdmin)

  // Phones: the page shows a large title, so the bar only shows it once
  // you've scrolled past it. Everywhere: the bar lifts slightly on scroll.
  const [scrolled, setScrolled] = useState(false)
  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 56)
    onScroll()
    window.addEventListener("scroll", onScroll, { passive: true })
    return () => window.removeEventListener("scroll", onScroll)
  }, [pathname])

  return (
    <header className="sticky top-0 z-30 px-4 pt-2 sm:px-6 sm:pt-3 lg:px-10">
      <div
        className={cn(
          "mx-auto flex h-12 max-w-[1360px] items-center gap-3 rounded-full border border-border/70 bg-card/85 pl-3.5 pr-1.5 backdrop-blur-xl transition-shadow duration-300 supports-[backdrop-filter]:bg-card/75 sm:h-[52px] sm:pl-4",
          scrolled ? "shadow-float" : "shadow-raised",
        )}
      >
        <Link
          href="/dashboard"
          aria-label="DaryelCare home"
          className="flex h-9 min-w-9 shrink-0 items-center justify-center rounded-full outline-none focus-visible:ring-[3px] focus-visible:ring-ring/30"
        >
          <Image src="/images/daryelcare-mark.png" alt="" width={26} height={26} priority className="lg:hidden" />
          <Image
            src="/images/daryelcare-wordmark.png"
            alt=""
            width={150}
            height={26}
            priority
            className="hidden h-[20px] w-auto lg:block"
          />
        </Link>

        {/* Phones: page name appears after scrolling past the page title */}
        <p
          className={cn(
            "min-w-0 flex-1 truncate font-display text-[15px] font-semibold tracking-[-0.01em] transition-[opacity,transform] duration-200 ease-smooth md:hidden",
            scrolled ? "translate-y-0 opacity-100" : "translate-y-1 opacity-0",
          )}
          aria-hidden={!scrolled}
        >
          {pageTitle(pathname)}
        </p>

        {/* Tablets and up: the main pages */}
        <nav aria-label="Main" className="hidden min-w-0 flex-1 justify-center md:flex">
          <ul className="flex items-center gap-0.5 lg:gap-1">
            {groups.map((group, gi) => (
              <Fragment key={group.label}>
                {gi > 0 && <li aria-hidden className="mx-1 h-4 w-px bg-border lg:mx-1.5" />}
                {group.items.map((item) => {
                  const active = activeHref === item.href
                  return (
                    <li key={item.href}>
                      <Link
                        href={item.href}
                        aria-current={active ? "page" : undefined}
                        className={cn(
                          "flex h-8 items-center whitespace-nowrap rounded-full px-2.5 text-sm font-medium transition-colors duration-150 lg:px-3.5",
                          "outline-none focus-visible:ring-[3px] focus-visible:ring-ring/30",
                          active
                            ? "bg-primary-soft font-semibold text-primary"
                            : "text-foreground/70 hover:bg-secondary hover:text-foreground",
                        )}
                      >
                        {item.title}
                      </Link>
                    </li>
                  )
                })}
              </Fragment>
            ))}
          </ul>
        </nav>

        <AccountMenu />
      </div>
    </header>
  )
}

function AccountMenu() {
  const { user } = useApp()
  const handleLogout = useLogout()
  const isAdmin = user?.role === "admin"
  const branchSummary = isAdmin
    ? "All branches"
    : user?.branches && user.branches.length > 0
      ? user.branches.join(", ")
      : "No branches assigned"

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          aria-label="Account menu"
          className="flex h-10 shrink-0 items-center gap-2 rounded-full p-1 outline-none transition-colors hover:bg-secondary focus-visible:ring-[3px] focus-visible:ring-ring/30 sm:pr-2.5"
        >
          <Avatar name={user?.name} className="h-8 w-8 text-xs" />
          <span className="hidden min-w-0 max-w-[140px] text-left xl:block">
            <span className="block truncate text-[13px] font-semibold leading-4">{user?.name || "Account"}</span>
            <span className="block truncate text-[11px] leading-4 text-muted-foreground">{branchSummary}</span>
          </span>
          <ChevronDown className="hidden h-3.5 w-3.5 text-muted-foreground sm:block" />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" sideOffset={8} className="w-64">
        <DropdownMenuLabel className="space-y-0.5">
          <p className="truncate font-semibold">{user?.name}</p>
          <p className="truncate text-xs font-normal text-muted-foreground">{user?.email}</p>
          <p className="pt-1 text-xs font-medium text-primary">
            {isAdmin ? "Administrator" : "Branch manager"} ·{" "}
            <span className="text-muted-foreground">{branchSummary}</span>
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
        <DropdownMenuItem
          onClick={handleLogout}
          className="text-destructive focus:text-destructive [&_svg]:!text-destructive"
        >
          <LogOut />
          Log out
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
