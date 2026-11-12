import * as React from "react"
import { cva, type VariantProps } from "class-variance-authority"

import { cn } from "@/lib/utils"

// Soft, pill-shaped status labels. Tones: neutral (secondary/outline),
// primary (default), success, warning, destructive.
const badgeVariants = cva(
  "inline-flex items-center gap-1.5 whitespace-nowrap rounded-full px-2.5 py-0.5 text-xs font-semibold leading-5 transition-colors",
  {
    variants: {
      variant: {
        default: "bg-primary-soft text-primary",
        secondary: "bg-secondary text-secondary-foreground",
        outline: "border border-border bg-card text-foreground/80",
        destructive: "bg-destructive-soft text-destructive",
        success: "bg-success-soft text-success",
        warning: "bg-warning-soft text-warning",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  },
)

export interface BadgeProps extends React.HTMLAttributes<HTMLDivElement>, VariantProps<typeof badgeVariants> {
  /** Show a small coloured dot before the text */
  dot?: boolean
}

function Badge({ className, variant, dot, children, ...props }: BadgeProps) {
  return (
    <div className={cn(badgeVariants({ variant }), className)} {...props}>
      {dot && <span className="h-1.5 w-1.5 rounded-full bg-current" aria-hidden />}
      {children}
    </div>
  )
}

export { Badge, badgeVariants }
