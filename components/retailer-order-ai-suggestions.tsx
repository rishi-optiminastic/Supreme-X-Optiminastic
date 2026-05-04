"use client"

import * as React from "react"
import { RiAddLine, RiLoader4Line, RiSparklingLine } from "@remixicon/react"

import { Button } from "@/components/ui/button"
import type { InventoryVariant } from "@/lib/inventory-types"
import { aggregateRetailerOrderHistory } from "@/lib/retailer-order-history-stats"
import {
  RETAILER_AREA_LABELS,
  normalizeRetailerArea,
  type RetailerArea,
} from "@/lib/retailer-order-templates"
import { cn } from "@/lib/utils"

type ApiSuggestion = {
  sku: string
  productName: string
  suggestedQty: number
  reason: string
}

type ApiResponse = {
  source?: "ai" | "history-only"
  aiAvailable?: boolean
  suggestions?: ApiSuggestion[]
  note?: string
  error?: string
}

export type RetailerOrderAiSuggestionsProps = {
  retailerId: string | null
  retailerName: string
  retailerArea?: RetailerArea
  lineSkus: string[]
  variants: InventoryVariant[]
  onAddSuggested: (sku: string, qty: number) => void
  /** Tighter spacing when the block is above the fold (e.g. order-first layout). */
  compact?: boolean
  /** Narrow right column: stack actions, scroll long lists, tweak copy. */
  sidebar?: boolean
}

export function RetailerOrderAiSuggestions({
  retailerId,
  retailerName,
  retailerArea,
  lineSkus,
  variants,
  onAddSuggested,
  compact = false,
  sidebar = false,
}: RetailerOrderAiSuggestionsProps) {
  const [historyTick, setHistoryTick] = React.useState(0)
  const [loading, setLoading] = React.useState(false)
  const [source, setSource] = React.useState<"ai" | "history-only" | null>(null)
  const [rows, setRows] = React.useState<ApiSuggestion[]>([])
  const [note, setNote] = React.useState<string | null>(null)

  React.useEffect(() => {
    const onHist = () => setHistoryTick((t) => t + 1)
    window.addEventListener("supreme-odoo-retailer-history-updated", onHist)
    return () => window.removeEventListener("supreme-odoo-retailer-history-updated", onHist)
  }, [])

  const historyStats = React.useMemo(() => {
    if (!retailerId) return []
    return aggregateRetailerOrderHistory(retailerId)
  }, [retailerId, historyTick])

  const lineSet = React.useMemo(() => new Set(lineSkus.filter(Boolean)), [lineSkus])
  const lineSkusRef = React.useRef(lineSkus)
  lineSkusRef.current = lineSkus

  const statsKey = React.useMemo(
    () =>
      historyStats
        .map((s) => `${s.sku}:${s.orderCount}:${s.typicalQty}`)
        .join("|"),
    [historyStats]
  )

  const catalogKey = React.useMemo(() => variants.map((v) => v.sku).join("|"), [variants])
  const variantsRef = React.useRef(variants)
  variantsRef.current = variants
  const historyStatsRef = React.useRef(historyStats)
  historyStatsRef.current = historyStats

  React.useEffect(() => {
    const v = variantsRef.current
    if (!retailerId || !v.length) {
      setRows([])
      setSource(null)
      setNote(null)
      setLoading(false)
      return
    }

    const ac = new AbortController()
    const t = window.setTimeout(() => {
      void (async () => {
        setLoading(true)
        setNote(null)
        try {
          const catalogList = variantsRef.current.map((row) => ({ sku: row.sku, productName: row.productName }))
          const areaLabel = RETAILER_AREA_LABELS[normalizeRetailerArea(retailerArea)]
          const res = await fetch("/api/ai/retailer-order-suggestions", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            signal: ac.signal,
            body: JSON.stringify({
              retailerName,
              retailerAreaLabel: areaLabel,
              currentLineSkus: lineSkusRef.current,
              catalog: catalogList,
              historyStats: historyStatsRef.current,
            }),
          })
          const j = (await res.json()) as ApiResponse
          if (j.error) {
            setSource("history-only")
            setRows([])
            setNote(j.error)
            return
          }
          const list = (j.suggestions ?? []).filter((s) => Boolean(s?.sku))
          setSource(j.source === "ai" ? "ai" : "history-only")
          setRows(list)
          setNote(j.note ?? null)
        } catch (e) {
          if ((e as Error).name === "AbortError") return
          setSource("history-only")
          setRows([])
          setNote(e instanceof Error ? e.message : "Could not load suggestions.")
        } finally {
          if (!ac.signal.aborted) setLoading(false)
        }
      })()
    }, 380)

    return () => {
      ac.abort()
      window.clearTimeout(t)
    }
  }, [retailerId, retailerName, retailerArea, statsKey, catalogKey, historyTick])

  const visibleRows = React.useMemo(() => rows.filter((s) => s.sku && !lineSet.has(s.sku)), [rows, lineSet])

  if (!retailerId) {
    if (!sidebar) return null
    return (
      <div className="rounded-xl border border-dashed border-border/60 bg-muted/10 px-3 py-3 text-center text-xs text-muted-foreground">
        Select a retailer to see <span className="font-medium text-foreground">usual-order</span> suggestions.
      </div>
    )
  }

  const areaLabel = RETAILER_AREA_LABELS[normalizeRetailerArea(retailerArea)]

  if (!variants.length) {
    return (
      <div
        className={cn(
          "rounded-xl border border-dashed border-border/70 bg-muted/10 text-muted-foreground",
          sidebar ? "px-3 py-2.5 text-xs" : "px-4 py-3 text-sm"
        )}
      >
        Load the product catalog to see suggestions for{" "}
        <span className="font-medium text-foreground">{retailerName || "this retailer"}</span>.
      </div>
    )
  }

  return (
    <div
      className={cn(
        "rounded-xl border bg-linear-to-br from-violet-500/6 via-background to-background shadow-sm",
        compact || sidebar ? "px-3 py-2.5" : "px-4 py-3.5",
        source === "ai" ? "border-violet-500/35" : "border-border/70",
        sidebar && "min-w-0"
      )}
    >
      <div className={cn("flex items-start justify-between gap-2", sidebar ? "flex-col" : "flex-wrap")}>
        <div className="min-w-0 w-full">
          <div className={cn("flex flex-wrap items-center gap-2", sidebar && "gap-1.5")}>
            <RiSparklingLine className={cn("shrink-0 text-violet-600 dark:text-violet-300", sidebar ? "size-3.5" : "size-4")} aria-hidden />
            <p className={cn("font-semibold text-foreground", sidebar ? "text-xs leading-tight" : "text-sm")}>
              What this retailer usually orders
            </p>
            {source === "ai" ? (
              <span className="rounded-full bg-violet-500/15 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-violet-700 dark:text-violet-200">
                AI-assisted
              </span>
            ) : loading ? null : (
              <span className="rounded-full bg-muted px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                From saved orders
              </span>
            )}
          </div>
          <p
            className={cn(
              "text-[11px] text-muted-foreground",
              compact || sidebar ? "mt-0.5 leading-snug" : "mt-1 leading-relaxed"
            )}
          >
            {source === "ai"
              ? compact || sidebar
                ? "AI reasons from drafts + catalog — review before adding."
                : "Shortlist from this retailer’s saved drafts and your catalog. Reasons are written by an AI model — review before adding lines."
              : compact || sidebar
                ? "From saved drafts in this browser; add OpenRouter for richer AI reasons."
                : "Based on saved order drafts in this browser. Add OpenRouter (OPENROUTER_API_KEY) for AI-written reasons and cold-start ideas when history is thin."}
            {areaLabel ? (
              <>
                {" "}
                <span className="text-foreground/80">Area: {areaLabel}.</span>
              </>
            ) : null}
          </p>
        </div>
        {loading ? (
          <span className="inline-flex items-center gap-1.5 text-[11px] text-muted-foreground">
            <RiLoader4Line className="size-3.5 animate-spin" aria-hidden />
            Updating…
          </span>
        ) : null}
      </div>

      {note && !loading ? (
        <p className={cn("text-amber-800 dark:text-amber-200/90", sidebar ? "mt-1.5 text-[10px] leading-snug" : "mt-2 text-[11px]")}>
          {note}
        </p>
      ) : null}

      {!loading && visibleRows.length === 0 && rows.length === 0 ? (
        <p className={cn("text-muted-foreground", sidebar ? "mt-2 text-xs leading-snug" : "mt-3 text-sm")}>
          {historyStats.length === 0
            ? sidebar
              ? "No drafts yet — save an order draft for this retailer, or enable AI for catalog ideas."
              : "No saved drafts for this retailer yet. Save an order draft to build a pattern, or enable AI (see note above) for catalog-based starter ideas."
            : "Nothing new to suggest right now."}
        </p>
      ) : null}

      {!loading && visibleRows.length === 0 && rows.length > 0 ? (
        <p className={cn("text-muted-foreground", sidebar ? "mt-2 text-xs" : "mt-3 text-sm")}>
          Every suggested SKU is already on this order — add more from the order form or adjust quantities.
        </p>
      ) : null}

      {visibleRows.length > 0 ? (
        <ul
          className={cn(
            compact ? "mt-2 space-y-2" : "mt-3 space-y-2.5",
            sidebar && "max-h-[min(260px,32vh)] overflow-y-auto overscroll-contain pr-0.5"
          )}
        >
          {visibleRows.map((s) => (
            <li
              key={s.sku}
              className={cn(
                "flex gap-2 rounded-lg border border-border/50 bg-card/80 px-3 py-2.5",
                sidebar ? "flex-col" : "flex-col sm:flex-row sm:items-center sm:justify-between"
              )}
            >
              <div className="min-w-0 flex-1">
                <p
                  className={cn(
                    "font-medium text-foreground",
                    sidebar ? "wrap-break-word text-xs leading-snug" : "truncate text-sm"
                  )}
                >
                  {s.productName}
                </p>
                <p className="font-mono text-[10px] text-muted-foreground sm:text-[11px]">{s.sku}</p>
                <p className="mt-1 text-[10px] leading-snug text-muted-foreground sm:text-[11px]">{s.reason}</p>
              </div>
              <div
                className={cn(
                  "flex shrink-0 items-center gap-2",
                  sidebar ? "w-full justify-between" : "sm:flex-col sm:items-end"
                )}
              >
                <span className="text-[11px] font-medium tabular-nums text-muted-foreground">Qty {s.suggestedQty}</span>
                <Button
                  type="button"
                  size="sm"
                  variant="secondary"
                  className={cn("h-8 gap-1", sidebar && "flex-1 sm:flex-initial")}
                  onClick={() => onAddSuggested(s.sku, s.suggestedQty)}
                >
                  <RiAddLine className="size-3.5" aria-hidden />
                  Add
                </Button>
              </div>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  )
}
