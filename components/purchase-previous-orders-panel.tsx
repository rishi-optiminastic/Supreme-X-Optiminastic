"use client"

import * as React from "react"
import {
  RiHistoryLine,
  RiShoppingBag3Line,
} from "@remixicon/react"

import { Panel } from "@/components/panel"
import {
  loadRetailerOrderHistory,
  type RetailerOrderHistoryEntry,
} from "@/lib/po-draft-storage"
import { cn } from "@/lib/utils"

type SidebarOrderRow = RetailerOrderHistoryEntry & { isSample?: boolean }

function demoOrdersForRetailer(retailerId: string, retailerName: string): SidebarOrderRow[] {
  const label = retailerName.trim() || "Retailer"
  const idSafe = retailerId.replace(/[^a-zA-Z0-9_-]/g, "") || "retailer"
  const t = Date.now()
  return [
    {
      id: `__demo-${idSafe}-order-1`,
      retailerId,
      savedAtIso: new Date(t - 5 * 86400000).toISOString(),
      templateLabel: `Order SO-2026-0142 — ${label}`,
      lines: [
        { sku: "ATL-PLAY-042", productName: "City Action Fire Station", odooProductId: null, qty: 24 },
        { sku: "ATL-PLAY-118", productName: "Family Fun Camping", odooProductId: null, qty: 12 },
        { sku: "PMB-70156", productName: "Novelmore Knight's Castle", odooProductId: null, qty: 6 },
      ],
      isSample: true,
    },
    {
      id: `__demo-${idSafe}-order-2`,
      retailerId,
      savedAtIso: new Date(t - 18 * 86400000).toISOString(),
      templateLabel: `Order SO-2026-0097 — ${label}`,
      lines: [
        { sku: "LEGO-60316", productName: "Police Station", odooProductId: null, qty: 8 },
        { sku: "LEGO-41703", productName: "Friendship Tree House", odooProductId: null, qty: 15 },
      ],
      isSample: true,
    },
  ]
}

type Props = {
  retailerId: string | null
  retailerName: string
  className?: string
}

export function PurchasePreviousOrdersPanel({ retailerId, retailerName, className }: Props) {
  const [tick, setTick] = React.useState(0)

  React.useEffect(() => {
    const bump = () => setTick((n) => n + 1)
    window.addEventListener("supreme-odoo-retailer-history-updated", bump)
    return () => window.removeEventListener("supreme-odoo-retailer-history-updated", bump)
  }, [])

  const stored = React.useMemo(() => {
    if (!retailerId) return []
    return loadRetailerOrderHistory(retailerId)
  }, [retailerId, tick])

  const sidebarOrders = React.useMemo((): SidebarOrderRow[] => {
    if (!retailerId) return []
    if (stored.length > 0) return stored.map((o) => ({ ...o, isSample: false }))
    return demoOrdersForRetailer(retailerId, retailerName)
  }, [retailerId, retailerName, stored])

  return (
    <Panel
      className={cn(
        "flex min-h-[min(260px,38vh)] flex-1 flex-col overflow-hidden border-border/60 p-0 shadow-md ring-1 ring-black/5 dark:ring-white/5 lg:min-h-0",
        className
      )}
    >
      <div className="flex shrink-0 items-center gap-2 border-b border-border/50 bg-muted/20 px-4 py-2.5">
        <span className="flex size-8 items-center justify-center rounded-lg bg-background shadow-sm ring-1 ring-border/60">
          <RiHistoryLine className="size-3.5 text-muted-foreground" aria-hidden />
        </span>
        <div className="min-w-0 flex-1">
          <h2 className="text-sm font-semibold tracking-tight">Previous orders</h2>
          <p className="text-[11px] text-muted-foreground">Saved drafts for this retailer</p>
        </div>
        {sidebarOrders.length > 0 ? (
          <span className="rounded-full bg-background px-2 py-0.5 text-[10px] font-semibold tabular-nums text-muted-foreground shadow-sm ring-1 ring-border/50">
            {sidebarOrders.length}
          </span>
        ) : null}
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain p-3">
        {!retailerId ? (
          <p className="px-1 py-2 text-center text-xs text-muted-foreground">
            Select a retailer to see order history.
          </p>
        ) : (
          <div key={retailerId} className="space-y-3">
            {sidebarOrders.some((o) => o.isSample) ? (
              <div className="rounded-lg border border-amber-500/20 bg-amber-500/6 px-2.5 py-2 text-[10px] leading-snug text-amber-900 dark:text-amber-200/95">
                <span className="font-semibold">Sample orders</span> — examples until you use{" "}
                <span className="font-medium text-foreground">Save draft</span> on this page.
              </div>
            ) : null}

            <ul className="relative space-y-3 before:absolute before:left-[15px] before:top-2 before:h-[calc(100%-0.5rem)] before:w-px before:bg-border/80">
              {sidebarOrders.map((ord) => (
                <li key={ord.id} className="relative flex gap-3 pl-1">
                  <span
                    className={cn(
                      "relative z-1 mt-1 size-2.5 shrink-0 rounded-full border-2 border-card shadow-sm",
                      ord.isSample ? "bg-amber-500" : "bg-primary"
                    )}
                    aria-hidden
                  />
                  <div
                    className={cn(
                      "min-w-0 flex-1 rounded-xl border px-3 py-2.5 shadow-sm",
                      ord.isSample ? "border-amber-500/15 bg-card/90" : "border-border/60 bg-card"
                    )}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex min-w-0 items-center gap-1.5">
                        <RiShoppingBag3Line className="size-3.5 shrink-0 text-muted-foreground" aria-hidden />
                        <p className="truncate text-xs font-semibold text-foreground">
                          {ord.templateLabel ?? `Order · ${ord.lines.length} line(s)`}
                        </p>
                      </div>
                      {ord.isSample ? (
                        <span className="shrink-0 rounded-md bg-amber-500/15 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wide text-amber-800 dark:text-amber-200">
                          Demo
                        </span>
                      ) : null}
                    </div>
                    <p className="mt-1 text-[10px] tabular-nums text-muted-foreground">
                      {new Date(ord.savedAtIso).toLocaleString("en-AE", {
                        dateStyle: "medium",
                        timeStyle: "short",
                      })}
                      <span className="mx-1 text-border">·</span>
                      {ord.lines.length} line{ord.lines.length !== 1 ? "s" : ""}
                    </p>
                    <ul className="mt-2 space-y-1 border-t border-border/40 pt-2">
                      {ord.lines.slice(0, 4).map((l, i) => (
                        <li
                          key={`${ord.id}-${i}-${l.sku}`}
                          className="flex gap-2 text-[10px] leading-tight text-muted-foreground"
                        >
                          <span className="w-7 shrink-0 text-right font-mono font-semibold tabular-nums text-foreground/80">
                            {l.qty}×
                          </span>
                          <span className="min-w-0 flex-1">
                            <span className="font-mono text-[10px] text-foreground/70">{l.sku}</span>
                            {l.productName ? (
                              <span className="mt-0.5 block truncate text-muted-foreground">{l.productName}</span>
                            ) : null}
                          </span>
                        </li>
                      ))}
                    </ul>
                    {ord.lines.length > 4 ? (
                      <p className="mt-1.5 text-[10px] font-medium text-muted-foreground">
                        +{ord.lines.length - 4} more SKU{ord.lines.length - 4 !== 1 ? "s" : ""}
                      </p>
                    ) : null}
                  </div>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </Panel>
  )
}
