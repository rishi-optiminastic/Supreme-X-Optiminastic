"use client"

import * as React from "react"
import { RiSparkling2Line } from "@remixicon/react"

import { cn } from "@/lib/utils"

type AiInsightPanelProps = {
  /** Card heading */
  title?: string
  /** Subline under title (e.g. model / provider) */
  subtitle?: string
  /** Right side of header (e.g. action buttons) */
  actions?: React.ReactNode
  children: React.ReactNode
  className?: string
}

/**
 * Distinct shell for LLM-generated content so it reads as “from AI”
 * (gradient frame, sparkle mark, AI badge).
 */
export function AiInsightPanel({
  title = "AI insights",
  subtitle = "Generated with OpenRouter · illustrative analysis",
  actions,
  children,
  className,
}: AiInsightPanelProps) {
  return (
    <div
      className={cn(
        "relative overflow-hidden rounded-xl p-px",
        "bg-linear-to-br from-violet-500/75 via-fuchsia-500/45 to-cyan-500/55",
        "shadow-lg shadow-violet-500/15 ring-1 ring-violet-500/20 dark:shadow-violet-500/25 dark:ring-violet-400/25",
        className
      )}
    >
      <div className="relative overflow-hidden rounded-[calc(0.75rem-1px)] bg-card/98 backdrop-blur-sm dark:bg-card/95">
        <div
          className="pointer-events-none absolute inset-0 opacity-40 dark:opacity-50"
          style={{
            background:
              "radial-gradient(ellipse 90% 60% at 10% 0%, hsl(262 83% 58% / 0.14), transparent 55%), radial-gradient(ellipse 70% 50% at 100% 100%, hsl(190 90% 45% / 0.1), transparent 50%)",
          }}
          aria-hidden
        />
        <div className="relative border-b border-violet-500/15 bg-linear-to-r from-violet-500/10 via-fuchsia-500/6 to-cyan-500/8 px-4 py-3 dark:from-violet-500/15 dark:via-fuchsia-500/10">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex min-w-0 items-center gap-3">
              <span
                className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-linear-to-br from-violet-500/25 via-fuchsia-500/15 to-cyan-500/20 text-violet-700 shadow-inner ring-1 ring-violet-500/30 dark:text-violet-200 dark:ring-violet-400/35"
                aria-hidden
              >
                <RiSparkling2Line className="size-5 motion-safe:animate-pulse" />
              </span>
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <h3 className="text-sm font-semibold tracking-tight text-foreground">
                    {title}
                  </h3>
                  <span className="shrink-0 rounded-md bg-violet-600/12 px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-widest text-violet-800 ring-1 ring-violet-500/25 dark:bg-violet-400/15 dark:text-violet-200 dark:ring-violet-400/30">
                    AI
                  </span>
                </div>
                <p className="mt-0.5 text-[11px] leading-snug text-muted-foreground">
                  {subtitle}
                </p>
              </div>
            </div>
            {actions ? (
              <div className="flex shrink-0 flex-wrap items-center gap-2">{actions}</div>
            ) : null}
          </div>
        </div>
        <div className="relative px-4 py-4">{children}</div>
      </div>
    </div>
  )
}

/** Use on “Run AI …” triggers so they match the insight panel. */
export const aiInsightTriggerClass =
  "border-violet-500/40 bg-violet-500/[0.07] text-violet-950 hover:bg-violet-500/12 hover:text-violet-950 dark:border-violet-400/35 dark:bg-violet-500/10 dark:text-violet-100 dark:hover:bg-violet-500/15"
