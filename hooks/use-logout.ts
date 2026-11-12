"use client"

import { useCallback } from "react"
import { useRouter } from "next/navigation"
import { useQueryClient } from "@tanstack/react-query"
import { useApp } from "@/components/app-provider"
import { signOut } from "@/lib/auth"
import { toast } from "@/hooks/use-toast"

// Signs the user out of Supabase, forgets the saved user and cached data,
// and goes to the login page. Used by both the header menu and the sidebar.
export function useLogout() {
  const router = useRouter()
  const queryClient = useQueryClient()
  const { setUser } = useApp()

  return useCallback(async () => {
    try {
      await signOut()
    } catch (error) {
      console.error("Logout error:", error)
      toast({
        variant: "destructive",
        title: "Logout problem",
        description: "We couldn't reach the server, but you have been logged out on this device.",
      })
    } finally {
      setUser(null)
      queryClient.clear()
      router.replace("/login")
    }
  }, [router, queryClient, setUser])
}
