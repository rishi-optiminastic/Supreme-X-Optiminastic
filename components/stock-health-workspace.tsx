"use client"

import * as React from "react"
import Link from "next/link"
import { RiAddLine, RiCloseLine, RiInformationLine } from "@remixicon/react"

import { Panel } from "@/components/panel"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { useVariantsWithOdoo } from "@/hooks/use-variants-with-odoo"
import {
  deadStockValueHint,
  stockHealthRow,
  type StockHealthRow,
  type StockSegment,
} from "@/lib/intelligence"
import {
  evaluateStockForLines,
  formatStockConfirmationReport,
  type SalesOrderLine,
} from "@/lib/stock-confirmation"
import { cn } from "@/lib/utils"

/* ─── Segment display config ─── */

const LABELS: Record<StockSegment, string> = {
  fast: "Selling well",
  slow: "Slow seller",
  overstock: "Lots in stock",
  dead: "Hard to move",
  stockout_risk: "Running low",
  ok: "Okay",
}

const BADGE_CLASS: Record<StockSegment, string> = {
  fast: "bg-emerald-500/15 text-emerald-800 dark:text-emerald-300",
  slow: "bg-slate-500/15 text-slate-800 dark:text-slate-300",
  overstock: "bg-amber-500/15 text-amber-900 dark:text-amber-200",
  dead: "bg-rose-500/15 text-rose-800 dark:text-rose-300",
  stockout_risk: "bg-red-500/20 text-red-900 dark:text-red-200",
  ok: "bg-muted text-muted-foreground",
}

/* ─── Types ─── */

type HealthFilter = "all" | "attention" | "stockout" | "slow_dead" | "overstock" | "healthy"
type SortMode = "days_asc" | "days_desc" | "on_hand_desc" | "trend_desc"

type EnrichedRow = StockHealthRow & {
  weeksCover: number
  trendScore: number
  salesQty90d?: number
  inbound: number
}

function matchesFilter(seg: StockSegment, f: HealthFilter): boolean {
  if (f === "all") return true
  if (f === "attention")
    return seg === "stockout_risk" || seg === "dead" || seg === "slow" || seg === "overstock"
  if (f === "stockout") return seg === "stockout_risk"
  if (f === "slow_dead") return seg === "dead" || seg === "slow"
  if (f === "overstock") return seg === "overstock"
  if (f === "healthy") return seg === "ok" || seg === "fast"
  return true
}

function rowTone(seg: StockSegment) {
  if (seg === "stockout_risk") return "bg-red-500/6"
  if (seg === "dead") return "bg-rose-500/6"
  if (seg === "slow") return "bg-slate-500/5"
  if (seg === "overstock") return "bg-amber-500/6"
  return undefined
}

export function StockHealthWorkspace() {
  const { variants, source, odooLoading, odooError, refetchOdoo } = useVariantsWithOdoo()
  const [unitCost, setUnitCost] = React.useState(500)
  const [filter, setFilter] = React.useState<HealthFilter>("all")
  const [query, setQuery] = React.useState("")
  const [sort, setSort] = React.useState<SortMode>("days_asc")
  const [copiedCsv, setCopiedCsv] = React.useState(false)

  const [confirmSku, setConfirmSku] = React.useState("")
  const [confirmQty, setConfirmQty] = React.useState(1)
  const [confirmLines, setConfirmLines] = React.useState<SalesOrderLine[]>([])
  const [copiedReport, setCopiedReport] = React.useState(false)

  React.useEffect(() => {
    if (!confirmSku && variants.length) setConfirmSku(variants[0].sku)
  }, [confirmSku, variants])

  const stockConfirmResults = React.useMemo(
    () => (confirmLines.length ? evaluateStockForLines(variants, confirmLines) : null),
    [variants, confirmLines]
  )

  const stockConfirmReport = React.useMemo(() => {
    if (!stockConfirmResults?.length) return ""
    return formatStockConfirmationReport({
      title: "Stock Confirmation Report",
      sourceLabel: source === "odoo" ? "Odoo Live" : "Demo Data",
      lines: confirmLines,
      results: stockConfirmResults,
    })
  }, [confirmLines, stockConfirmResults, source])

  const addConfirmLine = () => {
    const qty = Math.max(1, Math.floor(confirmQty) || 1)
    if (!confirmSku.trim()) return
    setConfirmLines((prev) => {
      const i = prev.findIndex((l) => l.sku === confirmSku)
      if (i >= 0) {
        const next = [...prev]
        next[i] = { sku: confirmSku, qty: next[i]!.qty + qty }
        return next
      }
      return [...prev, { sku: confirmSku, qty }]
    })
  }

  const removeConfirmLine = (sku: string) =>
    setConfirmLines((prev) => prev.filter((l) => l.sku !== sku))

  const addConfirmLineForSku = (sku: string) => {
    const qty = Math.max(1, Math.floor(confirmQty) || 1)
    if (!sku.trim()) return
    setConfirmSku(sku)
    setConfirmLines((prev) => {
      const i = prev.findIndex((l) => l.sku === sku)
      if (i >= 0) {
        const next = [...prev]
        next[i] = { sku, qty: next[i]!.qty + qty }
        return next
      }
      return [...prev, { sku, qty }]
    })
  }

  const confirmAllOk =
    stockConfirmResults && stockConfirmResults.length > 0
      ? stockConfirmResults.every((r) => r.ok)
      : null

  const confirmSkuSet = React.useMemo(
    () => new Set(confirmLines.map((l) => l.sku)),
    [confirmLines]
  )

  const selectedVariantForConfirm = React.useMemo(
    () => variants.find((v) => v.sku === confirmSku),
    [variants, confirmSku]
  )
  const sellablePreview =
    selectedVariantForConfirm != null
      ? Math.max(0, selectedVariantForConfirm.onHand - selectedVariantForConfirm.reserved)
      : null

  const copyStockReport = async () => {
    if (!stockConfirmReport) return
    try {
      await navigator.clipboard.writeText(stockConfirmReport)
      setCopiedReport(true)
      setTimeout(() => setCopiedReport(false), 2000)
    } catch {
      setCopiedReport(false)
    }
  }

  const enriched = React.useMemo((): EnrichedRow[] =>
    variants.map((v) => ({
      ...stockHealthRow(v),
      weeksCover: v.weeksCover,
      trendScore: v.trendScore,
      salesQty90d: v.salesQty90d,
      inbound: v.inbound,
    })),
  [variants])

  const kpis = React.useMemo(() => {
    let stockout = 0,
      attention = 0,
      healthy = 0,
      overstock = 0
    for (const r of enriched) {
      if (r.segment === "stockout_risk") stockout++
      if (matchesFilter(r.segment, "attention")) attention++
      if (r.segment === "ok" || r.segment === "fast") healthy++
      if (r.segment === "overstock") overstock++
    }
    return { stockout, attention, healthy, overstock }
  }, [enriched])

  const rows = React.useMemo(() => {
    const q = query.trim().toLowerCase()
    let list = enriched.filter((r) => {
      if (!matchesFilter(r.segment, filter)) return false
      if (!q) return true
      return r.sku.toLowerCase().includes(q) || r.productName.toLowerCase().includes(q)
    })
    list = [...list].sort((a, b) => {
      const d = (r: EnrichedRow) => r.daysToStockout ?? 9999
      if (sort === "days_asc") return d(a) - d(b)
      if (sort === "days_desc") return d(b) - d(a)
      if (sort === "on_hand_desc") return b.onHand - a.onHand
      return b.trendScore - a.trendScore
    })
    return list
  }, [enriched, filter, query, sort])

  const csv = React.useMemo(() => {
    const h =
      "sku,product,segment,cover_wk,trend,days_left,units_wk,on_hand,inbound,sales_90d,note\n"
    return (
      h +
      rows
        .map((r) =>
          [
            r.sku,
            `"${r.productName}"`,
            r.segment,
            r.weeksCover,
            r.trendScore,
            r.daysToStockout ?? "",
            r.weeklyDemand,
            r.onHand,
            r.inbound,
            r.salesQty90d ?? "",
            `"${r.note}"`,
          ].join(",")
        )
        .join("\n")
    )
  }, [rows])

  const copyCsv = async () => {
    try {
      await navigator.clipboard.writeText(csv)
      setCopiedCsv(true)
      setTimeout(() => setCopiedCsv(false), 2000)
    } catch {
      setCopiedCsv(false)
    }
  }

  const dataIsSample = source === "demo"
  const odooUnavailable = dataIsSample && Boolean(odooError)

  return (
    <div className="space-y-3 pb-8">
      <div className="grid items-start gap-3 lg:grid-cols-12">
        <div className="lg:col-span-8">
          <h1 className="text-2xl font-semibold tracking-tight md:text-3xl">Inventory</h1>
          <p className="mt-1 text-sm leading-relaxed text-muted-foreground">
            Labels from cover and demand. Build a quick <span className="font-medium text-foreground">stock check</span>{" "}
            list, then scan the table — rows you added show a light highlight.
          </p>
        </div>
        <Panel className="flex flex-wrap items-center gap-3 border-primary/25 bg-primary/5 p-3 text-sm lg:col-span-4 lg:justify-self-end">
          <span className="inline-flex size-7 shrink-0 items-center justify-center rounded-full bg-primary text-xs font-bold text-primary-foreground">
            4
          </span>
          <span className="text-muted-foreground">Next:</span>
          <Link
            href="/workflow"
            className="font-semibold text-primary underline-offset-4 hover:underline"
          >
            PO→SO Flow →
          </Link>
        </Panel>
      </div>

      {/* Row: data | snapshot | stock confirmation (matches prediction 3-card row) */}
      <div className="grid items-stretch gap-3 lg:grid-cols-12">
        <Panel className="space-y-3 overflow-y-auto border-border/60 bg-card/95 p-3 shadow-sm lg:col-span-3 lg:h-[360px]">
          {odooUnavailable ? (
            <div
              className="flex gap-3 rounded-xl border border-amber-500/30 bg-amber-500/8 p-3 text-sm dark:border-amber-500/25 dark:bg-amber-500/10"
              role="status"
            >
              <RiInformationLine
                className="mt-0.5 size-5 shrink-0 text-amber-600 dark:text-amber-400"
                aria-hidden
              />
              <div className="min-w-0">
                <p className="font-medium">Live catalog unavailable</p>
                <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
                  Sample inventory is in use.{" "}
                  <span className="font-mono text-[11px]">{odooError}</span>
                </p>
              </div>
            </div>
          ) : null}
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
            <span className="text-muted-foreground">
              {odooLoading ? "Syncing…" : `${variants.length} SKUs`}
            </span>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button type="button" variant="outline" size="sm" onClick={() => refetchOdoo()}>
              Refresh data
            </Button>
            <Button type="button" variant="secondary" size="sm" onClick={() => void copyCsv()}>
              {copiedCsv ? "Copied" : "Copy CSV"}
            </Button>
          </div>
          <div className="space-y-1 border-t border-border/50 pt-3">
            <label className="text-xs text-muted-foreground" htmlFor="sh-cost">
              Unit cost guess (₹)
            </label>
            <Input
              id="sh-cost"
              type="number"
              min={1}
              className="h-9 w-full max-w-32"
              value={unitCost}
              onChange={(e) => setUnitCost(Number(e.target.value) || 500)}
            />
          </div>
        </Panel>

        <Panel className="flex flex-col overflow-hidden border-border/60 bg-card/95 p-0 shadow-sm lg:col-span-5 lg:h-[360px]">
          <div className="shrink-0 border-b border-border/50 bg-muted/25 px-3 py-2">
            <h2 className="text-sm font-semibold">Portfolio snapshot</h2>
            <p className="text-[11px] text-muted-foreground">Counts by health segment</p>
          </div>
          <div className="flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto p-3">
            <div className="grid grid-cols-2 gap-2">
              {(
                [
                  ["Running low", kpis.stockout, "text-red-600 dark:text-red-400"],
                  ["Review", kpis.attention, ""],
                  ["Doing fine", kpis.healthy, "text-emerald-600 dark:text-emerald-400"],
                  ["Overstock", kpis.overstock, "text-amber-700 dark:text-amber-300"],
                ] as const
              ).map(([label, n, color]) => (
                <div
                  key={label}
                  className="rounded-lg border border-border/60 bg-muted/15 p-3 shadow-sm"
                >
                  <p className="text-[11px] text-muted-foreground">{label}</p>
                  <p className={cn("text-xl font-semibold tabular-nums", color)}>{n}</p>
                </div>
              ))}
            </div>
            <p className="text-xs leading-relaxed text-muted-foreground">{deadStockValueHint(variants, unitCost)}</p>
          </div>
        </Panel>

        <Panel className="flex flex-col overflow-hidden border-border/60 bg-card/95 p-0 shadow-sm lg:col-span-4 lg:h-[360px]">
          <div className="shrink-0 border-b border-border/50 bg-muted/25 px-3 py-2">
            <h2 className="text-sm font-semibold">Stock check</h2>
            <p className="text-[11px] leading-snug text-muted-foreground">
              Sellable = on hand minus reserved. Add lines here or tap{" "}
              <span className="font-medium text-foreground">Add</span> in the table.
            </p>
          </div>
          <div className="flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto p-3">
          {variants.length === 0 ? (
            <p className="text-sm text-muted-foreground">No catalog.</p>
          ) : (
            <>
              <div className="space-y-2">
                <div className="space-y-1">
                  <label className="text-xs text-muted-foreground" htmlFor="sh-confirm-sku">
                    SKU
                  </label>
                  <select
                    id="sh-confirm-sku"
                    className="h-9 w-full rounded-lg border border-input bg-background px-2 text-sm shadow-sm"
                    value={confirmSku}
                    onChange={(e) => setConfirmSku(e.target.value)}
                  >
                    {variants.map((v) => (
                      <option key={v.id} value={v.sku}>
                        {v.sku} — {v.productName.length > 42 ? `${v.productName.slice(0, 40)}…` : v.productName}
                      </option>
                    ))}
                  </select>
                  {sellablePreview != null ? (
                    <p className="text-[11px] text-muted-foreground">
                      Sellable{" "}
                      <span className="font-semibold tabular-nums text-foreground">{sellablePreview}</span>
                      {selectedVariantForConfirm ? (
                        <span className="text-muted-foreground/80">
                          {" "}
                          (on hand {selectedVariantForConfirm.onHand}, reserved{" "}
                          {selectedVariantForConfirm.reserved})
                        </span>
                      ) : null}
                    </p>
                  ) : null}
                </div>
                <div className="flex flex-wrap items-end gap-2">
                  <div className="space-y-1">
                    <label className="text-xs text-muted-foreground" htmlFor="sh-confirm-qty">
                      Qty to add
                    </label>
                    <Input
                      id="sh-confirm-qty"
                      type="number"
                      min={1}
                      className="h-9 w-20 shadow-sm"
                      value={confirmQty}
                      onChange={(e) => setConfirmQty(Number(e.target.value) || 1)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") {
                          e.preventDefault()
                          addConfirmLine()
                        }
                      }}
                    />
                  </div>
                  <Button type="button" size="sm" className="shrink-0" onClick={addConfirmLine}>
                    Add to check
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="shrink-0"
                    disabled={!confirmLines.length}
                    onClick={() => setConfirmLines([])}
                  >
                    Clear list
                  </Button>
                </div>
              </div>
              {confirmLines.length > 0 && stockConfirmResults ? (
                <div className="min-h-0 flex-1 space-y-2">
                  {confirmAllOk != null ? (
                    <div
                      className={cn(
                        "rounded-md border px-2.5 py-2 text-xs font-medium",
                        confirmAllOk
                          ? "border-emerald-500/30 bg-emerald-500/8 text-emerald-900 dark:text-emerald-100"
                          : "border-amber-500/25 bg-amber-500/8 text-amber-950 dark:text-amber-50"
                      )}
                    >
                      {confirmAllOk
                        ? "All requested qty is covered by sellable stock."
                        : "One or more lines are short — see Sellable vs Need below."}
                    </div>
                  ) : null}
                  <div className="max-h-[min(180px,32vh)] overflow-auto rounded-lg border border-border/60 shadow-sm">
                    <table className="w-full table-fixed border-collapse text-xs">
                      <colgroup>
                        <col className="w-[36%]" />
                        <col className="w-[18%]" />
                        <col className="w-[18%]" />
                        <col className="w-[16%]" />
                        <col className="w-[12%]" />
                      </colgroup>
                      <thead>
                        <tr className="border-b border-border/50 bg-muted/40 text-left text-muted-foreground">
                          <th className="px-2 py-1.5 font-medium">SKU</th>
                          <th className="px-2 py-1.5 text-right font-medium" title="Total qty you asked to check">
                            Need
                          </th>
                          <th className="px-2 py-1.5 text-right font-medium" title="Sellable now">
                            Sell
                          </th>
                          <th className="px-2 py-1.5 text-right font-medium">Status</th>
                          <th className="px-1 py-1.5 text-right font-medium">
                            <span className="sr-only">Remove</span>
                          </th>
                        </tr>
                      </thead>
                      <tbody>
                        {stockConfirmResults.map((r) => (
                          <tr key={r.sku} className="border-b border-border/40 last:border-0">
                            <td
                              className="px-2 py-1.5 font-mono text-[11px] leading-tight text-foreground"
                              title={r.sku}
                            >
                              <span className="block truncate">{r.sku}</span>
                            </td>
                            <td className="px-2 py-1.5 text-right tabular-nums">{r.requested}</td>
                            <td className="px-2 py-1.5 text-right tabular-nums">{r.available}</td>
                            <td className="px-2 py-1.5 text-right tabular-nums">
                              {r.ok ? (
                                <span className="font-medium text-emerald-600 dark:text-emerald-400">OK</span>
                              ) : (
                                <span className="font-medium text-rose-600 dark:text-rose-400">
                                  short {r.requested - r.available}
                                </span>
                              )}
                            </td>
                            <td className="px-1 py-1 text-right align-middle">
                              <Button
                                type="button"
                                variant="outline"
                                size="icon-sm"
                                className="size-7 shrink-0 border-border/60 text-muted-foreground hover:border-destructive/40 hover:text-destructive"
                                aria-label={`Remove ${r.sku} from check`}
                                onClick={() => removeConfirmLine(r.sku)}
                              >
                                <RiCloseLine className="size-3.5" aria-hidden />
                              </Button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  <p className="text-[10px] leading-snug text-muted-foreground">
                    Need is the running total for that SKU (each Add stacks). It can differ from &quot;Qty to add&quot;
                    above.
                  </p>
                  <Button
                    type="button"
                    variant="secondary"
                    size="sm"
                    className="w-full"
                    onClick={() => void copyStockReport()}
                  >
                    {copiedReport ? "Copied" : "Copy text report"}
                  </Button>
                </div>
              ) : (
                <p className="rounded-md border border-dashed border-border/60 bg-muted/20 px-3 py-3 text-center text-xs text-muted-foreground">
                  Add SKUs to verify against sellable stock.
                </p>
              )}
            </>
          )}
          </div>
        </Panel>
      </div>

      {/* Filters + table (single panel) */}
      <Panel className="space-y-3 border-border/60 bg-card/95 p-0 shadow-sm">
        <div className="border-b border-border/50 bg-muted/25 px-3 py-2.5">
          <h2 className="text-sm font-semibold">All SKUs</h2>
          <p className="text-[11px] text-muted-foreground">Filter, sort, search — add rows to the stock check above</p>
        </div>
        <div className="space-y-3 p-3">
        <div className="flex flex-col gap-3 lg:flex-row lg:flex-wrap lg:items-center lg:justify-between">
          <div className="flex flex-wrap gap-1.5">
            {(
              [
                ["all", "All"],
                ["attention", "Review"],
                ["stockout", "Low"],
                ["slow_dead", "Slow"],
                ["overstock", "Heavy"],
                ["healthy", "Fine"],
              ] as const
            ).map(([key, label]) => (
              <button
                key={key}
                type="button"
                onClick={() => setFilter(key)}
                className={cn(
                  "rounded-full px-3 py-1 text-xs font-medium transition-colors",
                  filter === key
                    ? "bg-primary text-primary-foreground shadow-sm"
                    : "bg-muted text-muted-foreground hover:bg-muted/80 hover:text-foreground"
                )}
              >
                {label}
              </button>
            ))}
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <select
              className="h-9 rounded-lg border border-input bg-background px-2 text-sm shadow-sm"
              value={sort}
              onChange={(e) => setSort(e.target.value as SortMode)}
            >
              <option value="days_asc">Days left ↑</option>
              <option value="days_desc">Days left ↓</option>
              <option value="on_hand_desc">On hand</option>
              <option value="trend_desc">Trend</option>
            </select>
            <Input
              placeholder="Search SKU or product…"
              className="h-9 max-w-xs shadow-sm"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
          </div>
        </div>
        <p className="text-xs text-muted-foreground">
          {rows.length} of {enriched.length} SKUs
        </p>

        <div className="max-h-[min(560px,55vh)] overflow-auto rounded-lg border border-border/60">
          <table className="w-full min-w-[920px] text-sm">
            <thead className="sticky top-0 z-1 border-b border-border/60 bg-muted/90 backdrop-blur-sm">
              <tr className="text-left text-xs font-semibold uppercase text-muted-foreground">
                <th className="px-3 py-2" title="Stock keeping unit">
                  SKU
                </th>
                <th className="px-3 py-2">Product</th>
                <th className="px-3 py-2">Label</th>
                <th className="px-3 py-2 text-right" title="Weeks of cover">
                  Cover
                </th>
                <th className="px-3 py-2 text-right">Trend</th>
                <th className="px-3 py-2 text-right" title="Estimated days of stock left">
                  Days
                </th>
                <th className="px-3 py-2 text-right" title="Units per week">
                  u/wk
                </th>
                <th className="px-3 py-2 text-right" title="On hand">
                  OH
                </th>
                <th className="px-3 py-2 text-right" title="Inbound">
                  In
                </th>
                <th className="px-3 py-2 text-right" title="Sales last 90 days">
                  90d
                </th>
                <th className="px-3 py-2 text-center" title="Add to stock check">
                  +
                </th>
                <th className="px-3 py-2">Note</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/50">
              {rows.length === 0 ? (
                <tr>
                  <td colSpan={12} className="px-3 py-8 text-center text-sm text-muted-foreground">
                    Nothing matches — try All or clear search.
                  </td>
                </tr>
              ) : (
                rows.map((r) => (
                  <tr
                    key={r.sku}
                    className={cn(
                      "transition-colors hover:bg-muted/20",
                      rowTone(r.segment),
                      confirmSkuSet.has(r.sku) &&
                        "bg-primary/5 ring-1 ring-inset ring-primary/15"
                    )}
                  >
                    <td className="px-3 py-2 font-mono text-xs">{r.sku}</td>
                    <td className="max-w-[160px] truncate px-3 py-2" title={r.productName}>
                      {r.productName}
                    </td>
                    <td className="px-3 py-2">
                      <span
                        className={cn(
                          "inline-flex rounded-full px-2 py-0.5 text-xs font-medium",
                          BADGE_CLASS[r.segment]
                        )}
                      >
                        {LABELS[r.segment]}
                      </span>
                    </td>
                    <td className="px-3 py-2 text-right tabular-nums">{r.weeksCover.toFixed(1)}</td>
                    <td className="px-3 py-2 text-right tabular-nums">{r.trendScore}</td>
                    <td className="px-3 py-2 text-right tabular-nums">{r.daysToStockout ?? "—"}</td>
                    <td className="px-3 py-2 text-right tabular-nums">{r.weeklyDemand}</td>
                    <td className="px-3 py-2 text-right tabular-nums">{r.onHand}</td>
                    <td className="px-3 py-2 text-right tabular-nums">{r.inbound}</td>
                    <td className="px-3 py-2 text-right tabular-nums">{r.salesQty90d ?? "—"}</td>
                    <td className="px-1 py-1 text-center">
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="h-8 w-8 p-0"
                        title={`Add ${r.sku} × ${confirmQty} to stock check`}
                        aria-label={`Add ${r.sku} to stock check`}
                        onClick={() => addConfirmLineForSku(r.sku)}
                      >
                        <RiAddLine className="size-4" aria-hidden />
                      </Button>
                    </td>
                    <td className="max-w-[180px] truncate px-3 py-2 text-xs text-muted-foreground">{r.note}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
        </div>
      </Panel>
    </div>
  )
}
