"use client"

import * as React from "react"
import { RiShareLine } from "@remixicon/react"

import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"

export type RspHistoryItem = {
  id: string
  createdAt: string
  kind: string
  title: string
  subtitle: string
  hasShare: boolean
}

type Props = {
  items: RspHistoryItem[]
  loading: boolean
  activeId: string | null
  onSelect: (id: string) => void
  className?: string
  /** Shows a close control (e.g. mobile drawer) */
  onClose?: () => void
}

function formatWhen(iso: string) {
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return ""
  const now = new Date()
  const diff = now.getTime() - d.getTime()
  const mins = Math.floor(diff / 60000)
  if (mins < 1) return "Just now"
  if (mins < 60) return `${mins}m ago`
  const hrs = Math.floor(mins / 60)
  if (hrs < 24) return `${hrs}h ago`
  return d.toLocaleDateString(undefined, { month: "short", day: "numeric" })
}

export function RspHistorySidebar({ items, loading, activeId, onSelect, className, onClose }: Props) {
  return (
    <aside
      className={cn(
        "flex h-full min-h-0 flex-col overflow-hidden rounded-2xl border border-border/60 bg-card/90 shadow-sm ring-1 ring-black/5 dark:ring-white/10",
        className
      )}
    >
      <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain p-2">
        {loading ? (
          <div className="space-y-1.5 px-1 py-1">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="h-12 animate-pulse rounded-xl border border-border/50 bg-muted/25" />
            ))}
          </div>
        ) : items.length === 0 ? (
          <div className="px-2 py-4 text-center text-xs text-muted-foreground">No saved runs yet.</div>
        ) : (
          <ul className="space-y-1">
            {items.map((s) => {
              const active = activeId === s.id
              return (
                <li key={s.id}>
                  <Button
                    type="button"
                    variant="ghost"
                    className={cn(
                      "h-auto w-full justify-start gap-2 rounded-xl px-2.5 py-2 text-left",
                      active
                        ? "bg-primary/10 ring-1 ring-primary/20"
                        : "hover:bg-muted/40"
                    )}
                    onClick={() => onSelect(s.id)}
                  >
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-[13px] font-medium leading-tight">{s.title}</p>
                      <p className="mt-0.5 text-[10px] text-muted-foreground">
                        {formatWhen(s.createdAt)} · {s.subtitle}
                      </p>
                    </div>
                    {s.hasShare ? (
                      <RiShareLine
                        className="size-3.5 shrink-0 text-primary/80"
                        aria-label="Has share link"
                      />
                    ) : null}
                  </Button>
                </li>
              )
            })}
          </ul>
        )}
      </div>
    </aside>
  )
}
