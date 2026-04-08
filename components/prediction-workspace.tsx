"use client"

import * as React from "react"
import Link from "next/link"
import {
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ReferenceLine,
  XAxis,
  YAxis,
} from "recharts"

import { Panel } from "@/components/panel"
import { Button } from "@/components/ui/button"
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from "@/components/ui/chart"
import { useVariantsWithOdoo } from "@/hooks/use-variants-with-odoo"
import {
  defaultExternalSignals,
  demandProbabilityBreakdown,
  orderTimingAdvice,
  suggestedReorderQty,
  type ExternalSignals,
} from "@/lib/intelligence"
import type { InventoryVariant } from "@/lib/inventory-types"
import {
  type ExternalProductHit,
  marketQueryFromExternalHit,
} from "@/lib/external-product-search"
import { buildWeeklyForecast, weeklyDemand } from "@/lib/planning-math"
import {
  findVariantsBySearch,
  heuristicSearchMarket,
  overallInventoryMarket,
  variantMarketSignal,
} from "@/lib/market-signals"
import { resolveVariantImageUrl } from "@/lib/variant-image"
import { cn } from "@/lib/utils"
import {
  RiBarChartGroupedLine,
  RiCloseLine,
  RiInformationLine,
  RiSearchLine,
  RiStackLine,
} from "@remixicon/react"

/* ─── Chart config ─── */

const chartConfig = {
  past: { label: "Recent weeks", color: "var(--chart-2)" },
  future: { label: "Next weeks", color: "var(--primary)" },
  low: { label: "Low", color: "var(--muted-foreground)" },
} satisfies ChartConfig

function scoreColor(p: number) {
  if (p >= 70) return "from-emerald-500/20 to-emerald-500/5"
  if (p >= 45) return "from-amber-500/20 to-amber-500/5"
  return "from-rose-500/15 to-rose-500/5"
}

function scoreBarColor(p: number) {
  if (p >= 70) return "bg-emerald-500"
  if (p >= 45) return "bg-amber-500"
  return "bg-rose-500"
}

const VERDICT_STYLE: Record<string, string> = {
  strong_buy:
    "bg-emerald-500/20 text-emerald-800 dark:text-emerald-200 border-emerald-500/30",
  buy: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border-emerald-500/25",
  hold: "bg-amber-500/15 text-amber-800 dark:text-amber-200 border-amber-500/25",
  caution:
    "bg-orange-500/15 text-orange-800 dark:text-orange-200 border-orange-500/25",
  avoid: "bg-rose-500/15 text-rose-800 dark:text-rose-200 border-rose-500/25",
}

const VERDICT_LABEL: Record<string, string> = {
  strong_buy: "Strong Buy",
  buy: "Buy",
  hold: "Hold",
  caution: "Caution",
  avoid: "Avoid",
}

/* ─── AI Trend Result Type ─── */

type AiTrendResult = {
  verdict?: string
  confidence?: number
  summary?: string
  factors?: { factor: string; impact: string; detail: string }[]
  actionItems?: string[]
  negotiationTip?: string
  error?: string
  parseWarning?: string
}

type MarketSearchResultState = {
  momentumPct: number
  confidence: number
  summary: string
  source: string
  matchedSku?: string
  /** Shown after Analyze when several catalog rows match — pick one for full detail */
  catalogMatches?: InventoryVariant[]
  /** When trend read came from global product search (not your inventory) */
  externalProduct?: ExternalProductHit
}

type MarketSearchRow =
  | { kind: "catalog"; inv: InventoryVariant }
  | { kind: "api"; hit: ExternalProductHit }

/* ─── Component ─── */

export function PredictionWorkspace() {
  const { variants, source, odooLoading, odooError, refetchOdoo } =
    useVariantsWithOdoo()
  const [sku, setSku] = React.useState("")
  const [external, setExternal] = React.useState<ExternalSignals>(
    defaultExternalSignals
  )
  const [regionHeat, setRegionHeat] = React.useState(55)
  const [categoryHeat, setCategoryHeat] = React.useState(50)
  const [leadW, setLeadW] = React.useState(2)
  const [safetyW, setSafetyW] = React.useState(1)
  const [targetW, setTargetW] = React.useState(4)
  const [supplierCtx, setSupplierCtx] = React.useState<
    "we_found_them" | "they_found_us" | "unknown"
  >("unknown")

  // AI trend state
  const [aiLoading, setAiLoading] = React.useState(false)
  const [aiResult, setAiResult] = React.useState<AiTrendResult | null>(null)

  // Market search + inventory sections
  const [marketQuery, setMarketQuery] = React.useState("")
  const [marketResult, setMarketResult] =
    React.useState<MarketSearchResultState | null>(null)
  const [marketLoading, setMarketLoading] = React.useState(false)
  const [inventoryExpandedSku, setInventoryExpandedSku] = React.useState<
    string | null
  >(null)
  const [marketSearchFocused, setMarketSearchFocused] = React.useState(false)
  const [marketSearchHighlightIdx, setMarketSearchHighlightIdx] =
    React.useState(-1)
  const marketSearchInputRef = React.useRef<HTMLInputElement>(null)
  const [apiProductHits, setApiProductHits] = React.useState<
    ExternalProductHit[]
  >([])
  const [apiProductLoading, setApiProductLoading] = React.useState(false)

  React.useEffect(() => {
    if (variants.length && !sku) setSku(variants[0].sku)
  }, [variants, sku])

  const v = variants.find((x) => x.sku === sku) ?? variants[0]

  const breakdown = React.useMemo(() => {
    if (!v) return null
    return demandProbabilityBreakdown(v, external, { regionHeat, categoryHeat })
  }, [v, external, regionHeat, categoryHeat])

  const prob = breakdown?.total ?? 0
  const reorder = v ? suggestedReorderQty(v, leadW, safetyW, targetW) : 0
  const timing = v ? orderTimingAdvice(v, reorder, leadW) : null
  const wk = v ? weeklyDemand(v) : 0

  const chartData = React.useMemo(() => {
    if (!v) return []
    return buildWeeklyForecast(v).map((p) => ({
      week: p.label,
      past: p.value,
      future: p.forecast,
      bandLow: p.low,
      bandHigh: p.high,
    }))
  }, [v])

  const rank = React.useMemo(() => {
    if (!v || !variants.length) return null
    const sorted = [...variants].sort((a, b) => b.trendScore - a.trendScore)
    const idx = sorted.findIndex((x) => x.sku === v.sku)
    return idx >= 0 ? idx + 1 : null
  }, [v, variants])

  const maxPart = React.useMemo(() => {
    if (!breakdown?.parts.length) return 1
    return Math.max(1, ...breakdown.parts.map((p) => Math.abs(p.points)))
  }, [breakdown])

  const overallMarket = React.useMemo(
    () => overallInventoryMarket(variants),
    [variants]
  )

  const marketSearchMatches = React.useMemo(() => {
    const q = marketQuery.trim()
    if (!q) return [] as InventoryVariant[]
    return findVariantsBySearch(variants, q).slice(0, 14)
  }, [variants, marketQuery])

  const marketSearchRows = React.useMemo((): MarketSearchRow[] => {
    const rows: MarketSearchRow[] = []
    for (const inv of marketSearchMatches) rows.push({ kind: "catalog", inv })
    for (const hit of apiProductHits) rows.push({ kind: "api", hit })
    return rows
  }, [marketSearchMatches, apiProductHits])

  React.useEffect(() => {
    const q = marketQuery.trim()
    if (q.length < 2) {
      setApiProductHits([])
      setApiProductLoading(false)
      return
    }
    const ac = new AbortController()
    const t = window.setTimeout(() => {
      setApiProductLoading(true)
      fetch(`/api/products/search?q=${encodeURIComponent(q)}`, {
        signal: ac.signal,
      })
        .then((r) => r.json() as Promise<{ products?: ExternalProductHit[] }>)
        .then((j) => {
          if (!ac.signal.aborted) setApiProductHits(j.products ?? [])
        })
        .catch(() => {
          if (!ac.signal.aborted) setApiProductHits([])
        })
        .finally(() => {
          if (!ac.signal.aborted) setApiProductLoading(false)
        })
    }, 320)
    return () => {
      ac.abort()
      window.clearTimeout(t)
    }
  }, [marketQuery])

  React.useEffect(() => {
    const q = marketQuery.trim()
    if (!q) {
      setMarketSearchHighlightIdx(-1)
      return
    }
    const selectable = marketSearchMatches.length + apiProductHits.length
    setMarketSearchHighlightIdx(selectable ? 0 : -1)
  }, [marketQuery, marketSearchMatches.length, apiProductHits.length])

  const pickVariantForMarket = React.useCallback((inv: InventoryVariant) => {
    const s = variantMarketSignal(inv)
    setMarketResult({
      momentumPct: s.momentumPct,
      confidence: s.confidence,
      summary: `Matched your catalog: ${inv.productName} (${inv.sku}). Demand score about ${s.demandProb}% (range ${s.bandLow}–${s.bandHigh}%).`,
      source: "Your inventory",
      matchedSku: inv.sku,
    })
    setMarketSearchHighlightIdx(-1)
    marketSearchInputRef.current?.blur()
  }, [])

  const pickExternalProductForMarket = React.useCallback(
    async (hit: ExternalProductHit) => {
      const q = marketQueryFromExternalHit(hit)
      setMarketQuery(hit.title)
      setMarketLoading(true)
      setMarketResult(null)
      setMarketSearchHighlightIdx(-1)
      marketSearchInputRef.current?.blur()
      try {
        const r = await fetch("/api/ai/market-search", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ query: q }),
        })
        const j = (await r.json()) as {
          error?: string
          momentumPct?: number
          confidence?: number
          summary?: string
          source?: string
        }
        if (j.error) {
          const h = heuristicSearchMarket(q)
          setMarketResult({
            momentumPct: h.momentumPct,
            confidence: h.confidence,
            summary: h.summary,
            source: "Estimate",
            externalProduct: hit,
          })
        } else {
          setMarketResult({
            momentumPct: Number(j.momentumPct) || 0,
            confidence: Number(j.confidence) || 50,
            summary: String(j.summary ?? ""),
            source:
              j.source === "ai"
                ? "AI (product search)"
                : j.source === "heuristic"
                  ? "Estimate"
                  : "Search",
            externalProduct: hit,
          })
        }
      } catch {
        const h = heuristicSearchMarket(q)
        setMarketResult({
          momentumPct: h.momentumPct,
          confidence: h.confidence,
          summary: h.summary,
          source: "Estimate",
          externalProduct: hit,
        })
      } finally {
        setMarketLoading(false)
      }
    },
    []
  )

  const runMarketSearch = async (opts?: { useListHighlight?: boolean }) => {
    const q = marketQuery.trim()
    if (!q) {
      setMarketResult(null)
      return
    }
    if (opts?.useListHighlight && marketSearchHighlightIdx >= 0) {
      const row = marketSearchRows[marketSearchHighlightIdx]
      if (row) {
        if (row.kind === "catalog") pickVariantForMarket(row.inv)
        else void pickExternalProductForMarket(row.hit)
        return
      }
    }
    setMarketLoading(true)
    setMarketResult(null)
    const matches = findVariantsBySearch(variants, q)
    if (matches.length === 1) {
      pickVariantForMarket(matches[0]!)
      setMarketLoading(false)
      return
    }
    if (matches.length > 1) {
      const signals = matches.map((x) => variantMarketSignal(x))
      const mom = Math.round(
        signals.reduce((a, s) => a + s.momentumPct, 0) / signals.length
      )
      const conf = Math.round(
        signals.reduce((a, s) => a + s.confidence, 0) / signals.length
      )
      setMarketResult({
        momentumPct: mom,
        confidence: conf,
        summary: `${matches.length} products match “${q}”. Averages below — pick a row for this SKU’s full read.`,
        source: "Your inventory (avg)",
        catalogMatches: matches.slice(0, 40),
      })
      setMarketLoading(false)
      return
    }
    try {
      const r = await fetch("/api/ai/market-search", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ query: q }),
      })
      const j = (await r.json()) as {
        error?: string
        momentumPct?: number
        confidence?: number
        summary?: string
        source?: string
      }
      if (j.error) {
        const h = heuristicSearchMarket(q)
        setMarketResult({
          momentumPct: h.momentumPct,
          confidence: h.confidence,
          summary: h.summary,
          source: "Estimate",
        })
      } else {
        setMarketResult({
          momentumPct: Number(j.momentumPct) || 0,
          confidence: Number(j.confidence) || 50,
          summary: String(j.summary ?? ""),
          source:
            j.source === "ai"
              ? "AI (search)"
              : j.source === "heuristic"
                ? "Estimate"
                : "Search",
        })
      }
    } catch {
      const h = heuristicSearchMarket(q)
      setMarketResult({
        momentumPct: h.momentumPct,
        confidence: h.confidence,
        summary: h.summary,
        source: "Estimate",
      })
    } finally {
      setMarketLoading(false)
    }
  }

  // AI trend analysis
  const runAiTrend = async () => {
    if (!v) return
    setAiLoading(true)
    setAiResult(null)
    try {
      const r = await fetch("/api/ai/trend", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sku: v.sku,
          productName: v.productName,
          trendScore: v.trendScore,
          weeksCover: v.weeksCover,
          onHand: v.onHand,
          inbound: v.inbound,
          salesQty90d: v.salesQty90d,
          weeklyDemand: Math.round(wk * 10) / 10,
          demandScore: prob,
          supplierContext: supplierCtx,
        }),
      })
      const j = (await r.json()) as AiTrendResult
      setAiResult(j)
    } catch (e) {
      setAiResult({ error: e instanceof Error ? e.message : "Request failed" })
    } finally {
      setAiLoading(false)
    }
  }

  // Clear AI when SKU changes
  React.useEffect(() => {
    setAiResult(null)
  }, [sku])

  const dataIsSample = source === "demo"
  const odooUnavailable = dataIsSample && Boolean(odooError)

  return (
    <div className="space-y-3 pb-8">
      {/* Title + workflow */}
      <div className="grid items-start gap-3 lg:grid-cols-12">
        <div className="lg:col-span-8">
          <h1 className="text-2xl font-semibold tracking-tight md:text-3xl">
            Trend Prediction
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Dashboard view: data source, portfolio, search, market read, every
            SKU, planner, AI, and chart.
          </p>
        </div>
        <Panel className="flex flex-wrap items-center gap-3 border-primary/25 bg-primary/5 p-3 text-sm lg:col-span-4 lg:justify-self-end">
          <span className="inline-flex size-7 shrink-0 items-center justify-center rounded-full bg-primary text-xs font-bold text-primary-foreground">
            1
          </span>
          <span className="text-muted-foreground">Next:</span>
          <Link
            href="/pricing"
            className="font-semibold text-primary underline-offset-4 hover:underline"
          >
            RSP Generator →
          </Link>
        </Panel>
      </div>

      {/* Row: source | portfolio | search */}
      <div className="grid items-stretch gap-3 lg:grid-cols-12">
        <Panel className="space-y-3 overflow-y-auto p-3 lg:col-span-3 lg:h-[360px]">
          {odooUnavailable ? (
            <div
              className="flex flex-col gap-3 rounded-xl border border-amber-500/30 bg-amber-500/8 p-4 text-sm text-amber-950 sm:flex-row sm:items-start sm:justify-between dark:border-amber-500/25 dark:bg-amber-500/10 dark:text-amber-50/95"
              role="status"
            >
              <div className="flex gap-3">
                <RiInformationLine
                  className="mt-0.5 size-5 shrink-0 text-amber-600 dark:text-amber-400"
                  aria-hidden
                />
                <div>
                  <p className="font-medium text-amber-950 dark:text-amber-50">
                    Live catalog unavailable
                  </p>
                  <p className="mt-1 text-[13px] leading-relaxed text-amber-900/90 dark:text-amber-100/85">
                    You&apos;re on{" "}
                    <span className="font-medium">sample inventory</span> so
                    trends and planning still work. Reconnect Odoo when ready —
                    the technical note:{" "}
                    <span className="font-mono text-xs opacity-90">
                      {odooError}
                    </span>
                  </p>
                </div>
              </div>
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="shrink-0 border-amber-600/35 bg-background/80 dark:border-amber-400/30"
                onClick={() => refetchOdoo()}
              >
                Retry Odoo
              </Button>
            </div>
          ) : null}
          <div className="flex flex-col gap-4 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between">
            <div className="flex flex-wrap items-center gap-2 text-sm">
              <span
                className={cn(
                  "inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-medium",
                  source === "odoo"
                    ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-800 dark:text-emerald-200"
                    : "border-border/60 bg-muted/40 text-muted-foreground"
                )}
              >
                {source === "odoo" ? "Live · Odoo" : "Sample data"}
              </span>
              {odooLoading ? (
                <span className="text-muted-foreground">Syncing catalog…</span>
              ) : (
                <span className="text-muted-foreground">
                  {variants.length} product{variants.length === 1 ? "" : "s"} in
                  view
                </span>
              )}
            </div>
            <div className="flex flex-wrap items-center gap-3">
              <div className="flex items-center gap-2">
                <label
                  className="text-xs text-muted-foreground"
                  htmlFor="supplier-ctx"
                >
                  Supplier context
                </label>
                <select
                  id="supplier-ctx"
                  className="h-9 min-w-40 rounded-lg border border-input bg-background px-2.5 text-xs"
                  value={supplierCtx}
                  onChange={(e) =>
                    setSupplierCtx(e.target.value as typeof supplierCtx)
                  }
                >
                  <option value="unknown">Not specified</option>
                  <option value="we_found_them">We found them</option>
                  <option value="they_found_us">They reached out</option>
                </select>
              </div>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => refetchOdoo()}
              >
                Refresh data
              </Button>
            </div>
          </div>
        </Panel>

        <Panel className="flex h-full flex-col overflow-hidden p-0 lg:col-span-5 lg:h-[360px]">
          <div className="flex items-center gap-2 border-b border-border/50 bg-muted/25 px-4 py-2.5">
            <RiBarChartGroupedLine
              className="size-5 shrink-0 text-primary"
              aria-hidden
            />
            <h2 className="text-sm font-semibold tracking-tight">
              Portfolio snapshot
            </h2>
          </div>
          <div className="flex-1 p-3">
            {overallMarket ? (
              <div className="grid grid-cols-2 gap-2">
                <div className="rounded-lg border border-border/50 bg-card px-3 py-2.5 shadow-sm">
                  <p className="text-[11px] font-medium text-muted-foreground">
                    SKUs
                  </p>
                  <p className="mt-0.5 text-xl font-semibold tabular-nums">
                    {overallMarket.total}
                  </p>
                </div>
                <div className="rounded-lg border border-border/50 bg-card px-3 py-2.5 shadow-sm">
                  <p className="text-[11px] font-medium text-muted-foreground">
                    Avg trend
                  </p>
                  <p className="mt-0.5 text-xl font-semibold tabular-nums">
                    {overallMarket.avgTrend}
                  </p>
                </div>
                <div className="rounded-lg border border-border/50 bg-card px-3 py-2.5 shadow-sm">
                  <p className="text-[11px] font-medium text-muted-foreground">
                    Momentum
                  </p>
                  <p
                    className={cn(
                      "mt-0.5 text-xl font-semibold tabular-nums",
                      overallMarket.momentumPct > 5 &&
                        "text-emerald-600 dark:text-emerald-400",
                      overallMarket.momentumPct < -5 &&
                        "text-rose-600 dark:text-rose-400"
                    )}
                  >
                    {overallMarket.momentumPct > 0 ? "+" : ""}
                    {overallMarket.momentumPct}%
                  </p>
                </div>
                <div className="rounded-lg border border-border/50 bg-card px-3 py-2.5 shadow-sm">
                  <p className="text-[11px] font-medium text-muted-foreground">
                    Confidence
                  </p>
                  <p className="mt-0.5 text-xl font-semibold tabular-nums">
                    {overallMarket.confidence}%
                  </p>
                  <p className="mt-0.5 text-[10px] text-muted-foreground">
                    {overallMarket.hotCount} hot · {overallMarket.coolCount}{" "}
                    soft
                  </p>
                </div>
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">
                No products loaded.
              </p>
            )}
          </div>
        </Panel>

        <Panel
          className={cn(
            "relative z-30 flex min-h-[360px] flex-col overflow-hidden p-0 lg:col-span-4 lg:h-[360px]",
            marketResult && "ring-1 ring-primary/15"
          )}
        >
          <div className="flex items-start justify-between gap-2 border-b border-border/50 bg-muted/25 px-4 py-1.5">
            <div className="flex min-w-0 items-start gap-2">
              <RiSearchLine
                className="mt-0.5 size-5 shrink-0 text-primary"
                aria-hidden
              />
              <div>
                <h2 className="text-sm font-semibold tracking-tight pt-1">
                  Search &amp; market
                </h2>
                {/* <p className="text-[11px] leading-snug text-muted-foreground">
                  Suggestions attach below the field; analysis appears in this
                  same card.
                </p> */}
              </div>
            </div>
            {/* <div className="flex items-center gap-2 border-b border-border/50 bg-muted/25 px-4 py-1.5">
              <RiSearchLine
                className="mt-0.5 size-5 shrink-0 text-primary"
                aria-hidden
              />
              <h2 className="text-sm font-semibold tracking-tight">
                Search &amp; market
              </h2>
            </div> */}
            {marketResult ? (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="shrink-0 gap-1 text-muted-foreground hover:text-foreground"
                onClick={() => setMarketResult(null)}
              >
                <RiCloseLine className="size-4" aria-hidden />
                Clear
              </Button>
            ) : null}
          </div>

          <div className="flex min-h-0 flex-1 flex-col gap-0">
            <div className="shrink-0 p-2 pb-2">
              <label className="sr-only" htmlFor="market-search">
                Search products or keywords
              </label>

              {/* Added relative wrapper to anchor the absolute dropdown */}
              <div className="relative">
                <div className="overflow-hidden rounded-xl border border-border/60 bg-card shadow-sm ring-1 ring-border/20 transition-all focus-within:ring-primary/20 ">
                  {/* Changed from sm:items-stretch to sm:items-center */}
                  <div className="flex flex-col sm:flex-row sm:items-center">
                    <div className="flex min-w-0 flex-1 flex-col border-border/50 sm:border-r">
                      <div className="relative flex items-center">
                        <RiSearchLine
                          className="pointer-events-none absolute left-3 z-10 size-5 text-muted-foreground"
                          aria-hidden
                        />
                        <input
                          ref={marketSearchInputRef}
                          id="market-search"
                          type="search"
                          role="combobox"
                          aria-expanded={
                            marketSearchFocused && marketQuery.trim().length > 0
                          }
                          aria-autocomplete="list"
                          aria-controls="market-search-suggestions"
                          placeholder="SKU, name, or keyword…"
                          autoComplete="off"
                          /* Adjusted height to h-11 to balance perfectly with the button */
                          className="h-11 w-full border-0 bg-transparent pr-3 pl-10 text-sm outline-none focus-visible:ring-0"
                          value={marketQuery}
                          onChange={(e) => setMarketQuery(e.target.value)}
                          onFocus={() => setMarketSearchFocused(true)}
                          onBlur={() => {
                            window.setTimeout(
                              () => setMarketSearchFocused(false),
                              200
                            )
                          }}
                          onKeyDown={(e) => {
                            if (e.key === "Escape") {
                              e.preventDefault()
                              setMarketSearchHighlightIdx(-1)
                              marketSearchInputRef.current?.blur()
                              return
                            }
                            if (e.key === "ArrowDown") {
                              e.preventDefault()
                              if (!marketSearchRows.length) return
                              setMarketSearchHighlightIdx((i) => {
                                const next = i < 0 ? 0 : i + 1
                                return Math.min(
                                  marketSearchRows.length - 1,
                                  next
                                )
                              })
                              return
                            }
                            if (e.key === "ArrowUp") {
                              e.preventDefault()
                              if (!marketSearchRows.length) return
                              setMarketSearchHighlightIdx((i) =>
                                Math.max(0, i < 0 ? 0 : i - 1)
                              )
                              return
                            }
                            if (e.key === "Enter") {
                              void runMarketSearch({ useListHighlight: true })
                            }
                          }}
                        />
                      </div>
                    </div>

                    {/* Added standard padding around the button wrapper to prevent stretching */}
                    <div className="shrink-0 bg-muted/5 p-1 sm:bg-transparent">
                      <Button
                        type="button"
                        size="default"
                        className="h-9 w-full shrink-0 rounded-lg px-4 font-medium sm:w-auto"
                        disabled={marketLoading}
                        onClick={() => void runMarketSearch()}
                      >
                        {marketLoading ? "Working…" : "Analyze"}
                      </Button>
                    </div>
                  </div>
                </div>

                {/* Extracted Dropdown: Now absolute positioned so it floats over the card */}
                {marketSearchFocused && marketQuery.trim().length > 0 ? (
                  <div
                    id="market-search-suggestions"
                    role="listbox"
                    className="absolute top-full right-0 left-0 z-50 mt-2 max-h-[min(240px,36vh)] overflow-y-auto rounded-xl border border-border/60 bg-card shadow-xl ring-1 ring-black/5"
                  >
                    {apiProductLoading && marketSearchRows.length === 0 ? (
                      <div className="px-3 py-4 text-sm text-muted-foreground">
                        Searching sample product catalog…
                      </div>
                    ) : marketSearchRows.length === 0 && !apiProductLoading ? (
                      <div className="px-3 py-3 text-sm text-muted-foreground">
                        {marketQuery.trim().length < 2 ? (
                          <>
                            No inventory match for that letter. Type{" "}
                            <span className="font-medium text-foreground">
                              2+ characters
                            </span>{" "}
                            to search the sample product API, or use{" "}
                            <span className="font-medium text-foreground">
                              Analyze
                            </span>{" "}
                            on the keyword.
                          </>
                        ) : (
                          <>
                            No matches in inventory or the sample API. Use{" "}
                            <span className="font-medium text-foreground">
                              Analyze
                            </span>{" "}
                            for a keyword-level market read (AI or estimate).
                          </>
                        )}
                      </div>
                    ) : (
                      <ul className="py-1">
                        {marketSearchRows.map((row, idx) => {
                          const hi = marketSearchHighlightIdx === idx
                          const prev = marketSearchRows[idx - 1]
                          const showInvBanner =
                            row.kind === "catalog" &&
                            (!prev || prev.kind !== "catalog")
                          const showApiBanner =
                            row.kind === "api" &&
                            (!prev || prev.kind === "catalog")
                          return (
                            <React.Fragment
                              key={
                                row.kind === "catalog"
                                  ? `c-${row.inv.id}`
                                  : `a-${row.hit.id}`
                              }
                            >
                              {showInvBanner ? (
                                <li
                                  role="presentation"
                                  className="sticky top-0 z-1 border-b border-border/40 bg-background/95 px-3 py-2 text-[11px] font-medium text-muted-foreground backdrop-blur-sm"
                                >
                                  Your inventory
                                </li>
                              ) : null}
                              {showApiBanner ? (
                                <li
                                  role="presentation"
                                  className="sticky top-0 z-1 border-b border-border/40 bg-background/95 px-3 py-2 text-[11px] font-medium text-muted-foreground backdrop-blur-sm"
                                >
                                  Sample catalog (API)
                                </li>
                              ) : null}
                              <li role="option" aria-selected={hi}>
                                {row.kind === "catalog" ? (
                                  <button
                                    type="button"
                                    className={cn(
                                      "flex w-full items-center gap-3 px-3 py-2.5 text-left text-sm transition-colors",
                                      hi
                                        ? "bg-accent text-accent-foreground"
                                        : "hover:bg-muted/80"
                                    )}
                                    onMouseDown={(ev) => ev.preventDefault()}
                                    onMouseEnter={() =>
                                      setMarketSearchHighlightIdx(idx)
                                    }
                                    onClick={() =>
                                      pickVariantForMarket(row.inv)
                                    }
                                  >
                                    <img
                                      src={resolveVariantImageUrl({
                                        sku: row.inv.sku,
                                        id: row.inv.id,
                                        imageUrl: row.inv.imageUrl,
                                      })}
                                      alt=""
                                      className="size-9 shrink-0 rounded-md object-cover"
                                      loading="lazy"
                                    />
                                    <div className="min-w-0 flex-1">
                                      <p className="truncate font-medium">
                                        {row.inv.productName}
                                      </p>
                                      <p className="truncate font-mono text-xs text-muted-foreground">
                                        {row.inv.sku}
                                      </p>
                                    </div>
                                    {(() => {
                                      const sig = variantMarketSignal(row.inv)
                                      return (
                                        <div className="shrink-0 text-right text-xs tabular-nums">
                                          <span
                                            className={cn(
                                              "font-semibold",
                                              sig.momentumPct > 3 &&
                                                "text-emerald-600 dark:text-emerald-400",
                                              sig.momentumPct < -3 &&
                                                "text-rose-600 dark:text-rose-400"
                                            )}
                                          >
                                            {sig.momentumPct > 0 ? "+" : ""}
                                            {sig.momentumPct}%
                                          </span>
                                          <p className="text-muted-foreground">
                                            {sig.confidence}% conf.
                                          </p>
                                        </div>
                                      )
                                    })()}
                                  </button>
                                ) : (
                                  <button
                                    type="button"
                                    className={cn(
                                      "flex w-full items-center gap-3 px-3 py-2.5 text-left text-sm transition-colors",
                                      hi
                                        ? "bg-accent text-accent-foreground"
                                        : "hover:bg-muted/80"
                                    )}
                                    onMouseDown={(ev) => ev.preventDefault()}
                                    onMouseEnter={() =>
                                      setMarketSearchHighlightIdx(idx)
                                    }
                                    onClick={() =>
                                      void pickExternalProductForMarket(row.hit)
                                    }
                                  >
                                    {row.hit.thumbnailUrl ? (
                                      <img
                                        src={row.hit.thumbnailUrl}
                                        alt=""
                                        className="size-9 shrink-0 rounded-md bg-muted object-cover"
                                        loading="lazy"
                                      />
                                    ) : (
                                      <div className="size-9 shrink-0 rounded-md bg-muted" />
                                    )}
                                    <div className="min-w-0 flex-1">
                                      <p className="truncate font-medium">
                                        {row.hit.title}
                                      </p>
                                      <p className="truncate text-xs text-muted-foreground">
                                        {[row.hit.brand, row.hit.category]
                                          .filter(Boolean)
                                          .join(" · ")}
                                      </p>
                                    </div>
                                    <span className="shrink-0 text-[10px] font-medium text-primary">
                                      Trend →
                                    </span>
                                  </button>
                                )}
                              </li>
                            </React.Fragment>
                          )
                        })}
                        {apiProductLoading && marketSearchMatches.length > 0 ? (
                          <li
                            role="presentation"
                            className="px-3 py-2 text-xs text-muted-foreground"
                          >
                            Loading sample products…
                          </li>
                        ) : null}
                      </ul>
                    )}
                  </div>
                ) : null}
              </div>
            </div>

            <div
              className={cn(
                "flex min-h-[170px] flex-1 flex-col border-t border-border/50",
                marketResult ? "bg-primary/5" : "bg-muted/10"
              )}
            >
              <div className="flex items-center border-b border-border/40 bg-muted/20 px-4 py-2">
                <p className="text-[10px] font-semibold tracking-wide text-primary uppercase">
                  Trend read
                </p>
              </div>
              <div className="min-h-0 flex-1 space-y-3 overflow-y-auto p-3 sm:p-2">
                {marketResult ? (
                  <>
                    <div className="grid gap-4 sm:grid-cols-[1fr_auto] sm:items-start">
                      <div>
                      {marketResult.externalProduct ? (
                      <div className=" flex items-center gap-3 rounded-lg border border-border/60 bg-background/70 p-2.5">
                        {marketResult.externalProduct.thumbnailUrl ? (
                          <img
                            src={marketResult.externalProduct.thumbnailUrl}
                            alt=""
                            className="size-11 shrink-0 rounded-md bg-muted object-cover"
                            loading="lazy"
                          />
                        ) : (
                          <div className="size-11 shrink-0 rounded-md bg-muted" />
                        )}
                        <div className="min-w-0">
                          <p className="text-[10px] font-semibold tracking-wide text-muted-foreground uppercase">
                            Product search
                          </p>
                          <p className="truncate text-sm font-medium">
                            {marketResult.externalProduct.title}
                          </p>
                          <p className="truncate text-xs text-muted-foreground">
                            {[
                              marketResult.externalProduct.brand,
                              marketResult.externalProduct.category,
                            ]
                              .filter(Boolean)
                              .join(" · ")}
                          </p>
                        </div>
                      </div>
                    ) : null}
                        <p className="text-xs font-medium text-muted-foreground">
                          Market direction
                        </p>
                        <p
                          className={cn(
                            "mt-1 text-3xl font-bold tracking-tight tabular-nums sm:text-4xl",
                            marketResult.momentumPct > 3 &&
                              "text-emerald-600 dark:text-emerald-400",
                            marketResult.momentumPct < -3 &&
                              "text-rose-600 dark:text-rose-400",
                            marketResult.momentumPct >= -3 &&
                              marketResult.momentumPct <= 3 &&
                              "text-foreground"
                          )}
                        >
                          {marketResult.momentumPct > 0 ? "+" : ""}
                          {marketResult.momentumPct}%
                          <span className="ml-2 block text-sm font-normal text-muted-foreground sm:ml-2 sm:inline">
                            {marketResult.momentumPct > 3
                              ? "Trending up"
                              : marketResult.momentumPct < -3
                                ? "Trending down"
                                : "Roughly flat"}
                          </span>
                        </p>
                      </div>
                      <div className="rounded-xl border border-border/50 bg-muted/20 px-4 py-3 sm:text-right">
                        <p className="text-xs font-medium text-muted-foreground">
                          Confidence
                        </p>
                        <p className="mt-1 text-2xl font-semibold tabular-nums">
                          {marketResult.confidence}%
                        </p>
                        <div className="mt-2 h-2 w-full max-w-44 overflow-hidden rounded-full bg-muted sm:ml-auto">
                          <div
                            className="h-full rounded-full bg-primary transition-[width] duration-300"
                            style={{
                              width: `${Math.min(100, Math.max(0, marketResult.confidence))}%`,
                            }}
                          />
                        </div>
                      </div>
                    </div>
                    <div className="rounded-xl border border-border/40 bg-muted/15 p-4">
                      <p className="text-[11px] font-semibold tracking-wide text-muted-foreground uppercase">
                        Summary
                      </p>
                      <p className="mt-2 max-h-48 overflow-y-auto text-sm leading-relaxed text-muted-foreground md:max-h-56">
                        {marketResult.summary}
                      </p>
                    </div>
                    
                    <p className="mt-2 text-[11px] text-muted-foreground">
                      Source: {marketResult.source}
                    </p>
                    {marketResult.catalogMatches &&
                    marketResult.catalogMatches.length > 0 ? (
                      <div className="mt-4 space-y-2">
                        <p className="text-xs font-medium text-muted-foreground">
                          Matching products — pick one
                        </p>
                        <ul className="max-h-56 space-y-1.5 overflow-y-auto rounded-lg border border-border/60 bg-background/80 p-1.5">
                          {marketResult.catalogMatches.map((inv) => {
                            const sig = variantMarketSignal(inv)
                            return (
                              <li key={inv.id}>
                                <button
                                  type="button"
                                  className="flex w-full items-center gap-3 rounded-md px-2 py-2 text-left text-sm hover:bg-muted/80"
                                  onClick={() => pickVariantForMarket(inv)}
                                >
                                  <img
                                    src={resolveVariantImageUrl({
                                      sku: inv.sku,
                                      id: inv.id,
                                      imageUrl: inv.imageUrl,
                                    })}
                                    alt=""
                                    className="size-8 shrink-0 rounded object-cover"
                                    loading="lazy"
                                  />
                                  <div className="min-w-0 flex-1">
                                    <p className="truncate font-medium">
                                      {inv.productName}
                                    </p>
                                    <p className="font-mono text-[11px] text-muted-foreground">
                                      {inv.sku}
                                    </p>
                                  </div>
                                  <span
                                    className={cn(
                                      "shrink-0 text-xs font-semibold tabular-nums",
                                      sig.momentumPct > 3 &&
                                        "text-emerald-600 dark:text-emerald-400",
                                      sig.momentumPct < -3 &&
                                        "text-rose-600 dark:text-rose-400"
                                    )}
                                  >
                                    {sig.momentumPct > 0 ? "+" : ""}
                                    {sig.momentumPct}%
                                  </span>
                                </button>
                              </li>
                            )
                          })}
                        </ul>
                      </div>
                    ) : null}
                    {marketResult.matchedSku ? (
                      <Button
                        type="button"
                        variant="secondary"
                        size="sm"
                        className="mt-1"
                        onClick={() => {
                          setSku(marketResult.matchedSku!)
                          setInventoryExpandedSku(marketResult.matchedSku!)
                          document
                            .getElementById("product-planner")
                            ?.scrollIntoView({ behavior: "smooth" })
                        }}
                      >
                        Open {marketResult.matchedSku} in planner
                      </Button>
                    ) : null}
                  </>
                ) : (
                  <div className="flex flex-1 flex-col justify-center gap-3 py-2">
                    <div className="grid grid-cols-2 gap-2">
                      <div className="rounded-lg border border-border/50 bg-muted/25 px-3 py-3 text-center">
                        <p className="text-[11px] font-medium text-muted-foreground">
                          Direction
                        </p>
                        <p className="mt-1 text-2xl font-bold text-muted-foreground/70 tabular-nums">
                          —
                        </p>
                      </div>
                      <div className="rounded-lg border border-border/50 bg-muted/25 px-3 py-3 text-center">
                        <p className="text-[11px] font-medium text-muted-foreground">
                          Confidence
                        </p>
                        <p className="mt-1 text-2xl font-bold text-muted-foreground/70 tabular-nums">
                          —
                        </p>
                      </div>
                    </div>
                    <p className="text-center text-xs leading-relaxed text-muted-foreground">
                      <span className="font-medium text-foreground">
                        Run analysis
                      </span>{" "}
                      on your keyword or pick a suggestion / inventory tile.
                    </p>
                  </div>
                )}
              </div>
            </div>
          </div>
        </Panel>
      </div>

      <Panel className="relative max-h-[min(260px,34vh)] space-y-3 overflow-y-auto border-primary/20 bg-linear-to-br from-violet-500/10 via-primary/5 to-cyan-500/10 p-4">
        {aiLoading ? (
          <div className="pointer-events-none absolute inset-0 overflow-hidden">
            <div className="absolute -inset-x-1/2 top-0 h-24 -translate-x-1/2 bg-linear-to-r from-transparent via-white/30 to-transparent blur-xl animate-pulse dark:via-white/10" />
          </div>
        ) : null}
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-sm font-semibold">AI trend</h2>
            <p className="mt-1 text-xs text-muted-foreground">
              Should you buy this product? AI analyzes demand, stock levels,
              and market signals.
              {supplierCtx !== "unknown" &&
                " Includes negotiation tips based on supplier context."}
            </p>
          </div>
          <Button
            type="button"
            size="sm"
            className={cn(
              "relative",
              aiLoading && "border-primary/40 bg-primary/90 text-primary-foreground"
            )}
            onClick={() => void runAiTrend()}
            disabled={aiLoading || !v}
          >
            {aiLoading ? (
              <span className="inline-flex items-center gap-1.5">
                <span className="inline-flex size-4 items-center justify-center rounded-full border border-primary-foreground/30">
                  <span className="size-1.5 rounded-full bg-primary-foreground animate-pulse" />
                </span>
                <span>Analyzing</span>
                <span className="inline-flex">
                  <span className="animate-bounce [animation-delay:0ms]">.</span>
                  <span className="animate-bounce [animation-delay:120ms]">.</span>
                  <span className="animate-bounce [animation-delay:240ms]">.</span>
                </span>
              </span>
            ) : (
              "Run AI analysis"
            )}
          </Button>
        </div>

        {aiLoading ? (
          <div className="space-y-2 rounded-xl border border-primary/25 bg-background/60 p-3 backdrop-blur-sm">
            <div className="h-2 w-32 rounded bg-primary/20 animate-pulse" />
            <div className="h-2 w-full rounded bg-primary/15 animate-pulse" />
            <div className="h-2 w-5/6 rounded bg-primary/15 animate-pulse" />
          </div>
        ) : null}

        {aiResult?.error && (
          <p className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">
            {aiResult.error}
          </p>
        )}

        {aiResult && !aiResult.error && (
          <div className="space-y-3">
            <div className="flex flex-wrap items-center gap-3">
              <span
                className={cn(
                  "rounded-lg border px-4 py-2 text-sm font-bold",
                  VERDICT_STYLE[aiResult.verdict ?? "hold"] ?? VERDICT_STYLE.hold
                )}
              >
                {VERDICT_LABEL[aiResult.verdict ?? "hold"] ??
                  aiResult.verdict ??
                  "Hold"}
              </span>
              {aiResult.confidence != null && (
                <div className="flex items-center gap-2">
                  <span className="text-xs text-muted-foreground">Confidence</span>
                  <div className="h-2 w-24 overflow-hidden rounded-full bg-muted">
                    <div
                      className="h-full rounded-full bg-primary transition-all"
                      style={{ width: `${aiResult.confidence}%` }}
                    />
                  </div>
                  <span className="text-xs font-medium tabular-nums">
                    {aiResult.confidence}%
                  </span>
                </div>
              )}
            </div>
            {aiResult.summary && (
              <p className="text-sm leading-relaxed text-muted-foreground">
                {aiResult.summary}
              </p>
            )}
          </div>
        )}
      </Panel>

      <div
        id="product-planner"
        className="grid scroll-mt-20 items-stretch gap-3 lg:grid-cols-12"
      >
        <Panel className="flex min-h-[260px] flex-col overflow-hidden p-0 lg:col-span-8">
          <div className="flex items-center gap-2 border-b border-border/50 bg-muted/25 px-4 py-3">
            <RiStackLine className="size-5 shrink-0 text-primary" aria-hidden />
            <div>
              <h2 className="text-sm font-semibold tracking-tight">
                All SKUs + planner
              </h2>
              <p className="text-[11px] text-muted-foreground">
                Click any SKU to update demand, AI, chart, and order settings.
              </p>
            </div>
          </div>
          <div className="border-b border-border/50 bg-card/60 px-3 py-2.5">
            {v ? (
              <div className="flex flex-wrap items-center gap-2">
                <span className="inline-flex items-center gap-2 rounded-md border border-border/60 bg-background px-2 py-1 text-xs">
                  <img
                    src={resolveVariantImageUrl({
                      sku: v.sku,
                      id: v.id,
                      imageUrl: v.imageUrl,
                    })}
                    alt={v.productName}
                    className="size-5 shrink-0 rounded object-cover"
                    loading="lazy"
                  />
                  <span className="font-mono font-medium">{v.sku}</span>
                  <span className="text-muted-foreground">{v.productName}</span>
                </span>
                {(
                  [
                    ["On hand", v.onHand],
                    ["Inbound", v.inbound],
                    ["Cover", `${v.weeksCover}w`],
                    ["Trend", v.trendScore],
                    ["~Units/wk", wk.toFixed(1)],
                  ] as const
                ).map(([label, val]) => (
                  <span
                    key={label}
                    className="inline-flex items-center gap-1 rounded-md border border-border/50 bg-muted/30 px-2 py-1 text-[11px]"
                  >
                    <span className="text-muted-foreground">{label}</span>
                    <span className="font-semibold tabular-nums">{val}</span>
                  </span>
                ))}
                {rank != null ? (
                  <span className="inline-flex items-center rounded-md border border-primary/25 bg-primary/10 px-2 py-1 text-[11px] font-medium text-primary">
                    #{rank}/{variants.length}
                  </span>
                ) : null}
              </div>
            ) : (
              <p className="text-xs text-muted-foreground">
                No product selected.
              </p>
            )}
          </div>
          <div className="max-h-[min(360px,46vh)] flex-1 overflow-y-auto p-3 lg:max-h-[min(520px,55vh)]">
            {variants.length === 0 ? (
              <p className="p-2 text-sm text-muted-foreground">No products.</p>
            ) : (
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 xl:grid-cols-4">
                {variants.map((inv) => {
                  const sig = variantMarketSignal(inv)
                  const selected = sku === inv.sku
                  return (
                    <button
                      key={inv.id}
                      type="button"
                      onClick={() => {
                        setSku(inv.sku)
                        setInventoryExpandedSku(null)
                        setAiResult(null)
                      }}
                      className={cn(
                        "flex flex-col gap-2 rounded-xl border p-2.5 text-left transition-all hover:shadow-md",
                        selected
                          ? "border-primary/50 bg-primary/5 ring-2 ring-primary/20"
                          : "border-border/60 bg-card hover:border-border"
                      )}
                    >
                      <div className="flex items-start gap-2">
                        <img
                          src={resolveVariantImageUrl({
                            sku: inv.sku,
                            id: inv.id,
                            imageUrl: inv.imageUrl,
                          })}
                          alt=""
                          className="size-9 shrink-0 rounded-md object-cover"
                          loading="lazy"
                        />
                        <div className="min-w-0 flex-1">
                          <p className="line-clamp-2 text-[11px] leading-snug font-medium">
                            {inv.productName}
                          </p>
                          <p className="mt-0.5 font-mono text-[10px] text-muted-foreground">
                            {inv.sku}
                          </p>
                        </div>
                      </div>
                      <div className="rounded-md bg-muted/50 px-1.5 py-1 text-[10px]">
                        <span className="text-muted-foreground">Direction</span>
                        <span
                          className={cn(
                            "ml-1 font-semibold tabular-nums",
                            sig.momentumPct > 3 &&
                              "text-emerald-600 dark:text-emerald-400",
                            sig.momentumPct < -3 &&
                              "text-rose-600 dark:text-rose-400"
                          )}
                        >
                          {sig.momentumPct > 0 ? "+" : ""}
                          {sig.momentumPct}%
                        </span>
                        <span className="ml-2 text-muted-foreground">Confidence</span>
                        <span className="ml-1 font-semibold tabular-nums">
                          {sig.confidence}%
                        </span>
                      </div>
                      <div className="grid grid-cols-2 gap-1 text-[10px]">
                        <div className="rounded-md bg-muted/50 px-1.5 py-1">
                          <span className="text-muted-foreground">OH</span>
                          <span className="ml-1 font-semibold tabular-nums">
                            {inv.onHand}
                          </span>
                        </div>
                        <div className="rounded-md bg-muted/50 px-1.5 py-1">
                          <span className="text-muted-foreground">Cover</span>
                          <span className="ml-1 font-semibold tabular-nums">
                            {inv.weeksCover}w
                          </span>
                        </div>
                      </div>
                      <div className="flex items-center justify-between border-t border-border/40 pt-1 text-[10px] text-muted-foreground">
                        <span>Trend {inv.trendScore}</span>
                        <span>~{sig.demandProb}%</span>
                      </div>
                    </button>
                  )
                })}
              </div>
            )}
          </div>
        </Panel>

        <Panel
          className={cn(
            "relative overflow-hidden bg-linear-to-b p-4 lg:col-span-4",
            scoreColor(prob)
          )}
        >
          <p className="text-xs font-medium text-muted-foreground">
            Demand score (~30 days)
          </p>
          <div className="mt-2 flex items-end gap-2">
            <span className="text-4xl font-bold tracking-tight tabular-nums lg:text-5xl">
              {prob}%
            </span>
          </div>
          {breakdown && (
            <p className="mt-1 text-xs text-muted-foreground">
              Range {breakdown.bandLow}%–{breakdown.bandHigh}%
            </p>
          )}
          <div
            className="mt-4 h-2.5 overflow-hidden rounded-full bg-background/60 ring-1 ring-border/50"
            role="presentation"
          >
            <div
              className={cn(
                "h-full rounded-full transition-all duration-300",
                scoreBarColor(prob)
              )}
              style={{ width: `${prob}%` }}
            />
          </div>
          <div className="mt-4 space-y-2 rounded-lg border border-border/50 bg-background/70 p-3 text-sm backdrop-blur-sm">
            <div className="flex justify-between gap-2">
              <span className="text-muted-foreground">Suggested buy</span>
              <span className="font-semibold tabular-nums">
                {reorder} units
              </span>
            </div>
            <div className="flex flex-wrap items-center gap-2 border-t border-border/40 pt-2">
              <span
                className={cn(
                  "rounded-full px-2 py-0.5 text-xs font-medium",
                  timing?.action === "order_now" &&
                    "bg-emerald-500/15 text-emerald-800 dark:text-emerald-300",
                  timing?.action === "delay" &&
                    "bg-amber-500/15 text-amber-900 dark:text-amber-200",
                  timing?.action === "hold" && "bg-muted text-muted-foreground"
                )}
              >
                {timing?.action === "order_now"
                  ? "Order now"
                  : timing?.action === "delay"
                    ? `Delay ~${timing.delayDays}d`
                    : "Hold"}
              </span>
              <span className="text-xs text-muted-foreground">
                {timing?.reason}
              </span>
            </div>
          </div>
        </Panel>
      </div>

      <div className="grid gap-3 lg:grid-cols-12">

        <Panel className="space-y-3 p-4 lg:col-span-4">
          <h2 className="text-sm font-semibold">Order settings</h2>
          <p className="text-xs text-muted-foreground">
            Target + lead + safety weeks × units/week, minus stock on hand and
            inbound.
          </p>
          <div className="flex flex-wrap gap-3">
            {(
              [
                ["targetW", "Target (wk)", targetW, setTargetW],
                ["leadW", "Lead (wk)", leadW, setLeadW],
                ["safetyW", "Safety (wk)", safetyW, setSafetyW],
              ] as const
            ).map(([id, label, val, setVal]) => (
              <label key={id} className="text-xs">
                <span className="text-muted-foreground">{label}</span>
                <input
                  type="number"
                  min={0}
                  max={24}
                  step={0.5}
                  className="mt-1 block h-9 w-20 rounded-md border border-input bg-background px-2 text-sm"
                  value={val}
                  onChange={(e) => setVal(Number(e.target.value) || 0)}
                />
              </label>
            ))}
          </div>
        </Panel>

        <Panel className="max-h-[min(340px,42vh)] space-y-2 overflow-y-auto p-4 lg:col-span-4">
          <h2 className="text-sm font-semibold">Score breakdown</h2>
          {breakdown && (
            <>
              <ul className="space-y-2.5">
                {breakdown.parts.map((part) => (
                  <li key={part.id}>
                    <div className="flex items-center justify-between gap-2 text-xs">
                      <span className="font-medium">{part.label}</span>
                      <span
                        className={cn(
                          "tabular-nums",
                          part.points > 0 &&
                            "text-emerald-600 dark:text-emerald-400",
                          part.points < 0 && "text-rose-600 dark:text-rose-400",
                          part.points === 0 && "text-muted-foreground"
                        )}
                      >
                        {part.points > 0 ? "+" : ""}
                        {part.points === 0 ? "0" : part.points.toFixed(1)}
                      </span>
                    </div>
                    <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-muted">
                      <div
                        className={cn(
                          "h-full rounded-full",
                          part.points >= 0 ? "bg-primary/80" : "bg-rose-400/80"
                        )}
                        style={{
                          width: `${(Math.abs(part.points) / maxPart) * 100}%`,
                        }}
                      />
                    </div>
                    <p className="mt-0.5 text-[11px] text-muted-foreground">
                      {part.detail}
                    </p>
                  </li>
                ))}
              </ul>
              <p className="border-t border-border/50 pt-2 text-[11px] text-muted-foreground">
                Parts add to {breakdown.rawBeforeClamp.toFixed(1)}, clamped to
                12–94% → {breakdown.total}%.
              </p>
            </>
          )}
        </Panel>

        <Panel className="max-h-[min(340px,42vh)] space-y-2 overflow-y-auto p-4 lg:col-span-4">
          <h2 className="text-sm font-semibold">Demand signals</h2>
          <p className="text-xs text-muted-foreground">
            Adjust if you feel external demand is hotter or colder than usual.
          </p>
          {(
            [
              ["googleTrends", "Search interest"],
              ["marketplace", "Marketplaces"],
              ["social", "Social / buzz"],
            ] as const
          ).map(([key, label]) => (
            <label key={key} className="block text-xs">
              <span className="text-muted-foreground">
                {label}: {external[key]}%
              </span>
              <input
                type="range"
                min={0}
                max={100}
                value={external[key]}
                onChange={(e) =>
                  setExternal((s) => ({ ...s, [key]: Number(e.target.value) }))
                }
                className="mt-1 w-full accent-primary"
              />
            </label>
          ))}
          <div className="grid gap-3 border-t border-border/40 pt-3 sm:grid-cols-2">
            <label className="block text-xs">
              <span className="text-muted-foreground">
                Region: {regionHeat}%
              </span>
              <input
                type="range"
                min={0}
                max={100}
                value={regionHeat}
                onChange={(e) => setRegionHeat(Number(e.target.value))}
                className="mt-1 w-full accent-primary"
              />
            </label>
            <label className="block text-xs">
              <span className="text-muted-foreground">
                Category: {categoryHeat}%
              </span>
              <input
                type="range"
                min={0}
                max={100}
                value={categoryHeat}
                onChange={(e) => setCategoryHeat(Number(e.target.value))}
                className="mt-1 w-full accent-primary"
              />
            </label>
          </div>
        </Panel>

        <Panel className="overflow-hidden p-0 lg:col-span-8">
          <div className="border-b border-border/60 px-4 py-2.5">
            <h2 className="text-sm font-semibold">Units per week</h2>
            <p className="text-xs text-muted-foreground">History vs forecast</p>
          </div>
          <div className="p-2 sm:p-3">
            {chartData.length === 0 ? (
              <p className="text-sm text-muted-foreground">No chart data.</p>
            ) : (
              <ChartContainer
                config={chartConfig}
                className="aspect-auto h-[min(220px,32vh)] min-h-[180px] w-full"
                initialDimension={{ width: 560, height: 220 }}
              >
                <LineChart
                  data={chartData}
                  margin={{ left: 4, right: 8, top: 8, bottom: 4 }}
                >
                  <CartesianGrid
                    strokeDasharray="3 3"
                    className="stroke-border/60"
                    vertical={false}
                  />
                  <XAxis
                    dataKey="week"
                    tickLine={false}
                    axisLine={false}
                    tickMargin={6}
                  />
                  <YAxis
                    width={36}
                    tickLine={false}
                    axisLine={false}
                    tickMargin={6}
                  />
                  <ChartTooltip content={<ChartTooltipContent />} />
                  <Legend />
                  <ReferenceLine
                    x="-1"
                    stroke="var(--border)"
                    strokeDasharray="4 4"
                  />
                  <Line
                    type="monotone"
                    dataKey="past"
                    name="Recent weeks"
                    stroke="var(--color-past)"
                    strokeWidth={2}
                    dot={{ r: 2 }}
                    connectNulls
                  />
                  <Line
                    type="monotone"
                    dataKey="future"
                    name="Next weeks"
                    stroke="var(--color-future)"
                    strokeWidth={2}
                    strokeDasharray="5 5"
                    dot={{ r: 2 }}
                    connectNulls
                  />
                  <Line
                    type="monotone"
                    dataKey="bandLow"
                    name="Low"
                    stroke="var(--color-low)"
                    strokeWidth={1}
                    strokeOpacity={0.45}
                    dot={false}
                    connectNulls
                  />
                  <Line
                    type="monotone"
                    dataKey="bandHigh"
                    name="High"
                    stroke="var(--color-low)"
                    strokeWidth={1}
                    strokeOpacity={0.45}
                    dot={false}
                    connectNulls
                  />
                </LineChart>
              </ChartContainer>
            )}
          </div>
        </Panel>
      </div>

      {/* Next step CTA */}
      <Panel className="flex flex-wrap items-center justify-between gap-3 border-emerald-500/20 bg-emerald-500/5 p-4">
        <div>
          <p className="text-sm font-medium">Ready to set the price?</p>
          <p className="text-xs text-muted-foreground">
            Move to the AI-powered RSP Generator for pricing strategies.
          </p>
        </div>
        <Button type="button" size="sm" asChild>
          <Link href="/pricing">Generate RSP →</Link>
        </Button>
      </Panel>
    </div>
  )
}
