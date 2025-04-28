"use client"

import type React from "react"
import { DashboardSidebar } from "@/components/dashboard-sidebar"
import { DashboardHeader } from "@/components/dashboard-header"
import { SidebarProvider } from "@/components/ui/sidebar"
import { Toaster } from "@/components/ui/toaster"
import { useApp } from "@/components/app-provider"
import { redirect } from "next/navigation"
import { useEffect, useState } from "react"
import { getCurrentUser } from "@/lib/auth"

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <SidebarProvider>
      <AuthCheck>
        <div className="flex min-h-screen bg-gray-50">
          <DashboardSidebar />
          <div className="flex flex-col flex-1 w-full">
            <DashboardHeader />
            <main className="flex-1 p-6 w-full overflow-x-auto">{children}</main>
          </div>
        </div>
      </AuthCheck>
      <Toaster />
    </SidebarProvider>
  )
}

// Client-side authentication check component
function AuthCheck({ children }: { children: React.ReactNode }) {
  const { user, isAuthenticated, setUser } = useApp()
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    // If we already have a user in context, no need to fetch again
    if (isAuthenticated) {
      setIsLoading(false)
      return
    }

    // Try to get the current user from Supabase session
    async function checkAuth() {
      try {
        const currentUser = await getCurrentUser()
        if (currentUser) {
          // Convert currentUser to match the User type in AppProvider
          setUser({
            id: currentUser.id,
            name: currentUser.name || "Unknown User",
            email: currentUser.email,
            role: currentUser.role,
            branches: currentUser.branches || [],
          })
        } else {
          // No authenticated user found, redirect to login
          redirect("/login")
        }
      } catch (error) {
        console.error("Authentication check failed:", error)
        // On error, redirect to login
        redirect("/login")
      } finally {
        setIsLoading(false)
      }
    }

    checkAuth()
  }, [isAuthenticated, setUser])

  // Show nothing while we're checking authentication
  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-r-transparent"></div>
      </div>
    )
  }

  // If we get here, user is authenticated
  return <>{children}</>
}
