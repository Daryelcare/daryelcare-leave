"use client"

import type React from "react"

import { createContext, useContext, useState, useEffect } from "react"
import type { UserRole } from "@/lib/types"
import { BUILT_IN_DEFAULTS, type PermissionKey, type PermissionSet } from "@/lib/permissions"

type User = {
  id: string
  name: string
  email: string
  role: UserRole
  branches?: string[]
  avatar?: string
  permissions?: PermissionSet | null
}

/**
 * Whether the signed-in person may do something. Admins always may; for branch
 * managers it's what an admin has allowed. Used to hide what's turned off; the
 * server checks it again on every request.
 */
export function canDo(user: { role?: string; permissions?: PermissionSet | null } | null, key: PermissionKey) {
  if (!user) return false
  if (user.role === "admin") return true
  return (user.permissions ?? BUILT_IN_DEFAULTS)[key] === true
}

export function useCan() {
  const { user } = useApp()
  return (key: PermissionKey) => canDo(user, key)
}

type AppContextType = {
  user: User | null
  setUser: (user: User | null) => void
  isAuthenticated: boolean
}

const AppContext = createContext<AppContextType | undefined>(undefined)

export function AppProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [isInitialized, setIsInitialized] = useState(false)

  // Initialize auth state when the component mounts
  useEffect(() => {
    // Check if we have a user in localStorage
    const storedUser = localStorage.getItem("user")

    if (storedUser) {
      try {
        const parsedUser = JSON.parse(storedUser)
        setUser(parsedUser)
      } catch (error) {
        // If parsing fails, clear the invalid data
        localStorage.removeItem("user")
        console.error("Failed to parse stored user data:", error)
      }
    }

    setIsInitialized(true)
  }, [])

  // Update localStorage when user state changes
  useEffect(() => {
    if (isInitialized) {
      if (user) {
        localStorage.setItem("user", JSON.stringify(user))
      } else {
        localStorage.removeItem("user")
      }
    }
  }, [user, isInitialized])

  return (
    <AppContext.Provider
      value={{
        user,
        setUser,
        isAuthenticated: !!user,
      }}
    >
      {children}
    </AppContext.Provider>
  )
}

export function useApp() {
  const context = useContext(AppContext)
  if (context === undefined) {
    throw new Error("useApp must be used within an AppProvider")
  }
  return context
}
