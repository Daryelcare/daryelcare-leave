"use client"

import { useEffect, useState } from "react"
import { useTheme } from "next-themes"
import { Monitor, Moon, Sun } from "lucide-react"
import { cn } from "@/lib/utils"

export const THEME_OPTIONS = [
  { value: "light", label: "Light", short: "Light", icon: Sun },
  { value: "dark", label: "Dark", short: "Dark", icon: Moon },
  { value: "system", label: "Match device", short: "Device", icon: Monitor },
] as const

/** The saved theme, or undefined until the page has loaded (avoids a hydration mismatch). */
export function useThemeChoice() {
  const { theme, setTheme } = useTheme()
  const [mounted, setMounted] = useState(false)
  useEffect(() => setMounted(true), [])
  return { theme: mounted ? (theme ?? "light") : undefined, setTheme }
}

/** Light / Dark / Match device, in the same pill tray as every other view switch. */
export function ThemeSwitch({ className }: { className?: string }) {
  const { theme, setTheme } = useThemeChoice()
  return (
    <div
      role="radiogroup"
      aria-label="Appearance"
      className={cn("inline-flex gap-[3px] rounded-full bg-background p-1", className)}
    >
      {THEME_OPTIONS.map((o) => {
        const active = theme === o.value
        return (
          <button
            key={o.value}
            type="button"
            role="radio"
            aria-checked={active}
            aria-label={o.label}
            onClick={() => setTheme(o.value)}
            className={cn(
              "inline-flex h-9 items-center gap-1.5 rounded-full px-3.5 text-[13px] font-bold transition-colors",
              "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/70",
              active ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground",
            )}
          >
            <o.icon className="h-4 w-4" />
            {o.short}
          </button>
        )
      })}
    </div>
  )
}
