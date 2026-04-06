"use client"

import * as React from "react"
import { Bar, BarChart, CartesianGrid, Cell, XAxis, YAxis } from "recharts"

import { Panel } from "@/components/panel"
import { Button } from "@/components/ui/button"
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from "@/components/ui/chart"
import { Input } from "@/components/ui/input"
import { useVariantsWithOdoo } from "@/hooks/use-variants-with-odoo"
import {
  deadStockValueHint,
  stockHealthRow,
  type StockHealthRow,
  type StockSegment,
} from "@/lib/intelligence"
import { cn } from "@/lib/utils"

const SEGMENT_LABEL: Record<StockSegment, string> = {
  fast: "Selling well",
  slow: "Slow seller",
  overstock: "Lots in stock",
  dead: "Hard to move",
  stockout_risk: "Running low",
  ok: "Okay",
}

const SEGMENT_CLASS: Record<StockSegment, string> = {
  fast: "bg-emerald-500/15 text-emerald-800 dark:text-emerald-300",
  slow: "bg-slate-500/15 text-slate-800 dark:text-slate-300",
  overstock: "bg-amber-500/15 text-amber-900 dark:text-amber-200",
  dead: "bg-rose-500/15 text-rose-800 dark:text-rose-300",
  stockout_risk: "bg-red-500/20 text-red-900 dark:text-red-200",
  ok: "bg-muted text-muted-foreground",
}

const SEGMENT_BAR_FILL: Record<StockSegment, string> = {
  stockout_risk: "var(--chart-5)",
  dead: "var(--chart-1)",
  slow: "var(--muted-foreground)",
  overstock: "var(--chart-4)",
  fast: "var(--chart-2)",
  ok: "var(--chart-3)",
}

const SEGMENT_CHART_ORDER: StockSegment[] = [
  "stockout_risk",
  "dead",
  "slow",
  "overstock",
  "fast",
  "ok",
]

const chartConfig = {
  count: { label: "SKUs", color: "var(--primary)" },
} satisfies ChartConfig

type HealthFilter =
  | "all"
  | "attention"
  | "stockout"
  | "slow_dead"
  | "overstock"
  | "healthy"

type SortMode = "days_asc" | "days_desc" | "on_hand_desc" | "trend_desc"

type EnrichedHealthRow = StockHealthRow & {
  weeksCover: number
  trendScore: number
  salesQty90d?: number
  inbound: number
}

function matchesFilter(segment: StockSegment, f: HealthFilter): boolean {
  switch (f) {
    case "all":
      return true
    case "attention":
      return (
        segment === "stockout_risk" ||
        segment === "dead" ||
        segment === "slow" ||
        segment === "overstock"
      )
    case "stockout":
      return segment === "stockout_risk"
    case "slow_dead":
      return segment === "dead" || segment === "slow"
    case "overstock":
      return segment === "overstock"
    case "healthy":
      return segment === "ok" || segment === "fast"
    default:
      return true
  }
}

function median(nums: number[]): number | null {
  if (!nums.length) return null
  const s = [...nums].sort((a, b) => a - b)
  const m = Math.floor(s.length / 2)
  return s.length % 2 ? s[m]! : (s[m - 1]! + s[m]!) / 2
}

function rowTone(segment: StockSegment): string | undefined {
  if (segment === "stockout_risk") return "bg-red-500/6"
  if (segment === "dead") return "bg-rose-500/6"
  if (segment === "slow") return "bg-slate-500/5"
  if (segment === "overstock") return "bg-amber-500/6"
  return undefined
}

export function StockHealthWorkspace() {
  const { variants, source, odooLoading, odooError, refetchOdoo } =
    useVariantsWithOdoo()
  const [unitCost, setUnitCost] = React.useState(500)
  const [filter, setFilter] = React.useState<HealthFilter>("all")
  const [query, setQuery] = React.useState("")
  const [sort, setSort] = React.useState<SortMode>("days_asc")
  const [copiedCsv, setCopiedCsv] = React.useState(false)

  const enriched = React.useMemo((): EnrichedHealthRow[] => {
    return variants.map((v) => {
      const r = stockHealthRow(v)
      return {
        ...r,
        weeksCover: v.weeksCover,
        trendScore: v.trendScore,
        salesQty90d: v.salesQty90d,
        inbound: v.inbound,
      }
    })
  }, [variants])

  const kpis = React.useMemo(() => {
    let stockout = 0
    let attention = 0
    let healthy = 0
    let overstockOnly = 0
    const stockoutDays: number[] = []
    for (const r of enriched) {
      if (r.segment === "stockout_risk") {
        stockout++
        if (r.daysToStockout != null) stockoutDays.push(r.daysToStockout)
      }
      if (matchesFilter(r.segment, "attention")) attention++
      if (r.segment === "ok" || r.segment === "fast") healthy++
      if (r.segment === "overstock") overstockOnly++
    }
    return {
      stockout,
      attention,
      healthy,
      overstockOnly,
      medianStockoutDays: median(stockoutDays),
    }
  }, [enriched])

  const segmentCounts = React.useMemo(() => {
    const c: Record<StockSegment, number> = {
      fast: 0,
      slow: 0,
      overstock: 0,
      dead: 0,
      stockout_risk: 0,
      ok: 0,
    }
    for (const r of enriched) c[r.segment]++
    return c
  }, [enriched])

  const chartData = React.useMemo(() => {
    return SEGMENT_CHART_ORDER.filter((seg) => segmentCounts[seg] > 0).map(
      (segment) => ({
        segment,
        label: SEGMENT_LABEL[segment],
        count: segmentCounts[segment],
      })
    )
  }, [segmentCounts])

  const hint = deadStockValueHint(variants, unitCost)

  const filteredSorted = React.useMemo(() => {
    const q = query.trim().toLowerCase()
    let list = enriched.filter((r) => {
      if (!matchesFilter(r.segment, filter)) return false
      if (!q) return true
      return (
        r.sku.toLowerCase().includes(q) ||
        r.productName.toLowerCase().includes(q)
      )
    })
    const daysRank = (r: EnrichedHealthRow) =>
      r.daysToStockout ?? 9999
    list = [...list].sort((a, b) => {
      switch (sort) {
        case "days_asc":
          return daysRank(a) - daysRank(b)
        case "days_desc":
          return daysRank(b) - daysRank(a)
        case "on_hand_desc":
          return b.onHand - a.onHand
        case "trend_desc":
          return b.trendScore - a.trendScore
        default:
          return 0
      }
    })
    return list
  }, [enriched, filter, query, sort])

  const csv = React.useMemo(() => {
    const h =
      "sku,product,segment,cover_wk,trend,days_left_est,weekly_demand,on_hand,inbound,sales_90d,note\n"
    const lines = filteredSorted
      .map((r) =>
        [
          r.sku,
          `"${r.productName.replace(/"/g, '""')}"`,
          r.segment,
          r.weeksCover,
          r.trendScore,
          r.daysToStockout ?? "",
          r.weeklyDemand,
          r.onHand,
          r.inbound,
          r.salesQty90d ?? "",
          `"${r.note.replace(/"/g, '""')}"`,
        ].join(",")
      )
      .join("\n")
    return h + lines
  }, [filteredSorted])

  async function copyCsv() {
    try {
      await navigator.clipboard.writeText(csv)
      setCopiedCsv(true)
      window.setTimeout(() => setCopiedCsv(false), 2000)
    } catch {
      setCopiedCsv(false)
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Inventory</h1>
        <p className="mt-1 max-w-2xl text-sm leading-relaxed text-muted-foreground">
          Each row gets a simple label from weeks of cover, trend, and how fast we think it
          sells. “Days left” is on hand ÷ units per week — a rough guide only.
        </p>
      </div>

      <Panel className="flex flex-wrap items-center gap-3 p-4">
        <Button type="button" variant="outline" size="sm" onClick={() => refetchOdoo()}>
          Refresh
        </Button>
        <Button type="button" size="sm" variant="secondary" onClick={() => void copyCsv()}>
          {copiedCsv ? "Copied" : "Copy CSV"}
        </Button>
        <span className="text-sm text-muted-foreground">
          {source === "odoo" ? "Odoo" : "Demo"} ·{" "}
          {odooLoading ? "loading…" : `${variants.length} SKUs`}
        </span>
        {odooError ? (
          <span className="text-xs text-destructive">{odooError}</span>
        ) : null}
        <div className="ml-auto flex flex-wrap items-center gap-2">
          <label className="text-xs text-muted-foreground" htmlFor="sh-cost">
            Guess cost per unit (₹)
          </label>
          <Input
            id="sh-cost"
            type="number"
            min={1}
            className="h-9 w-24"
            value={unitCost}
            onChange={(e) => setUnitCost(Number(e.target.value) || 500)}
          />
        </div>
      </Panel>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Panel className="p-4">
          <p className="text-xs text-muted-foreground">Running low</p>
          <p className="text-2xl font-semibold tabular-nums text-red-600 dark:text-red-400">
            {kpis.stockout}
          </p>
          <p className="mt-0.5 text-[11px] text-muted-foreground">
            {kpis.medianStockoutDays != null
              ? `Typical ~${kpis.medianStockoutDays} days of stock left (those SKUs)`
              : "None in this bucket"}
          </p>
        </Panel>
        <Panel className="p-4">
          <p className="text-xs text-muted-foreground">Worth a look</p>
          <p className="text-2xl font-semibold tabular-nums">{kpis.attention}</p>
          <p className="mt-0.5 text-[11px] text-muted-foreground">
            Low, stuck, slow, or heavy stock
          </p>
        </Panel>
        <Panel className="p-4">
          <p className="text-xs text-muted-foreground">Doing fine</p>
          <p className="text-2xl font-semibold tabular-nums text-emerald-600 dark:text-emerald-400">
            {kpis.healthy}
          </p>
          <p className="mt-0.5 text-[11px] text-muted-foreground">Okay or selling well</p>
        </Panel>
        <Panel className="p-4">
          <p className="text-xs text-muted-foreground">Lots in stock</p>
          <p className="text-2xl font-semibold tabular-nums text-amber-700 dark:text-amber-300">
            {kpis.overstockOnly}
          </p>
          <p className="mt-0.5 text-[11px] text-muted-foreground">Many weeks on hand</p>
        </Panel>
      </div>

      <div className="grid gap-4 lg:grid-cols-5">
        <Panel className="space-y-2 p-4 lg:col-span-2">
          <p className="text-xs font-medium text-muted-foreground">Slow stock — rupee guess</p>
          <p className="text-sm text-muted-foreground">{hint}</p>
        </Panel>
        <Panel className="p-4 lg:col-span-3">
          <p className="mb-3 text-xs font-medium text-muted-foreground">Count by label</p>
          {chartData.length === 0 ? (
            <p className="text-sm text-muted-foreground">No rows yet.</p>
          ) : (
            <ChartContainer config={chartConfig} className="h-[200px] w-full">
              <BarChart
                layout="vertical"
                data={chartData}
                margin={{ left: 4, right: 12, top: 4, bottom: 4 }}
              >
                <CartesianGrid horizontal={false} className="stroke-border/40" />
                <XAxis type="number" tickLine={false} axisLine={false} />
                <YAxis
                  dataKey="label"
                  type="category"
                  width={108}
                  tickLine={false}
                  axisLine={false}
                  tick={{ fontSize: 11 }}
                />
                <ChartTooltip content={<ChartTooltipContent />} />
                <Bar dataKey="count" radius={4} maxBarSize={28}>
                  {chartData.map((d) => (
                    <Cell key={d.segment} fill={SEGMENT_BAR_FILL[d.segment]} />
                  ))}
                </Bar>
              </BarChart>
            </ChartContainer>
          )}
        </Panel>
      </div>

      <Panel className="space-y-3 border-dashed border-border/50 bg-muted/20 p-4">
        <p className="text-xs font-medium text-muted-foreground">Labels explained</p>
        <p className="text-sm leading-relaxed text-muted-foreground">
          Same numbers as Demand and Restock: weeks of cover, trend, stock on hand, and units per
          week. Filters narrow the table; CSV export matches what you see.
        </p>
      </Panel>

      <Panel className="space-y-4 p-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between">
          <div className="flex flex-wrap gap-2">
            {(
              [
                ["all", "All"],
                ["attention", "Worth a look"],
                ["stockout", "Running low"],
                ["slow_dead", "Slow or stuck"],
                ["overstock", "Heavy stock"],
                ["healthy", "Doing fine"],
              ] as const
            ).map(([key, label]) => (
              <button
                key={key}
                type="button"
                onClick={() => setFilter(key)}
                className={cn(
                  "rounded-full px-3 py-1 text-xs font-medium transition-colors",
                  filter === key
                    ? "bg-primary text-primary-foreground"
                    : "bg-muted text-muted-foreground hover:bg-muted/80"
                )}
              >
                {label}
              </button>
            ))}
          </div>
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
            <label className="sr-only" htmlFor="sh-sort">
              Sort
            </label>
            <select
              id="sh-sort"
              className={cn(
                "h-9 rounded-md border border-input bg-background px-3 text-sm",
                "min-w-[200px]"
              )}
              value={sort}
              onChange={(e) => setSort(e.target.value as SortMode)}
            >
              <option value="days_asc">Days of stock left — smallest first</option>
              <option value="days_desc">Days of stock left — largest first</option>
              <option value="on_hand_desc">Stock on hand — most first</option>
              <option value="trend_desc">Trend — highest first</option>
            </select>
            <Input
              placeholder="Search SKU or product…"
              className="h-9 sm:max-w-xs"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
          </div>
        </div>
        <p className="text-xs text-muted-foreground">
          Showing {filteredSorted.length} of {enriched.length} SKUs
        </p>
      </Panel>

      <Panel className="overflow-x-auto p-0">
        <table className="w-full min-w-[920px] text-sm">
          <thead>
            <tr className="border-b border-border/60 bg-muted/40 text-left text-xs font-semibold uppercase text-muted-foreground">
              <th className="px-4 py-2.5">SKU</th>
              <th className="px-4 py-2.5">Product</th>
              <th className="px-4 py-2.5">Label</th>
              <th className="px-4 py-2.5 text-right">Weeks of stock</th>
              <th className="px-4 py-2.5 text-right">Trend</th>
              <th className="px-4 py-2.5 text-right">Days left (rough)</th>
              <th className="px-4 py-2.5 text-right">Units/wk</th>
              <th className="px-4 py-2.5 text-right">On hand</th>
              <th className="px-4 py-2.5 text-right">Inbound</th>
              <th className="px-4 py-2.5 text-right">90d sales</th>
              <th className="px-4 py-2.5">Note</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border/50">
            {filteredSorted.map((r) => (
              <tr
                key={r.sku}
                className={cn("hover:bg-muted/20", rowTone(r.segment))}
              >
                <td className="px-4 py-2.5 font-mono text-xs">{r.sku}</td>
                <td className="max-w-[180px] truncate px-4 py-2.5">
                  {r.productName}
                </td>
                <td className="px-4 py-2.5">
                  <span
                    className={cn(
                      "inline-flex rounded-full px-2 py-0.5 text-xs font-medium",
                      SEGMENT_CLASS[r.segment]
                    )}
                  >
                    {SEGMENT_LABEL[r.segment]}
                  </span>
                </td>
                <td className="px-4 py-2.5 text-right tabular-nums">
                  {r.weeksCover.toFixed(1)}
                </td>
                <td className="px-4 py-2.5 text-right tabular-nums">
                  {r.trendScore}
                </td>
                <td className="px-4 py-2.5 text-right tabular-nums">
                  {r.daysToStockout != null ? r.daysToStockout : "—"}
                </td>
                <td className="px-4 py-2.5 text-right tabular-nums">
                  {r.weeklyDemand}
                </td>
                <td className="px-4 py-2.5 text-right tabular-nums">{r.onHand}</td>
                <td className="px-4 py-2.5 text-right tabular-nums">
                  {r.inbound}
                </td>
                <td className="px-4 py-2.5 text-right tabular-nums">
                  {r.salesQty90d != null ? r.salesQty90d : "—"}
                </td>
                <td className="max-w-[220px] px-4 py-2.5 text-xs text-muted-foreground">
                  {r.note}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </Panel>
    </div>
  )
}
