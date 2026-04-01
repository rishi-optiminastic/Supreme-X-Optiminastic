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
        "rounded-xl border border-border/60 bg-card text-card-foreground",
        "shadow-sm shadow-black/5 ring-1 ring-black/5 dark:bg-card/95 dark:shadow-black/20 dark:ring-white/5",
        elevated &&
          "shadow-md shadow-black/8 ring-black/5 dark:shadow-black/30 dark:ring-white/8",
        className
      )}
      {...props}
    />
  )
}
