"use client"

import { useEffect, useState } from "react"
import Image from "next/image"
import Link from "next/link"
import { usePathname } from "next/navigation"
import { Menu } from "lucide-react"
import { DropdownMenu, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"
import { Sheet, SheetContent, SheetDescription, SheetTitle } from "@/components/ui/sheet"
import { pageTitle } from "@/lib/navigation"
import { cn } from "@/lib/utils"
import { useApp } from "./app-provider"
import { AccountMenuItems, SidebarContent } from "./app-sidebar"
import { Avatar } from "./page-kit"

/**
 * Compact bar for screens narrower than `lg`, where the floating sidebar is
 * hidden: logo, page name, the menu button (opens the sidebar in a sheet on
 * tablets; phones use the bottom tab bar) and the account menu.
 */
export function TopNav() {
  const pathname = usePathname()
  const { user } = useApp()
  const [menuOpen, setMenuOpen] = useState(false)
  const [scrolled, setScrolled] = useState(false)

  useEffect(() => setMenuOpen(false), [pathname])
  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 8)
    onScroll()
    window.addEventListener("scroll", onScroll, { passive: true })
    return () => window.removeEventListener("scroll", onScroll)
  }, [pathname])

  return (
    <header className="sticky top-0 z-30 px-3 pt-2 sm:px-4 lg:hidden">
      <div
        className={cn(
          "flex h-12 items-center gap-2 rounded-full bg-card/90 pl-1.5 pr-1.5 backdrop-blur-xl transition-shadow duration-300 supports-[backdrop-filter]:bg-card/80",
          scrolled ? "shadow-soft-hover" : "shadow-soft",
        )}
      >
        <button
          type="button"
          onClick={() => setMenuOpen(true)}
          aria-label="Open menu"
          aria-expanded={menuOpen}
          className="hidden h-9 w-9 shrink-0 items-center justify-center rounded-full bg-secondary text-secondary-foreground outline-none transition-colors hover:text-foreground focus-visible:ring-2 focus-visible:ring-primary/70 md:flex"
        >
          <Menu className="h-[18px] w-[18px]" />
        </button>
        <Link
          href="/dashboard"
          aria-label="DaryelCare home"
          className="flex h-9 shrink-0 items-center gap-2 rounded-full px-1.5 outline-none focus-visible:ring-2 focus-visible:ring-primary/70"
        >
          <Image src="/images/daryelcare-mark.png" alt="" width={26} height={26} priority />
        </Link>
        <p className="min-w-0 flex-1 truncate font-display text-[15px] font-bold tracking-[-0.01em]">
          {pageTitle(pathname)}
        </p>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button
              aria-label="Account menu"
              className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full outline-none focus-visible:ring-2 focus-visible:ring-primary/70"
            >
              <Avatar name={user?.name} className="h-8 w-8 text-[11px]" />
            </button>
          </DropdownMenuTrigger>
          <AccountMenuItems />
        </DropdownMenu>
      </div>

      <Sheet open={menuOpen} onOpenChange={setMenuOpen}>
        <SheetContent side="left" className="w-[272px] max-w-[85vw] p-0 sm:max-w-[272px]">
          <SheetTitle className="sr-only">Menu</SheetTitle>
          <SheetDescription className="sr-only">Every page in DaryelCare</SheetDescription>
          <SidebarContent onNavigate={() => setMenuOpen(false)} />
        </SheetContent>
      </Sheet>
    </header>
  )
}
