"use client"

import Image from "next/image"
import Link from "next/link"
import { usePathname, useSearchParams } from "next/navigation"
import { useEffect, useState } from "react"
import { ChevronRight } from "lucide-react"
import { cn } from "@/lib/utils"
import { SidebarTrigger } from "@/components/ui/sidebar"
import { NAV_GROUPS, SETTINGS_SECTIONS, findNavItem, pageTitle } from "@/lib/navigation"

// Slim top bar. Desktop: sidebar toggle and a breadcrumb.
// Phone: the DaryelCare mark and the current page name.
export function DashboardHeader() {
  const pathname = usePathname()
  const item = findNavItem(pathname)
  const group = NAV_GROUPS.find((g) => g.items.some((i) => i.href === item?.href))
  const title = pageTitle(pathname)
  const searchParams = useSearchParams()
  const subtitle =
    pathname === "/dashboard/settings"
      ? SETTINGS_SECTIONS.find((s) => s.id === searchParams.get("section"))?.title
      : pathname === "/dashboard/leave-management" && searchParams.get("view") === "calendar"
        ? "Calendar"
        : undefined

  // Phones: the page already shows a large title, so the bar only shows it
  // once you've scrolled past it (like iOS large titles)
  const [scrolled, setScrolled] = useState(false)
  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 56)
    onScroll()
    window.addEventListener("scroll", onScroll, { passive: true })
    return () => window.removeEventListener("scroll", onScroll)
  }, [pathname])

  return (
    <header className="sticky top-0 z-20 flex h-14 shrink-0 items-center gap-2 border-b border-border/70 transition-colors bg-background/80 px-3 backdrop-blur-xl supports-[backdrop-filter]:bg-background/70 sm:px-5">
      <SidebarTrigger className="hidden md:inline-flex" />
      <div className="mx-1 hidden h-5 w-px bg-border md:block" aria-hidden />

      {/* Phone: brand mark + page title */}
      <Link href="/dashboard" className="-ml-1.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-lg md:hidden" aria-label="DaryelCare home">
        <Image src="/images/daryelcare-mark.png" alt="" width={28} height={28} priority />
      </Link>
      <p
        className={cn(
          "truncate font-display text-[15px] font-semibold tracking-[-0.01em] transition-[opacity,transform] duration-200 ease-smooth md:hidden",
          scrolled ? "translate-y-0 opacity-100" : "translate-y-1 opacity-0",
        )}
        aria-hidden={!scrolled}
      >
        {title}
      </p>

      {/* Desktop: breadcrumb */}
      <nav aria-label="Breadcrumb" className="hidden items-center gap-1.5 text-sm md:flex">
        {group && <span className="text-muted-foreground">{group.label}</span>}
        {group && <ChevronRight className="h-3.5 w-3.5 text-muted-foreground/60" aria-hidden />}
        <span className={subtitle ? "text-muted-foreground" : "font-semibold text-foreground"}>{title}</span>
        {subtitle && <ChevronRight className="h-3.5 w-3.5 text-muted-foreground/60" aria-hidden />}
        {subtitle && <span className="font-semibold text-foreground">{subtitle}</span>}
      </nav>
    </header>
  )
}
