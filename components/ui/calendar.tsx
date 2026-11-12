"use client"

import * as React from "react"
import { ChevronLeft, ChevronRight } from "lucide-react"
import { DayPicker } from "react-day-picker"

import { cn } from "@/lib/utils"
import { buttonVariants } from "@/components/ui/button"

export type CalendarProps = React.ComponentProps<typeof DayPicker>

const thisYear = new Date().getFullYear()

/**
 * Date picker grid. Shows month and year dropdowns so far-off dates (e.g.
 * passport expiry in 2032) are a couple of taps away, plus previous/next arrows.
 */
function Calendar({ className, classNames, showOutsideDays = true, ...props }: CalendarProps) {
  const dropdownProps =
    props.captionLayout === undefined
      ? { captionLayout: "dropdown-buttons" as const, fromYear: thisYear - 10, toYear: thisYear + 15 }
      : {}

  return (
    <DayPicker
      showOutsideDays={showOutsideDays}
      className={cn("p-3", className)}
      classNames={{
        months: "flex flex-col sm:flex-row gap-4",
        month: "space-y-3",
        caption: "relative flex h-9 items-center justify-center px-9",
        caption_label: "font-display text-sm font-semibold tracking-[-0.01em]",
        caption_dropdowns: "flex items-center gap-1.5",
        dropdown_month: "relative",
        dropdown_year: "relative",
        dropdown:
          "absolute inset-0 z-10 w-full cursor-pointer appearance-none opacity-0 [color-scheme:light]",
        vhidden: "sr-only",
        nav: "flex items-center",
        nav_button: cn(
          buttonVariants({ variant: "ghost", size: "icon" }),
          "h-8 w-8 rounded-full text-muted-foreground hover:text-foreground",
        ),
        nav_button_previous: "absolute left-0",
        nav_button_next: "absolute right-0",
        table: "w-full border-collapse",
        head_row: "flex",
        head_cell: "w-10 pb-1 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground sm:w-9",
        row: "mt-1 flex w-full",
        cell: cn(
          "relative h-10 w-10 p-0 text-center text-sm focus-within:relative focus-within:z-20 sm:h-9 sm:w-9",
          "[&:has([aria-selected].day-range-end)]:rounded-r-full [&:has([aria-selected].day-range-start)]:rounded-l-full",
          "[&:has([aria-selected].day-range-middle)]:bg-primary-soft",
        ),
        day: cn(
          "inline-flex h-10 w-10 items-center justify-center rounded-full text-sm font-medium tabular transition-colors duration-150 sm:h-9 sm:w-9",
          "hover:bg-secondary focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-ring/30 aria-selected:opacity-100",
        ),
        day_range_start: "day-range-start",
        day_range_end: "day-range-end",
        day_selected:
          "!bg-primary !text-primary-foreground shadow-raised hover:!bg-primary focus:!bg-primary",
        day_today: "font-bold text-primary ring-1 ring-inset ring-primary/30",
        day_outside: "day-outside text-muted-foreground/50 aria-selected:!bg-primary/60",
        day_disabled: "text-muted-foreground opacity-40",
        day_range_middle: "aria-selected:!bg-transparent aria-selected:!text-foreground",
        day_hidden: "invisible",
        ...classNames,
      }}
      components={{
        IconLeft: () => <ChevronLeft className="h-4 w-4" />,
        IconRight: () => <ChevronRight className="h-4 w-4" />,
        // Month / year dropdowns: a native select (accessible, works on touch)
        // laid invisibly over a styled label
        Dropdown: ({ value, onChange, children, caption, name, "aria-label": ariaLabel }) => (
          <div className="relative inline-flex h-8 items-center gap-1 rounded-lg px-2 font-display text-sm font-semibold tracking-[-0.01em] transition-colors hover:bg-secondary">
            <span>{caption}</span>
            <ChevronLeft className="h-3.5 w-3.5 -rotate-90 text-muted-foreground" aria-hidden />
            <select
              name={name}
              aria-label={ariaLabel}
              value={value}
              onChange={onChange}
              className="absolute inset-0 z-10 w-full cursor-pointer appearance-none opacity-0"
            >
              {children}
            </select>
          </div>
        ),
      }}
      {...dropdownProps}
      {...props}
    />
  )
}
Calendar.displayName = "Calendar"

export { Calendar }
