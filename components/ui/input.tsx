import * as React from "react"

import { cn } from "@/lib/utils"

// Shared field styling, also used by Select and Textarea
export const fieldClasses = [
  "w-full rounded-lg border border-input bg-card px-3.5 text-[15px] text-foreground shadow-card sm:text-sm",
  "transition-[border-color,box-shadow] duration-150 ease-smooth",
  "placeholder:text-muted-foreground/80",
  "hover:border-foreground/25",
  "focus-visible:border-primary/60 focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-primary/15",
  "disabled:cursor-not-allowed disabled:bg-muted disabled:opacity-60",
  "aria-[invalid=true]:border-destructive/60 aria-[invalid=true]:ring-destructive/15",
].join(" ")

const Input = React.forwardRef<HTMLInputElement, React.ComponentProps<"input">>(
  ({ className, type, ...props }, ref) => {
    return (
      <input
        type={type}
        className={cn(
          fieldClasses,
          "flex h-10 py-2 file:border-0 file:bg-transparent file:text-sm file:font-medium file:text-foreground",
          className,
        )}
        ref={ref}
        {...props}
      />
    )
  },
)
Input.displayName = "Input"

export { Input }
