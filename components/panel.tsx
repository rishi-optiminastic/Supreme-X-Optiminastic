import * as React from "react"

import { cn } from "@/lib/utils"

export function Panel({
  className,
  ...props
}: React.ComponentProps<"div">) {
  return (
    <div
      className={cn(
        "rounded-2xl border border-border/50 bg-card text-card-foreground shadow-sm ring-1 ring-black/3 dark:ring-white/4",
        className
      )}
      {...props}
    />
  )
}
