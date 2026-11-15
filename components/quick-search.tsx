"use client"

import { useEffect, useMemo, useRef, useState, type ComponentType } from "react"
import { useRouter } from "next/navigation"
import { useQuery } from "@tanstack/react-query"
import { CalendarRange, CornerDownLeft, Search, UserRound } from "lucide-react"
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog"
import { fetchWithAuth } from "@/lib/api-utils"
import { LEAVE_CALENDAR_HREF, settingsHref, visibleGroups, visibleSettingsSections } from "@/lib/navigation"
import { isLeaver, type DirectoryEmployee } from "@/lib/employee-directory"
import { cn } from "@/lib/utils"
import { useApp } from "./app-provider"
import { Avatar } from "./page-kit"

const OPEN_EVENT = "daryelcare:quick-search"

/** Open the quick search from anywhere (sidebar button, top bar). */
export function openQuickSearch() {
  window.dispatchEvent(new Event(OPEN_EVENT))
}

/** "⌘K" on Apple devices, "Ctrl K" elsewhere */
export function useShortcutLabel() {
  const [label, setLabel] = useState("Ctrl K")
  useEffect(() => {
    if (/Mac|iPhone|iPad/.test(navigator.platform || navigator.userAgent)) setLabel("⌘K")
  }, [])
  return label
}

type Item = {
  id: string
  group: "People" | "Pages" | "Settings"
  title: string
  detail?: string
  href: string
  icon?: ComponentType<{ className?: string }>
  person?: string
  /** Lower-case text the query is matched against */
  haystack: string
}

/** Every word of the query must appear somewhere in the item. */
function matches(item: Item, words: string[]) {
  return words.every((w) => item.haystack.includes(w))
}

/**
 * Quick search (⌘K / Ctrl K): jump to any employee, page or settings section.
 * People open in the profile panel on the Employees page.
 */
export function QuickSearch() {
  const router = useRouter()
  const { user } = useApp()
  const isAdmin = user?.role === "admin"
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState("")
  const [active, setActive] = useState(0)
  const listRef = useRef<HTMLUListElement>(null)

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault()
        setOpen((o) => !o)
      }
    }
    const onOpen = () => setOpen(true)
    window.addEventListener("keydown", onKey)
    window.addEventListener(OPEN_EVENT, onOpen)
    return () => {
      window.removeEventListener("keydown", onKey)
      window.removeEventListener(OPEN_EVENT, onOpen)
    }
  }, [])

  useEffect(() => {
    if (!open) setQuery("")
  }, [open])

  // Same query as the Employees page, so it's usually already cached
  const { data, isLoading } = useQuery<{ rows: DirectoryEmployee[] }>({
    queryKey: ["employees", "directory"],
    queryFn: () => fetchWithAuth("/api/employees/directory"),
    enabled: open && !!user,
    staleTime: 5 * 60_000,
  })

  const staticItems = useMemo<Item[]>(() => {
    const pages: Item[] = visibleGroups(isAdmin).flatMap((g) =>
      g.items.map((item) => ({
        id: `page:${item.href}`,
        group: "Pages" as const,
        title: item.title,
        href: item.href,
        icon: item.icon,
        haystack: item.title.toLowerCase(),
      })),
    )
    pages.splice(3, 0, {
      id: "page:calendar",
      group: "Pages",
      title: "Team calendar",
      detail: "Leave",
      href: LEAVE_CALENDAR_HREF,
      icon: CalendarRange,
      haystack: "team calendar leave",
    })
    const settings: Item[] = visibleSettingsSections(isAdmin).map((s) => ({
      id: `settings:${s.id}`,
      group: "Settings",
      title: s.title,
      detail: "Settings",
      href: settingsHref(s.id),
      icon: s.icon,
      haystack: `${s.title} settings ${s.description}`.toLowerCase(),
    }))
    return [...pages, ...settings]
  }, [isAdmin])

  const people = useMemo<Item[]>(
    () =>
      (data?.rows ?? []).map((e) => ({
        id: `person:${e.id}`,
        group: "People",
        title: e.name,
        detail: [e.jobTitle, e.branch, e.employeeCode, isLeaver(e) ? "Left" : ""].filter(Boolean).join(" · "),
        href: `/dashboard/employees?person=${encodeURIComponent(e.id)}`,
        icon: UserRound,
        person: e.name,
        haystack: `${e.name} ${e.employeeCode} ${e.jobTitle} ${e.branch}`.toLowerCase(),
      })),
    [data],
  )

  const results = useMemo(() => {
    const words = query.toLowerCase().split(/\s+/).filter(Boolean)
    if (words.length === 0) return staticItems
    const found = people.filter((p) => matches(p, words)).slice(0, 8)
    return [...found, ...staticItems.filter((i) => matches(i, words))]
  }, [query, people, staticItems])

  useEffect(() => setActive(0), [query])
  useEffect(() => {
    listRef.current?.querySelector(`[data-index="${active}"]`)?.scrollIntoView({ block: "nearest" })
  }, [active])

  const go = (item: Item | undefined) => {
    if (!item) return
    setOpen(false)
    router.push(item.href)
  }

  const onInputKey = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "ArrowDown") {
      e.preventDefault()
      setActive((i) => Math.min(i + 1, results.length - 1))
    } else if (e.key === "ArrowUp") {
      e.preventDefault()
      setActive((i) => Math.max(i - 1, 0))
    } else if (e.key === "Enter") {
      e.preventDefault()
      go(results[active])
    }
  }

  const activeId = results[active] ? `qs-${results[active].id}` : undefined
  let lastGroup = ""

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent className="gap-0 overflow-hidden p-0 sm:top-[18%] sm:max-w-xl sm:translate-y-0 [&>button:last-child]:hidden">
        <DialogTitle className="sr-only">Quick search</DialogTitle>
        <DialogDescription className="sr-only">Find an employee, page or settings section</DialogDescription>
        <div className="flex items-center gap-3 px-5 pb-2 pt-4 sm:pt-5">
          <Search className="h-5 w-5 shrink-0 text-muted-foreground" aria-hidden />
          <input
            autoFocus
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={onInputKey}
            placeholder="Search people, pages and settings"
            aria-label="Search people, pages and settings"
            role="combobox"
            aria-expanded
            aria-controls="quick-search-results"
            aria-activedescendant={activeId}
            className="h-10 min-w-0 flex-1 bg-transparent text-base font-medium outline-none placeholder:text-muted-foreground"
          />
          <kbd className="hidden rounded-md bg-secondary font-sans px-1.5 py-0.5 text-[11px] font-semibold text-muted-foreground sm:block">
            Esc
          </kbd>
        </div>

        <ul
          ref={listRef}
          id="quick-search-results"
          role="listbox"
          aria-label="Results"
          className="max-h-[min(60dvh,420px)] overflow-y-auto px-2.5 pb-3"
        >
          {results.length === 0 && (
            <li className="px-3 py-10 text-center text-sm text-muted-foreground">
              {isLoading ? "Loading people…" : `Nothing matches "${query}".`}
            </li>
          )}
          {results.map((item, i) => {
            const header = item.group !== lastGroup ? item.group : null
            lastGroup = item.group
            const selected = i === active
            const Icon = item.icon
            return (
              <li key={item.id} role="presentation">
                {header && (
                  <p className="px-3 pb-1.5 pt-3 text-[11px] font-bold uppercase tracking-[0.06em] text-muted-foreground">
                    {header}
                  </p>
                )}
                <div
                  id={`qs-${item.id}`}
                  role="option"
                  aria-selected={selected}
                  data-index={i}
                  onMouseMove={() => setActive(i)}
                  onClick={() => go(item)}
                  className={cn(
                    "flex min-h-11 cursor-pointer items-center gap-3 rounded-2xl px-3 py-2 text-sm",
                    selected ? "bg-primary text-primary-foreground" : "text-foreground",
                  )}
                >
                  {item.person ? (
                    <Avatar name={item.person} className="h-8 w-8 text-[11px]" />
                  ) : (
                    Icon && (
                      <span
                        className={cn(
                          "flex h-8 w-8 shrink-0 items-center justify-center rounded-full",
                          selected ? "bg-white/20" : "bg-secondary text-muted-foreground",
                        )}
                      >
                        <Icon className="h-4 w-4" />
                      </span>
                    )
                  )}
                  <span className="min-w-0 flex-1">
                    <span className="block truncate font-semibold">{item.title}</span>
                    {item.detail && (
                      <span
                        className={cn(
                          "block truncate text-xs",
                          selected ? "text-primary-foreground/80" : "text-muted-foreground",
                        )}
                      >
                        {item.detail}
                      </span>
                    )}
                  </span>
                  {selected && <CornerDownLeft className="h-4 w-4 shrink-0 opacity-80" aria-hidden />}
                </div>
              </li>
            )
          })}
        </ul>
      </DialogContent>
    </Dialog>
  )
}
