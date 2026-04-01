import * as React from "react"

import { cn } from "@/lib/utils"

type SurfaceCardProps = React.ComponentProps<"div"> & {
  /** Stronger shadow and depth (cards that should pop) */
  elevated?: boolean
}

export function SurfaceCard({
  className,
  elevated,
  ...props
}: SurfaceCardProps) {
  return (
    <div
      className={cn(
        "rounded-2xl border border-border/60 bg-card text-card-foreground",
        "shadow-md shadow-black/[0.04] ring-1 ring-black/[0.04] dark:bg-card/95 dark:shadow-black/30 dark:ring-white/[0.06]",
        elevated &&
          "shadow-lg shadow-black/[0.06] ring-black/[0.05] dark:shadow-black/40 dark:ring-white/[0.08]",
        className
      )}
      {...props}
    />
  )
}
