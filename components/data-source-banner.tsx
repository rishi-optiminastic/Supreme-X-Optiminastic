"use client"

import { RiDatabase2Line, RiFlaskLine, RiLoader4Line } from "@remixicon/react"

import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"

type Props = {
  source: "odoo" | "demo"
  loading?: boolean
  error?: string | null
  onRefresh?: () => void
  className?: string
}

export function DataSourceBanner({
  source,
  loading,
  error,
  onRefresh,
  className,
}: Props) {
  return (
    <div
      className={cn(
        "flex flex-col gap-2 rounded-xl border px-4 py-3 sm:flex-row sm:items-center sm:justify-between",
        source === "odoo"
          ? "border-emerald-500/30 bg-emerald-500/8"
          : "border-border/70 bg-muted/40",
        className
      )}
    >
      <div className="flex items-center gap-2 text-sm">
        {loading ? (
          <RiLoader4Line className="size-4 animate-spin text-muted-foreground" />
        ) : source === "odoo" ? (
          <RiDatabase2Line className="size-4 text-emerald-600 dark:text-emerald-400" />
        ) : (
          <RiFlaskLine className="size-4 text-muted-foreground" />
        )}
        <span className="font-medium">
          {loading
            ? "Syncing Odoo…"
            : source === "odoo"
              ? "Live data from Odoo"
              : "Demo data (no Odoo connection)"}
        </span>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        {error && (
          <span className="text-xs text-amber-700 dark:text-amber-300">
            {error}
          </span>
        )}
        {source === "odoo" && onRefresh && (
          <Button type="button" size="xs" variant="outline" onClick={onRefresh}>
            Refresh from Odoo
          </Button>
        )}
      </div>
    </div>
  )
}
