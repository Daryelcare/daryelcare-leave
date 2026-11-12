import {
  BarChart3,
  Building2,
  CalendarCheck2,
  CalendarDays,
  CalendarRange,
  FileText,
  LayoutGrid,
  KeyRound,
  type LucideIcon,
  Palette,
  Settings,
  ShieldCheck,
  SlidersHorizontal,
  UserRound,
  Users,
} from "lucide-react"

// One place that defines the app's navigation, used by the top bar, the
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
    label: "Workspace",
    items: [{ title: "Settings", href: "/dashboard/settings", icon: Settings }],
  },
]

/** The team calendar is a view of the Leave page */
export const LEAVE_PATH = "/dashboard/leave-management"
export const LEAVE_CALENDAR_HREF = `${LEAVE_PATH}?view=calendar`

/**
 * Phone tab bar (everything else lives in the "More" drawer). Leave and
 * Calendar are the same page in two views, told apart by ?view=calendar.
 */
export const TAB_BAR: { title: string; href: string; icon: LucideIcon; isActive: (path: string, view: string | null) => boolean }[] = [
  { title: "Home", href: "/dashboard", icon: LayoutGrid, isActive: (p) => p === "/dashboard" },
  { title: "Leave", href: LEAVE_PATH, icon: CalendarDays, isActive: (p, v) => p === LEAVE_PATH && v !== "calendar" },
  { title: "Calendar", href: LEAVE_CALENDAR_HREF, icon: CalendarRange, isActive: (p, v) => p === LEAVE_PATH && v === "calendar" },
  { title: "People", href: "/dashboard/employees", icon: Users, isActive: (p) => p.startsWith("/dashboard/employees") },
]

export function visibleGroups(isAdmin: boolean): NavGroup[] {
  return NAV_GROUPS.map((group) => ({ ...group, items: group.items.filter((item) => isAdmin || !item.adminOnly) })).filter(
    (group) => group.items.length > 0,
  )
}

/**
 * Settings sections. Users, branches, leave types, leave periods and
 * maintenance all live here (admins only), picked with ?section=.
 */
export type SettingsSection = {
  id: string
  title: string
  description: string
  icon: LucideIcon
  group: "Personal" | "Organisation"
  adminOnly?: boolean
}

export const SETTINGS_SECTIONS: SettingsSection[] = [
  { id: "account", title: "Account", description: "Your profile, role and branches.", icon: UserRound, group: "Personal" },
  { id: "password", title: "Password", description: "Change the password you sign in with.", icon: KeyRound, group: "Personal" },
  {
    id: "users",
    title: "Users & access",
    description: "Who can sign in, their role, and which branches they manage.",
    icon: ShieldCheck,
    group: "Organisation",
    adminOnly: true,
  },
  {
    id: "branches",
    title: "Branches",
    description: "The branches your staff work in, used to group people and manager access.",
    icon: Building2,
    group: "Organisation",
    adminOnly: true,
  },
  {
    id: "leave-types",
    title: "Leave types",
    description: "The kinds of leave that can be recorded, and their colour on the calendar.",
    icon: Palette,
    group: "Organisation",
    adminOnly: true,
  },
  {
    id: "leave-periods",
    title: "Leave periods",
    description: "Each leave year runs between two dates. Starting a new one resets active employees to 28 days.",
    icon: CalendarCheck2,
    group: "Organisation",
    adminOnly: true,
  },
  {
    id: "advanced",
    title: "Advanced",
    description: "Organisation-wide maintenance actions.",
    icon: SlidersHorizontal,
    group: "Organisation",
    adminOnly: true,
  },
]

export const settingsHref = (section: string) => `/dashboard/settings?section=${section}`

export function visibleSettingsSections(isAdmin: boolean): SettingsSection[] {
  return SETTINGS_SECTIONS.filter((s) => isAdmin || !s.adminOnly)
}

const EXTRA_TITLES: Record<string, string> = {}

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
