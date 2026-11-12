import {
  BarChart3,
  Building2,
  CalendarCheck2,
  CalendarDays,
  CalendarRange,
  FileText,
  LayoutGrid,
  type LucideIcon,
  Settings,
  ShieldCheck,
  Users,
} from "lucide-react"

// One place that defines the app's navigation, used by the sidebar, the
// mobile tab bar and the page titles in the header.

export type NavItem = {
  title: string
  href: string
  icon: LucideIcon
  adminOnly?: boolean
  /** Shorter label for the phone tab bar */
  short?: string
}

export type NavGroup = { label: string; items: NavItem[] }

export const NAV_GROUPS: NavGroup[] = [
  {
    label: "Overview",
    items: [
      { title: "Dashboard", short: "Home", href: "/dashboard", icon: LayoutGrid },
      { title: "Team Calendar", short: "Calendar", href: "/dashboard/calendar", icon: CalendarRange },
    ],
  },
  {
    label: "People",
    items: [
      { title: "Employees", short: "People", href: "/dashboard/employees", icon: Users },
      { title: "Leave", short: "Leave", href: "/dashboard/leave-management", icon: CalendarDays },
      { title: "Documents", href: "/dashboard/document-tracker", icon: FileText, adminOnly: true },
      { title: "Reports", href: "/dashboard/reports", icon: BarChart3, adminOnly: true },
    ],
  },
  {
    label: "Administration",
    items: [
      { title: "Users & Access", href: "/dashboard/user-management", icon: ShieldCheck, adminOnly: true },
      { title: "Branches", href: "/dashboard/admin/branches", icon: Building2, adminOnly: true },
      { title: "Leave Periods", href: "/dashboard/admin/leave-periods", icon: CalendarCheck2, adminOnly: true },
      { title: "Settings", href: "/dashboard/settings", icon: Settings },
    ],
  },
]

/** Items in the phone tab bar (the rest live in the "More" drawer) */
export const TAB_BAR_HREFS = ["/dashboard", "/dashboard/calendar", "/dashboard/leave-management", "/dashboard/employees"]

export function visibleGroups(isAdmin: boolean): NavGroup[] {
  return NAV_GROUPS.map((group) => ({ ...group, items: group.items.filter((item) => isAdmin || !item.adminOnly) })).filter(
    (group) => group.items.length > 0,
  )
}

const EXTRA_TITLES: Record<string, string> = {
  "/dashboard/change-password": "Change Password",
}

/** The nav item a path belongs to (longest matching prefix). */
export function findNavItem(pathname: string): NavItem | undefined {
  const all = NAV_GROUPS.flatMap((g) => g.items)
  return all
    .filter((item) => pathname === item.href || (item.href !== "/dashboard" && pathname.startsWith(item.href + "/")))
    .sort((a, b) => b.href.length - a.href.length)[0]
}

export function pageTitle(pathname: string): string {
  return EXTRA_TITLES[pathname] || findNavItem(pathname)?.title || "DaryelCare"
}
