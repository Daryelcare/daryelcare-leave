"use client"

import * as React from "react"
import { format } from "date-fns"
import { CalendarDays, X } from "lucide-react"
import type { Matcher } from "react-day-picker"

import { cn } from "@/lib/utils"
import { Calendar } from "@/components/ui/calendar"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { fieldClasses } from "@/components/ui/input"

export interface DatePickerProps extends Omit<React.ButtonHTMLAttributes<HTMLButtonElement>, "value" | "onChange"> {
  value?: Date | null
  onChange: (date: Date | undefined) => void
  placeholder?: string
  /** Days that can't be picked */
  disabledDays?: Matcher | Matcher[]
  /** Show a small button to clear the date */
  clearable?: boolean
  /** date-fns format for the button label */
  displayFormat?: string
}

/**
 * The one date input used across the app: a field-styled button that opens
 * a calendar. Works inside react-hook-form's <FormControl> (it forwards the
 * id and aria attributes to the button).
 */
const DatePicker = React.forwardRef<HTMLButtonElement, DatePickerProps>(
  (
    { value, onChange, placeholder = "Select a date", disabledDays, clearable, displayFormat = "d MMM yyyy", className, disabled, ...props },
    ref,
  ) => {
    const [open, setOpen] = React.useState(false)
    return (
      <Popover open={open} onOpenChange={setOpen}>
        <div className="relative">
          <PopoverTrigger asChild>
            <button
              ref={ref}
              type="button"
              disabled={disabled}
              className={cn(
                fieldClasses,
                "flex h-10 items-center gap-2.5 py-2 text-left",
                !value && "text-muted-foreground/80",
                clearable && value && "pr-9",
                className,
              )}
              {...props}
            >
              <CalendarDays className="h-4 w-4 shrink-0 text-muted-foreground" />
              <span className="truncate tabular">{value ? format(value, displayFormat) : placeholder}</span>
            </button>
          </PopoverTrigger>
          {clearable && value && !disabled && (
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
        <PopoverContent className="w-auto p-0" align="start">
          <Calendar
            mode="single"
            selected={value ?? undefined}
            defaultMonth={value ?? undefined}
            onSelect={(date) => {
              onChange(date)
              if (date) setOpen(false)
            }}
            disabled={disabledDays}
            initialFocus
          />
        </PopoverContent>
      </Popover>
    )
  },
)
DatePicker.displayName = "DatePicker"

export { DatePicker }
