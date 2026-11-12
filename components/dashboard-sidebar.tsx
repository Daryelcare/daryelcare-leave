"use client"

import { useEffect } from "react"
import Image from "next/image"
import Link from "next/link"
import { usePathname } from "next/navigation"
import { ChevronsUpDown, KeyRound, LogOut, Settings } from "lucide-react"
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  useSidebar,
} from "@/components/ui/sidebar"
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
import { findNavItem, settingsHref, visibleGroups } from "@/lib/navigation"
import { Avatar } from "./page-kit"

export function DashboardSidebar() {
  const pathname = usePathname()
  const { user } = useApp()
  const { isMobile, setOpenMobile, state } = useSidebar()
  const handleLogout = useLogout()
  const isAdmin = user?.role === "admin"
  const activeHref = findNavItem(pathname)?.href
  const collapsed = state === "collapsed" && !isMobile

  // Tablets and small laptops: start with the icon-only sidebar to give pages room
  const { setOpen } = useSidebar()
  useEffect(() => {
    if (window.innerWidth >= 768 && window.innerWidth < 1200) setOpen(false)
    // Only when the app first opens
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Close the drawer after choosing a page on phones
  const closeOnMobile = () => {
    if (isMobile) setOpenMobile(false)
  }

  const branchSummary = isAdmin
    ? "All branches"
    : user?.branches && user.branches.length > 0
      ? user.branches.join(", ")
      : "No branches assigned"

  return (
    <Sidebar collapsible="icon">
      <SidebarHeader className="px-3 pb-2 pt-4">
        <Link
          href="/dashboard"
          onClick={closeOnMobile}
          className="flex h-10 items-center rounded-lg px-1.5 outline-none focus-visible:ring-[3px] focus-visible:ring-ring/30 group-data-[collapsible=icon]:justify-center group-data-[collapsible=icon]:px-0"
          aria-label="DaryelCare home"
        >
          {collapsed ? (
            <Image src="/images/daryelcare-mark.png" alt="" width={30} height={30} priority />
          ) : (
            <Image src="/images/daryelcare-wordmark.png" alt="DaryelCare" width={150} height={26} priority className="h-[26px] w-auto" />
          )}
        </Link>
      </SidebarHeader>

      <SidebarContent className="px-1.5">
        {visibleGroups(isAdmin).map((group) => (
          <SidebarGroup key={group.label} className="py-1.5">
            <SidebarGroupLabel>{group.label}</SidebarGroupLabel>
            <SidebarMenu>
              {group.items.map((item) => (
                <SidebarMenuItem key={item.href}>
                  <SidebarMenuButton asChild isActive={activeHref === item.href} tooltip={item.title}>
                    <Link href={item.href} onClick={closeOnMobile}>
                      <item.icon />
                      <span>{item.title}</span>
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroup>
        ))}
      </SidebarContent>

      <SidebarFooter className="flex-row items-center gap-1 border-t border-sidebar-border p-2.5">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button
              className="flex min-w-0 flex-1 items-center gap-3 rounded-lg p-1.5 text-left outline-none transition-colors hover:bg-sidebar-accent focus-visible:ring-[3px] focus-visible:ring-ring/30 group-data-[collapsible=icon]:justify-center group-data-[collapsible=icon]:p-1"
              aria-label="Account menu"
            >
              <Avatar name={user?.name} />
              <span className="min-w-0 flex-1 group-data-[collapsible=icon]:hidden">
                <span className="block truncate text-sm font-semibold text-foreground">{user?.name || "Account"}</span>
                <span className="block truncate text-xs text-muted-foreground">{branchSummary}</span>
              </span>
              <ChevronsUpDown className="h-4 w-4 shrink-0 text-muted-foreground group-data-[collapsible=icon]:hidden" />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent side={isMobile ? "top" : "right"} align="end" className="w-60">
            <DropdownMenuLabel className="space-y-0.5">
              <p className="truncate font-semibold">{user?.name}</p>
              <p className="truncate text-xs font-normal text-muted-foreground">{user?.email}</p>
              <p className="pt-1 text-xs font-medium text-primary">{isAdmin ? "Administrator" : "Branch manager"}</p>
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem asChild>
              <Link href="/dashboard/settings" onClick={closeOnMobile}>
                <Settings />
                Settings
              </Link>
            </DropdownMenuItem>
            <DropdownMenuItem asChild>
              <Link href={settingsHref("password")} onClick={closeOnMobile}>
                <KeyRound />
                Change password
              </Link>
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={handleLogout} className="text-destructive focus:text-destructive [&_svg]:!text-destructive">
              <LogOut />
              Log out
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
        <button
          onClick={handleLogout}
          title="Log out"
          aria-label="Log out"
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-destructive-soft hover:text-destructive focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-ring/30 group-data-[collapsible=icon]:hidden"
        >
          <LogOut className="h-[18px] w-[18px]" />
        </button>
      </SidebarFooter>
    </Sidebar>
  )
}
