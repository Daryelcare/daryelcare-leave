"use client"

import type React from "react"
import { DashboardSidebar } from "@/components/dashboard-sidebar"
import { DashboardHeader } from "@/components/dashboard-header"
import { SidebarProvider } from "@/components/ui/sidebar"
import { Toaster } from "@/components/ui/toaster"
import { useApp } from "@/components/app-provider"
import { useRouter } from "next/navigation"
import { useEffect, useState } from "react"
import { getCurrentUser } from "@/lib/auth"
import { supabase } from "@/lib/supabase"

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

// Client-side authentication check.
// The saved user in the browser is only a cache: we also confirm there is a
// live Supabase session, and refresh the user's role and branches from the
// database. If the session is gone (logged out, expired, or logged out in
// another tab), the user is sent back to the login page.
function AuthCheck({ children }: { children: React.ReactNode }) {
  const { user, setUser } = useApp()
  const router = useRouter()
  const [isChecking, setIsChecking] = useState(true)

  useEffect(() => {
    let cancelled = false

    async function checkAuth() {
      try {
        const currentUser = await getCurrentUser()
        if (cancelled) return
        if (currentUser) {
          setUser({
            id: currentUser.id,
            name: currentUser.name || currentUser.email.split("@")[0],
            email: currentUser.email,
            role: currentUser.role,
            branches: currentUser.branches || [],
          })
        } else {
          setUser(null)
          router.replace("/login")
        }
      } catch (error) {
        console.error("Authentication check failed:", error)
        if (!cancelled) {
          setUser(null)
          router.replace("/login")
        }
      } finally {
        if (!cancelled) setIsChecking(false)
      }
    }

    checkAuth()

    const { data: subscription } = supabase.auth.onAuthStateChange((event) => {
      if (event === "SIGNED_OUT") {
        setUser(null)
        router.replace("/login")
      }
    })

    return () => {
      cancelled = true
      subscription.subscription.unsubscribe()
    }
  }, [router, setUser])

  // While checking, show the page straight away if we have a saved user,
  // otherwise a spinner
  if (!user) {
    return (
      <div className="flex min-h-screen w-full items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-r-transparent"></div>
        {!isChecking && <span className="sr-only">Redirecting to login</span>}
      </div>
    )
  }

  return <>{children}</>
}
