"use client"

import * as React from "react"

import { Panel } from "@/components/panel"
import { cn } from "@/lib/utils"

export type RspMetricCardProps = {
  title: string
  value: string
  helper: string
  tone?: "default" | "good" | "warn"
  barPct?: number
  icon: React.ReactNode
}

/** Compact sidebar RSP metric card — matches prediction-workspace.tsx TopMetricCard style. */
export function RspMetricCard({
  title,
  value,
  helper,
  tone = "default",
  barPct,
}: RspMetricCardProps) {
  const accent =
    tone === "good"
      ? { card: "border-emerald-500/20 bg-linear-to-br from-emerald-500/8 via-background to-card", bar: "bg-emerald-500/80", top: "bg-emerald-500/70" }
      : tone === "warn"
        ? { card: "border-rose-500/20 bg-linear-to-br from-rose-500/8 via-background to-card", bar: "bg-rose-500/80", top: "bg-rose-500/70" }
        : { card: "border-border/60 bg-linear-to-br from-background via-card to-muted/25", bar: "bg-primary/80", top: "bg-primary/70" }

  return (
    <Panel
      className={cn(
        "group relative overflow-hidden rounded-xl border px-3.5 py-3 shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md",
        accent.card
      )}
    >
      {/* Top accent stripe */}
      <div className={cn("pointer-events-none absolute inset-x-0 top-0 h-0.5", accent.top)} aria-hidden />

      <div className="flex items-baseline justify-between gap-2">
        <p className="text-[10px] font-bold uppercase tracking-[0.08em] text-muted-foreground">
          {title}
        </p>
        <p className="text-lg font-bold tabular-nums tracking-tight">{value}</p>
      </div>

      {typeof barPct === "number" ? (
        <div className="mt-2 h-1 overflow-hidden rounded-full bg-muted/60">
          <div
            className={cn("h-full rounded-full transition-all duration-500", accent.bar)}
            style={{ width: `${Math.max(3, Math.min(100, barPct))}%` }}
          />
        </div>
      ) : null}

      <p className="mt-1.5 text-[10px] text-muted-foreground">{helper}</p>
    </Panel>
  )
}
