"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { Menu } from "lucide-react"
import { useSidebar } from "@/components/ui/sidebar"
import { NAV_GROUPS, TAB_BAR_HREFS, findNavItem } from "@/lib/navigation"
import { cn } from "@/lib/utils"

// iOS-style tab bar for phones: the four most-used places, plus "More",
// which opens the full navigation drawer.
export function MobileTabBar() {
  const pathname = usePathname()
  const { setOpenMobile, openMobile } = useSidebar()
  const activeHref = findNavItem(pathname)?.href
  const tabs = NAV_GROUPS.flatMap((g) => g.items).filter((item) => TAB_BAR_HREFS.includes(item.href))
  tabs.sort((a, b) => TAB_BAR_HREFS.indexOf(a.href) - TAB_BAR_HREFS.indexOf(b.href))
  const moreActive = !!activeHref && !TAB_BAR_HREFS.includes(activeHref)

  return (
    <nav
      aria-label="Main"
      className="fixed inset-x-0 bottom-0 z-30 border-t border-border/70 bg-card/85 pb-[env(safe-area-inset-bottom)] backdrop-blur-xl supports-[backdrop-filter]:bg-card/75 md:hidden"
    >
      <ul className="mx-auto grid h-16 max-w-md grid-cols-5">
        {tabs.map((tab) => {
          const active = activeHref === tab.href
          return (
            <li key={tab.href}>
              <Link
                href={tab.href}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "flex h-full flex-col items-center justify-center gap-1 text-[11px] font-semibold transition-colors",
                  active ? "text-primary" : "text-muted-foreground active:text-foreground",
                )}
              >
                <tab.icon className={cn("h-[22px] w-[22px]", active && "stroke-[2.25]")} />
                {tab.short || tab.title}
              </Link>
            </li>
          )
        })}
        <li>
          <button
            onClick={() => setOpenMobile(true)}
            aria-expanded={openMobile}
            className={cn(
              "flex h-full w-full flex-col items-center justify-center gap-1 text-[11px] font-semibold transition-colors",
              moreActive ? "text-primary" : "text-muted-foreground active:text-foreground",
            )}
          >
            <Menu className="h-[22px] w-[22px]" />
            More
          </button>
        </li>
      </ul>
    </nav>
  )
}
