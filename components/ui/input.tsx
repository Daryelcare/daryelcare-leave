import * as React from "react"

import { cn } from "@/lib/utils"

// Shared field styling, also used by Select and Textarea
export const fieldClasses = [
  // Borderless canvas-coloured field, 14px radius, accent focus ring
  "w-full rounded-[14px] border border-transparent bg-background px-3.5 text-[15px] text-foreground sm:text-sm",
  "transition-[background-color,box-shadow] duration-150 ease-smooth",
  "placeholder:text-muted-foreground",
  "hover:bg-secondary/70",
  "focus-visible:bg-card focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/70",
  "disabled:cursor-not-allowed disabled:bg-secondary disabled:opacity-60",
  "aria-[invalid=true]:ring-2 aria-[invalid=true]:ring-destructive/50",
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
