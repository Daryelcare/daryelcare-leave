"use client"

import Link from "next/link"
import { usePathname, useSearchParams } from "next/navigation"
<<<<<<< HEAD
import { useEffect, useState } from "react"
import { LogOut, Menu } from "lucide-react"
import { Sheet, SheetContent, SheetDescription, SheetTitle } from "@/components/ui/sheet"
import { TAB_BAR, findNavItem, visibleGroups } from "@/lib/navigation"
import { useLogout } from "@/hooks/use-logout"
import { cn } from "@/lib/utils"
import { useApp } from "./app-provider"

// iOS-style tab bar for phones: the four most-used places, plus "More",
// which opens a sheet with every page, grouped as in the top bar.
export function MobileTabBar() {
  const pathname = usePathname()
  const view = useSearchParams().get("view")
  const [moreOpen, setMoreOpen] = useState(false)
  const { user } = useApp()
  const handleLogout = useLogout()
  const activeHref = findNavItem(pathname)?.href
  // Close the sheet once a page is chosen
  useEffect(() => setMoreOpen(false), [pathname, view])
=======
import { Menu } from "lucide-react"
import { useSidebar } from "@/components/ui/sidebar"
import { TAB_BAR } from "@/lib/navigation"
import { cn } from "@/lib/utils"

// iOS-style tab bar for phones: the four most-used places, plus "More",
// which opens the full navigation drawer.
export function MobileTabBar() {
  const pathname = usePathname()
  const view = useSearchParams().get("view")
  const { setOpenMobile, openMobile } = useSidebar()
>>>>>>> origin/claude/tender-gates-d8wf98
  const anyTabActive = TAB_BAR.some((tab) => tab.isActive(pathname, view))

  return (
    <nav
      aria-label="Main"
      className="fixed inset-x-0 bottom-0 z-30 border-t border-border/70 bg-card/85 pb-[env(safe-area-inset-bottom)] backdrop-blur-xl supports-[backdrop-filter]:bg-card/75 md:hidden"
    >
      <ul className="mx-auto grid h-16 max-w-md grid-cols-5">
        {TAB_BAR.map((tab) => {
          const active = tab.isActive(pathname, view)
          return (
            <li key={tab.title}>
              <Link
                href={tab.href}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "flex h-full flex-col items-center justify-center gap-1 text-[11px] font-semibold transition-colors",
                  active ? "text-primary" : "text-muted-foreground active:text-foreground",
                )}
              >
                <tab.icon className={cn("h-[22px] w-[22px]", active && "stroke-[2.25]")} />
                {tab.title}
              </Link>
            </li>
          )
        })}
        <li>
          <button
<<<<<<< HEAD
            onClick={() => setMoreOpen(true)}
            aria-expanded={moreOpen}
=======
            onClick={() => setOpenMobile(true)}
            aria-expanded={openMobile}
>>>>>>> origin/claude/tender-gates-d8wf98
            className={cn(
              "flex h-full w-full flex-col items-center justify-center gap-1 text-[11px] font-semibold transition-colors",
              !anyTabActive ? "text-primary" : "text-muted-foreground active:text-foreground",
            )}
          >
            <Menu className="h-[22px] w-[22px]" />
            More
          </button>
        </li>
      </ul>
<<<<<<< HEAD

      <Sheet open={moreOpen} onOpenChange={setMoreOpen}>
        <SheetContent side="bottom" className="rounded-t-2xl px-4 pb-[calc(1.25rem+env(safe-area-inset-bottom))] pt-5">
          <SheetTitle className="px-2 text-lg">All pages</SheetTitle>
          <SheetDescription className="sr-only">Every page in DaryelCare, grouped</SheetDescription>
          <div className="mt-3 space-y-4">
            {visibleGroups(user?.role === "admin").map((group) => (
              <div key={group.label}>
                <p className="eyebrow px-2 pb-1.5">{group.label}</p>
                <ul className="space-y-0.5">
                  {group.items.map((item) => {
                    const active = activeHref === item.href
                    return (
                      <li key={item.href}>
                        <Link
                          href={item.href}
                          aria-current={active ? "page" : undefined}
                          onClick={() => setMoreOpen(false)}
                          className={cn(
                            "flex h-12 items-center gap-3 rounded-xl px-3 text-[15px] font-medium transition-colors",
                            active
                              ? "bg-primary-soft font-semibold text-primary"
                              : "text-foreground active:bg-secondary",
                          )}
                        >
                          <item.icon className={cn("h-5 w-5", active ? "text-primary" : "text-muted-foreground")} />
                          {item.title}
                        </Link>
                      </li>
                    )
                  })}
                </ul>
              </div>
            ))}
            <div className="mx-2 h-px bg-border/70" aria-hidden />
            <button
              onClick={handleLogout}
              className="flex h-12 w-full items-center gap-3 rounded-xl px-3 text-[15px] font-medium text-destructive active:bg-danger-soft"
            >
              <LogOut className="h-5 w-5" />
              Log out
            </button>
          </div>
        </SheetContent>
      </Sheet>
=======
>>>>>>> origin/claude/tender-gates-d8wf98
    </nav>
  )
}
