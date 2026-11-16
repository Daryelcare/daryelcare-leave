"use client"

import Image from "next/image"
import type React from "react"
import { TopNav } from "@/components/top-nav"
import { SidebarContent } from "@/components/app-sidebar"
import { ChooseNewPassword } from "@/components/choose-new-password"
import { QuickSearch } from "@/components/quick-search"
import { MobileTabBar } from "@/components/mobile-tab-bar"
import { Toaster } from "@/components/ui/toaster"
import { useApp } from "@/components/app-provider"
import { usePathname, useRouter } from "next/navigation"
import { Suspense, useEffect, useState } from "react"
import { getCurrentUser } from "@/lib/auth"
import { supabase } from "@/lib/supabase"
import { fetchWithAuth } from "@/lib/api-utils"

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  return (
    <>
      <AuthCheck>
        {/* Floating sidebar from lg up; below that a compact top bar with a menu button */}
        <div className="min-h-svh min-w-0 bg-background">
          <aside className="fixed inset-y-3 left-3 z-30 hidden w-[248px] overflow-y-auto rounded-[28px] bg-card shadow-soft lg:block">
            <SidebarContent />
          </aside>
          <TopNav />
          {/* min-w-0 lets wide tables scroll inside their card instead of stretching the page */}
          <main className="min-w-0 lg:pl-[272px]">
            <div
              key={pathname}
              className="page-enter mx-auto w-full max-w-[1240px] px-4 pb-28 pt-5 sm:px-6 sm:pt-7 md:pb-12 lg:px-8 lg:pt-8"
            >
              {children}
            </div>
          </main>
        </div>
        <Suspense fallback={null}>
          <MobileTabBar />
        </Suspense>
        <QuickSearch />
      </AuthCheck>
      <Toaster />
    </>
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
            permissions: currentUser.permissions ?? null,
            mustChangePassword: currentUser.mustChangePassword === true,
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

  // Coming back to the app (tab or phone brought back) counts as a visit, so
  // "Last visit" on Users & access stays exact. Opening it is recorded by the
  // profile load; at most one ping every 5 minutes after that.
  const signedIn = !!user
  useEffect(() => {
    if (!signedIn) return
    let last = Date.now()
    const ping = () => {
      if (document.visibilityState !== "visible" || Date.now() - last < 5 * 60_000) return
      last = Date.now()
      fetchWithAuth("/api/users/me/seen", { method: "POST" }).catch((e) => console.error("Couldn't record a visit:", e))
    }
    document.addEventListener("visibilitychange", ping)
    window.addEventListener("focus", ping)
    return () => {
      document.removeEventListener("visibilitychange", ping)
      window.removeEventListener("focus", ping)
    }
  }, [signedIn])

  // While checking, show the page straight away if we have a saved user,
  // otherwise a spinner
  if (!user) {
    return (
      <div className="flex min-h-svh w-full flex-col items-center justify-center gap-5 bg-background">
        <Image
          src="/images/daryelcare-mark.png"
          alt="DaryelCare"
          width={48}
          height={48}
          priority
          className="animate-pulse"
        />
        <div className="h-1 w-24 overflow-hidden rounded-full bg-secondary">
          <div className="h-full w-1/2 animate-shimmer rounded-full bg-[linear-gradient(90deg,transparent,hsl(var(--primary)),transparent)] bg-[length:200%_100%]" />
        </div>
        <span className="sr-only">{isChecking ? "Loading" : "Redirecting to login"}</span>
      </div>
    )
  }

  // A one-time password change (or a new / reset account): nothing else until it's done
  if (user.mustChangePassword) return <ChooseNewPassword />

  return <>{children}</>
}
