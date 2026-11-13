"use client"

import * as React from "react"
import { CalendarDays, X } from "lucide-react"

import { cn } from "@/lib/utils"
import { fieldClasses } from "@/components/ui/input"

export interface DatePickerProps extends Omit<
  React.InputHTMLAttributes<HTMLInputElement>,
  "value" | "onChange" | "min" | "max" | "type"
> {
  value?: Date | null
  onChange: (date: Date | undefined) => void
  placeholder?: string
  /** Earliest date that can be chosen */
  min?: Date | null
  /** Latest date that can be chosen */
  max?: Date | null
  /** Show a small button to clear the date */
  clearable?: boolean
}

const pad = (n: number, width = 2) => String(n).padStart(width, "0")

/** Date (local midnight) -> "yyyy-MM-dd", the format a native date input uses */
export function toInputDate(date: Date | null | undefined): string {
  if (!date || Number.isNaN(date.getTime())) return ""
  return `${pad(date.getFullYear(), 4)}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`
}

/** "yyyy-MM-dd" -> Date at local midnight, or undefined if incomplete or invalid */
export function fromInputDate(value: string): Date | undefined {
  const match = /^(\d{4,})-(\d{2})-(\d{2})$/.exec(value)
  if (!match) return undefined
  const [y, m, d] = [Number(match[1]), Number(match[2]), Number(match[3])]
  const date = new Date(2000, m - 1, d)
  // setFullYear, because new Date(y, …) treats years 0–99 as 1900–1999
  date.setFullYear(y, m - 1, d)
  date.setHours(0, 0, 0, 0)
  return date.getMonth() === m - 1 && date.getDate() === d ? date : undefined
}

/**
 * The one date field used across the app. It's the device's own date input:
 * on phones and tablets it opens the system date picker, and on computers the
 * date can be typed straight in (or picked from the browser's calendar).
 * Works inside react-hook-form's <FormControl>: the id and aria attributes
 * reach the input.
 */
const DatePicker = React.forwardRef<HTMLInputElement, DatePickerProps>(
  ({ value, onChange, placeholder = "Select a date", min, max, clearable, className, disabled, ...props }, ref) => {
    const text = toInputDate(value)

    // The browser owns the field's text while someone types: if React put the
    // old value back after each key (a "controlled" input), the half-typed day,
    // month or year would be lost. So the input is uncontrolled, and we only
    // write to it when the date changes from outside (a form reset, a new tab).
    const inputRef = React.useRef<HTMLInputElement | null>(null)
    const setRefs = React.useCallback(
      (node: HTMLInputElement | null) => {
        inputRef.current = node
        if (typeof ref === "function") ref(node)
        else if (ref) ref.current = node
      },
      [ref],
    )
    React.useEffect(() => {
      const node = inputRef.current
      if (node && node.value !== text && !node.validity.badInput) node.value = text
    }, [text])

    // Touch devices show an empty date input as a blank box, so show the
    // placeholder ourselves there. Computers already show "dd/mm/yyyy".
    const [touch, setTouch] = React.useState(false)
    React.useEffect(() => {
      setTouch(window.matchMedia("(pointer: coarse)").matches)
    }, [])

    return (
      <div className="relative">
        {/* Computers already show the browser's calendar button, so our icon is only for touch */}
        {touch && (
          <CalendarDays
            aria-hidden
            className="pointer-events-none absolute left-3.5 top-1/2 z-[1] h-4 w-4 -translate-y-1/2 text-muted-foreground"
          />
        )}
        <input
          ref={setRefs}
          type="date"
          defaultValue={text}
          min={toInputDate(min) || undefined}
          max={toInputDate(max) || undefined}
          disabled={disabled}
          onChange={(e) => {
            // While a date is half-typed the browser reports an empty value and
            // flags it as bad input. Don't pass that on as "no date", or forms
            // reset the field mid-typing. Only a real clear sends undefined.
            if (e.target.value === "" && e.target.validity.badInput) return
            onChange(fromInputDate(e.target.value))
          }}
          className={cn(
            fieldClasses,
            "block h-10 w-full appearance-none py-2 text-left tabular",
            touch && "pl-10",
            // Keep the value left-aligned on iOS, and size the browser's calendar button
            "[&::-webkit-date-and-time-value]:text-left [&::-webkit-date-and-time-value]:min-h-[1.25rem]",
            "[&::-webkit-calendar-picker-indicator]:cursor-pointer [&::-webkit-calendar-picker-indicator]:opacity-60 [&::-webkit-calendar-picker-indicator]:hover:opacity-100",
            !text && touch && "text-transparent",
            clearable && text && "pr-9",
            className,
          )}
          {...props}
        />
        {!text && touch && (
          <span className="pointer-events-none absolute inset-y-0 left-10 flex items-center text-[15px] text-muted-foreground/80">
            {placeholder}
          </span>
        )}
        {clearable && text && !disabled && (
          <button
            type="button"
            onClick={() => onChange(undefined)}
            className="absolute right-1.5 top-1/2 flex h-7 w-7 -translate-y-1/2 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
            aria-label="Clear date"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        )}
      </div>
    )
  },
)
DatePicker.displayName = "DatePicker"

export { DatePicker }
