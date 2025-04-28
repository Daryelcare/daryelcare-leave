"use client"
import Link from "next/link"
import { usePathname, useRouter } from "next/navigation"
import { BarChart3, FileText, LayoutDashboard, LogOut, Settings, Users, Calendar, FolderArchive } from "lucide-react"
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  useSidebar,
} from "@/components/ui/sidebar"
import { useApp } from "./app-provider"
import { Badge } from "./ui/badge"

export function DashboardSidebar() {
  const pathname = usePathname()
  const router = useRouter()
  const { setOpen } = useSidebar()
  const { user } = useApp()

  const isAdmin = user?.role === "admin"

  // Define routes based on user role
  const routes = [
    {
      title: "Dashboard",
      href: "/dashboard",
      icon: LayoutDashboard,
      showFor: "all", // Show for all users
    },
    {
      title: "Employees",
      href: "/dashboard/employees",
      icon: Users,
      showFor: "all", // Show for all users
    },
    {
      title: "Leave Management",
      href: "/dashboard/leave-management",
      icon: Calendar,
      showFor: "all", // Show for all users
    },
    {
      title: "Document Tracker",
      href: "/dashboard/document-tracker",
      icon: FileText,
      showFor: "admin", // Admin only
    },
    {
      title: "Reports",
      href: "/dashboard/reports",
      icon: BarChart3,
      showFor: "admin", // Admin only
    },
    {
      title: "User Management",
      href: "/dashboard/user-management",
      icon: FolderArchive,
      showFor: "admin", // Admin only
    },
    {
      title: "Settings",
      href: "/dashboard/settings",
      icon: Settings,
      showFor: "all", // Show for all users
    },
  ]

  // Filter routes based on user role
  const filteredRoutes = routes.filter((route) => route.showFor === "all" || (route.showFor === "admin" && isAdmin))

  // Handle navigation and close sidebar on mobile
  const handleNavigation = (href: string) => {
    router.push(href)
    // Close sidebar on mobile after navigation
    if (window.innerWidth < 768) {
      setOpen(false)
    }
  }

  return (
    <Sidebar>
      <SidebarHeader className="border-b border-border/40">
        <div className="flex flex-col h-auto px-4 py-3">
          <Link href="/dashboard" className="flex items-center gap-2">
            <div className="h-8 w-8 rounded-md bg-gradient-to-br from-purple-600 to-blue-500 flex items-center justify-center">
              <Calendar className="h-5 w-5 text-white" />
            </div>
            <span className="font-semibold text-lg">LeaveManager</span>
          </Link>

          {/* Display assigned branches */}
          {user && user.branches && user.branches.length > 0 && (
            <div className="mt-2 flex flex-wrap gap-1">
              {user.branches.map((branch, index) => (
                <Badge key={index} variant="outline" className="text-xs">
                  {branch}
                </Badge>
              ))}
            </div>
          )}
        </div>
      </SidebarHeader>
      <SidebarContent>
        <SidebarMenu>
          {filteredRoutes.map((route) => (
            <SidebarMenuItem key={route.href}>
              <SidebarMenuButton
                isActive={pathname === route.href}
                tooltip={route.title}
                onClick={() => handleNavigation(route.href)}
              >
                <route.icon className="h-5 w-5" />
                <span>{route.title}</span>
              </SidebarMenuButton>
            </SidebarMenuItem>
          ))}
        </SidebarMenu>
      </SidebarContent>
      <SidebarFooter>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton onClick={() => handleNavigation("/login")}>
              <LogOut className="h-5 w-5" />
              <span>Logout</span>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarFooter>
    </Sidebar>
  )
}
