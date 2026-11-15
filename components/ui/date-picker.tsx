"use client"

import * as React from "react"
import { CalendarDays, X } from "lucide-react"

import { cn } from "@/lib/utils"
import { fieldClasses } from "@/components/ui/input"
import { formatLocalDate } from "@/lib/dates"

export interface DatePickerProps extends Omit<
  React.InputHTMLAttributes<HTMLInputElement>,
  "value" | "onChange" | "min" | "max" | "type" | "defaultValue"
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

/** Date (local) -> "yyyy-MM-dd", the format the device's date picker uses */
export function toInputDate(date: Date | null | undefined): string {
  if (!date || Number.isNaN(date.getTime())) return ""
  return `${pad(date.getFullYear(), 4)}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`
}

/** "yyyy-MM-dd" -> Date at local midnight, or undefined if incomplete or invalid */
export function fromInputDate(value: string): Date | undefined {
  const match = /^(\d{4,})-(\d{2})-(\d{2})$/.exec(value)
  if (!match) return undefined
  return makeDate(Number(match[1]), Number(match[2]), Number(match[3]))
}

/** "dd/mm/yyyy" -> Date at local midnight, or undefined if incomplete or not a real date */
export function fromUkDate(value: string): Date | undefined {
  const match = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(value)
  if (!match) return undefined
  return makeDate(Number(match[3]), Number(match[2]), Number(match[1]))
}

function makeDate(y: number, m: number, d: number): Date | undefined {
  const date = new Date(2000, m - 1, d)
  // setFullYear, because new Date(y, …) treats years 0–99 as 1900–1999
  date.setFullYear(y, m - 1, d)
  date.setHours(0, 0, 0, 0)
  return date.getFullYear() === y && date.getMonth() === m - 1 && date.getDate() === d ? date : undefined
}

/**
 * Tidies what's typed into dd/mm/yyyy: keeps digits, adds the slashes, and
 * pads a one-digit day or month when "/" is typed after it ("1/9/2026" ->
 * "01/09/2026").
 */
export function maskUkDate(raw: string): string {
  const cleaned = raw.replace(/[^\d/]/g, "")
  // Slashes only where this function put them (after each 2 digits): treat it
  // as plain digits, so the next digit flows on into the month or year
  const auto = cleaned
    .split("/")
    .slice(0, -1)
    .every((part) => part.length === 2)
  if (!cleaned.includes("/") || auto) {
    const d = cleaned.replace(/\//g, "").slice(0, 8)
    let out = d.slice(0, 2)
    if (d.length > 2) out += "/" + d.slice(2, 4)
    if (d.length > 4) out += "/" + d.slice(4, 8)
    return out
  }
  const parts = cleaned.split("/").slice(0, 3)
  const [day = "", month, year] = parts
  const fix = (part: string, followed: boolean) => {
    const p = part.slice(0, 2)
    return followed && p.length === 1 ? "0" + p : p
  }
  let out = fix(day, parts.length > 1)
  if (month !== undefined) out += "/" + fix(month, parts.length > 2)
  if (year !== undefined) out += "/" + year.slice(0, 4)
  return out
}

/** Index in a masked date just after its nth digit (0 = start). */
function caretAfterDigits(masked: string, n: number): number {
  if (n <= 0) return 0
  let seen = 0
  for (let i = 0; i < masked.length; i++) {
    if (/\d/.test(masked[i]) && ++seen === n) return i + 1
  }
  return masked.length
}

/**
 * One keystroke in the dd/mm/yyyy box, wherever the cursor is. Returns the
 * tidied text and where the cursor belongs, so editing the day, month or year
 * in the middle of a full date works:
 * - a digit typed into a full date overwrites the digit after the cursor
 *   ("23/|01/2026" + 0 -> "23/0|1/2026", then 2 -> "23/02|/2026")
 * - the cursor stays next to what was typed, and skips over a slash
 * - "/" typed after a single digit still pads it ("1/" -> "01/")
 */
export function editUkDate(prev: string, raw: string, caret: number): { value: string; caret: number } {
  const typedSlash = raw.length === prev.length + 1 && raw[caret - 1] === "/"
  if (typedSlash) {
    const value = maskUkDate(raw)
    // Typed at the end (the usual case): the cursor follows the padded text
    if (caret === raw.length) return { value, caret: value.length }
    // Padding or a dropped slash: keep the cursor after the same digits
    const digitsBefore = raw.slice(0, caret).replace(/\D/g, "").length
    const at = caretAfterDigits(value, digitsBefore)
    return { value, caret: value[at] === "/" ? at + 1 : at }
  }
  let digits = raw.replace(/\D/g, "")
  let digitsBefore = raw.slice(0, caret).replace(/\D/g, "").length
  const inserted = raw.length > prev.length
  // Typing into a full date: overwrite the next digit instead of pushing the rest along
  if (digits.length > 8 && inserted) {
    digits = digits.slice(0, digitsBefore) + digits.slice(digitsBefore + 1)
  }
  digits = digits.slice(0, 8)
  digitsBefore = Math.min(digitsBefore, digits.length)
  let value = digits.slice(0, 2)
  if (digits.length > 2) value += "/" + digits.slice(2, 4)
  if (digits.length > 4) value += "/" + digits.slice(4, 8)
  let at = caretAfterDigits(value, digitsBefore)
  // Moving forward: hop over the slash so the next digit lands in the next part
  if (inserted && value[at] === "/") at += 1
  return { value, caret: at }
}

/**
 * The one date field used across the app. Dates always read and type as
 * dd/mm/yyyy (e.g. 12/09/2026), whatever the device's language. The calendar
 * button opens the device's own date picker (the iOS wheel, Android's
 * calendar, or the browser's on a computer). Works inside react-hook-form's
 * <FormControl>: the id and aria attributes reach the text box.
 */
const DatePicker = React.forwardRef<HTMLInputElement, DatePickerProps>(
  (
    {
      value,
      onChange,
      placeholder = "dd/mm/yyyy",
      min,
      max,
      clearable,
      className,
      disabled,
      onBlur,
      onFocus,
      ...props
    },
    ref,
  ) => {
    const committed = value ? formatLocalDate(value) : ""
    const [draft, setDraft] = React.useState(committed)
    const [focused, setFocused] = React.useState(false)
    const nativeRef = React.useRef<HTMLInputElement>(null)
    const textRef = React.useRef<HTMLInputElement | null>(null)
    // Where the cursor goes after the next render (React would otherwise put it at the end)
    const pendingCaret = React.useRef<number | null>(null)
    React.useLayoutEffect(() => {
      if (pendingCaret.current === null || !textRef.current) return
      const at = pendingCaret.current
      pendingCaret.current = null
      if (document.activeElement === textRef.current) textRef.current.setSelectionRange(at, at)
    })
    const setRefs = (node: HTMLInputElement | null) => {
      textRef.current = node
      if (typeof ref === "function") ref(node)
      else if (ref) ref.current = node
    }

    // The value this field last sent up, so only outside changes (form reset,
    // a new tab) replace what's typed, and never while someone is typing
    const lastSent = React.useRef(committed)
    React.useEffect(() => {
      if (focused || committed === lastSent.current) return
      lastSent.current = committed
      setDraft(committed)
    }, [committed, focused])
    const send = (date: Date | undefined) => {
      lastSent.current = date ? formatLocalDate(date) : ""
      onChange(date)
    }

    const minIso = toInputDate(min)
    const maxIso = toInputDate(max)
    const before = (d: Date) => !!minIso && toInputDate(d) < minIso
    const after = (d: Date) => !!maxIso && toInputDate(d) > maxIso

    // What's wrong with the typed text, if anything (only once it's complete)
    const typed = draft.length === 10 ? fromUkDate(draft) : undefined
    const problem =
      draft.length === 10 && !typed
        ? `${draft} isn't a real date`
        : typed && before(typed)
          ? `Can't be before ${formatLocalDate(min)}`
          : typed && after(typed)
            ? `Can't be after ${formatLocalDate(max)}`
            : null

    const handleType = (raw: string, caret: number) => {
      const { value: next, caret: at } = editUkDate(draft, raw, caret)
      pendingCaret.current = at
      setDraft(next)
      if (next === "") return send(undefined)
      if (next.length < 10) return
      const date = fromUkDate(next)
      // A complete date that can't be used clears the value, so nothing (like
      // a day count) is worked out from the old date while this one shows
      send(date && !before(date) && !after(date) ? date : undefined)
    }

    // A date chosen in the device's picker
    const handlePicked = (iso: string) => {
      const date = fromInputDate(iso)
      if (!date) return
      setDraft(formatLocalDate(date))
      send(date)
    }

    const openPicker = () => {
      const node = nativeRef.current
      if (!node) return
      try {
        node.showPicker()
      } catch {
        node.focus()
        node.click()
      }
    }

    return (
      <div className="space-y-1">
        <div className="relative">
          <input
            ref={setRefs}
            type="text"
            inputMode="numeric"
            autoComplete="off"
            placeholder={placeholder}
            value={draft}
            disabled={disabled}
            onChange={(e) => handleType(e.target.value, e.target.selectionStart ?? e.target.value.length)}
            onFocus={(e) => {
              setFocused(true)
              onFocus?.(e)
            }}
            onBlur={(e) => {
              setFocused(false)
              // Leaving a half-typed date: go back to the last good one. A complete
              // date with a problem stays, with its message, so it can be fixed.
              if (draft !== committed && draft.length < 10) setDraft(committed)
              onBlur?.(e)
            }}
            className={cn(
              fieldClasses,
              "block h-10 w-full py-2 pr-11 tabular",
              clearable && draft && "pr-[4.5rem]",
              problem && "border-destructive focus-visible:ring-destructive/25",
              className,
            )}
            {...props}
            aria-invalid={problem ? true : props["aria-invalid"]}
          />

          {clearable && draft && !disabled && (
            <button
              type="button"
              onClick={() => {
                setDraft("")
                send(undefined)
              }}
              className="absolute right-10 top-1/2 flex h-7 w-7 -translate-y-1/2 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
              aria-label="Clear date"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          )}

          {/* The device's own date picker. On touch screens the invisible native
              input sits over the button and takes the tap itself (which iOS
              needs); with a mouse the button opens it. */}
          <button
            type="button"
            onClick={openPicker}
            disabled={disabled}
            tabIndex={-1}
            aria-hidden
            className="absolute right-1 top-1/2 flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground disabled:opacity-50"
          >
            <CalendarDays className="h-4 w-4" />
          </button>
          <input
            ref={nativeRef}
            type="date"
            tabIndex={-1}
            aria-label="Choose a date from the calendar"
            value={toInputDate(value)}
            min={minIso || undefined}
            max={maxIso || undefined}
            disabled={disabled}
            onChange={(e) => handlePicked(e.target.value)}
            className="absolute right-1 top-1/2 h-8 w-8 -translate-y-1/2 cursor-pointer opacity-0 [@media(pointer:fine)]:pointer-events-none"
          />
        </div>
        {problem && <p className="text-xs font-medium text-destructive">{problem}</p>}
      </div>
    )
  },
)
DatePicker.displayName = "DatePicker"

export { DatePicker }
