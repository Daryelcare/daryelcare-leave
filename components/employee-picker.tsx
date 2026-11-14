"use client"

// A searchable employee picker (as in CarerHR's "Record leave"): type part of a
// name, branch or code and pick from the matches. Keyboard: arrows move,
// Enter picks, Escape closes.

import { forwardRef, useEffect, useId, useMemo, useRef, useState } from "react"
import { Check, ChevronDown, Search } from "lucide-react"
import { cn } from "@/lib/utils"
import { fieldClasses } from "@/components/ui/input"
import { Avatar } from "./page-kit"

export type PickableEmployee = { id: string; name: string; branch: string; employeeCode?: string | null }

export const EmployeePicker = forwardRef<
  HTMLInputElement,
  {
    employees: PickableEmployee[]
    value: string
    onChange: (id: string) => void
    disabled?: boolean
    placeholder?: string
    "aria-invalid"?: boolean
    id?: string
  }
>(function EmployeePicker(
  { employees, value, onChange, disabled, placeholder = "Search by name, branch or code", id, ...aria },
  ref,
) {
  const listId = useId()
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState("")
  const [active, setActive] = useState(0)
  const boxRef = useRef<HTMLDivElement>(null)
  const selected = employees.find((e) => e.id === value)

  const matches = useMemo(() => {
    const words = query.toLowerCase().split(/[\s,]+/).filter(Boolean)
    const list = words.length
      ? employees.filter((e) => {
          const text = `${e.name} ${e.branch} ${e.employeeCode ?? ""}`.toLowerCase()
          return words.every((w) => text.includes(w))
        })
      : employees
    return list.slice(0, 50)
  }, [employees, query])

  useEffect(() => setActive(0), [query, open])
  // Close when clicking elsewhere
  useEffect(() => {
    if (!open) return
    const onDown = (e: MouseEvent) => {
      if (!boxRef.current?.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener("mousedown", onDown)
    return () => document.removeEventListener("mousedown", onDown)
  }, [open])

  const pick = (e: PickableEmployee) => {
    onChange(e.id)
    setQuery("")
    setOpen(false)
  }

  return (
    <div ref={boxRef} className="relative">
      <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
      <input
        ref={ref}
        id={id}
        role="combobox"
        aria-expanded={open}
        aria-controls={listId}
        aria-autocomplete="list"
        aria-activedescendant={open && matches[active] ? `${listId}-${matches[active].id}` : undefined}
        autoComplete="off"
        disabled={disabled}
        value={open ? query : selected ? `${selected.name} (${selected.branch})` : ""}
        placeholder={selected ? `${selected.name} (${selected.branch})` : placeholder}
        onFocus={() => setOpen(true)}
        onChange={(e) => {
          setQuery(e.target.value)
          setOpen(true)
        }}
        onKeyDown={(e) => {
          if (e.key === "ArrowDown") {
            e.preventDefault()
            setOpen(true)
            setActive((a) => Math.min(a + 1, matches.length - 1))
          } else if (e.key === "ArrowUp") {
            e.preventDefault()
            setActive((a) => Math.max(a - 1, 0))
          } else if (e.key === "Enter" && open && matches[active]) {
            e.preventDefault()
            pick(matches[active])
          } else if (e.key === "Escape" && open) {
            e.stopPropagation()
            setOpen(false)
          }
        }}
        className={cn(fieldClasses, "h-10 pl-10 pr-9")}
        {...aria}
      />
      <ChevronDown className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
      {open && (
        <ul
          id={listId}
          role="listbox"
          className="absolute z-50 mt-1.5 max-h-64 w-full overflow-y-auto rounded-xl border border-border/80 bg-popover p-1 shadow-float"
        >
          {matches.length === 0 ? (
            <li className="px-3 py-2.5 text-sm text-muted-foreground">No employees match “{query}”</li>
          ) : (
            matches.map((e, i) => (
              <li
                key={e.id}
                id={`${listId}-${e.id}`}
                role="option"
                aria-selected={e.id === value}
                onMouseDown={(ev) => ev.preventDefault()}
                onMouseEnter={() => setActive(i)}
                onClick={() => pick(e)}
                className={cn(
                  "flex cursor-pointer items-center gap-2.5 rounded-lg px-2.5 py-2 text-sm",
                  i === active && "bg-secondary",
                )}
              >
                <Avatar name={e.name} className="h-7 w-7 text-[11px]" />
                <span className="min-w-0 flex-1">
                  <span className="block truncate font-medium">{e.name}</span>
                  <span className="block truncate text-xs text-muted-foreground">
                    {e.branch}
                    {e.employeeCode ? ` · ${e.employeeCode}` : ""}
                  </span>
                </span>
                {e.id === value && <Check className="h-4 w-4 text-primary" />}
              </li>
            ))
          )}
        </ul>
      )}
    </div>
  )
})
