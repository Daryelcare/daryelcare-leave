"use client"

import Image from "next/image"
import type React from "react"
import { DashboardSidebar } from "@/components/dashboard-sidebar"
import { DashboardHeader } from "@/components/dashboard-header"
import { MobileTabBar } from "@/components/mobile-tab-bar"
import { SidebarProvider } from "@/components/ui/sidebar"
import { Toaster } from "@/components/ui/toaster"
import { useApp } from "@/components/app-provider"
import { usePathname, useRouter } from "next/navigation"
import { Suspense, useEffect, useState } from "react"
import { getCurrentUser } from "@/lib/auth"
import { supabase } from "@/lib/supabase"

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const pathname = usePathname()
  return (
    <SidebarProvider>
      <AuthCheck>
        <DashboardSidebar />
        {/* min-w-0 lets wide tables scroll inside their card instead of stretching the page */}
        <div className="flex min-h-svh min-w-0 flex-1 flex-col bg-background">
          <DashboardHeader />
          <main className="flex-1">
            <div
              key={pathname}
              className="page-enter mx-auto w-full max-w-[1360px] px-4 pb-28 pt-6 sm:px-6 sm:pt-8 md:pb-12 lg:px-10 lg:pt-9"
            >
              {children}
            </div>
          </main>
        </div>
        <Suspense fallback={null}>
          <MobileTabBar />
        </Suspense>
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
      <div className="flex min-h-svh w-full flex-col items-center justify-center gap-5 bg-background">
        <Image src="/images/daryelcare-mark.png" alt="DaryelCare" width={48} height={48} priority className="animate-pulse" />
        <div className="h-1 w-24 overflow-hidden rounded-full bg-secondary">
          <div className="h-full w-1/2 animate-shimmer rounded-full bg-[linear-gradient(90deg,transparent,hsl(var(--primary)),transparent)] bg-[length:200%_100%]" />
        </div>
        <span className="sr-only">{isChecking ? "Loading" : "Redirecting to login"}</span>
      </div>
    )
  }

  return <>{children}</>
}
