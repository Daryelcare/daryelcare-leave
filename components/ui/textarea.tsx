import * as React from "react"

import { cn } from "@/lib/utils"
import { fieldClasses } from "./input"

const Textarea = React.forwardRef<HTMLTextAreaElement, React.ComponentProps<"textarea">>(
  ({ className, ...props }, ref) => {
    return <textarea className={cn(fieldClasses, "flex min-h-[88px] py-2.5 leading-6", className)} ref={ref} {...props} />
  },
)
Textarea.displayName = "Textarea"

export { Textarea }
