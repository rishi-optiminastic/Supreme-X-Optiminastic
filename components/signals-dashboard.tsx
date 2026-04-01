"use client"

import * as React from "react"
import {
  RiArrowRightLine,
  RiCloseLine,
  RiFlashlightLine,
  RiLineChartLine,
  RiLoader4Line,
  RiRefreshLine,
  RiShoppingBag3Line,
} from "@remixicon/react"

import { useAppData } from "@/components/app-data-context"
import { DataSourceBanner } from "@/components/data-source-banner"
import { PageHeader } from "@/components/page-header"
import { SurfaceCard } from "@/components/surface-card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { useAiInsight } from "@/hooks/use-ai-insight"
import { useVariantsWithOdoo } from "@/hooks/use-variants-with-odoo"

function hashProduct(name: string) {
  let h = 0
  for (let i = 0; i < name.length; i++)
    h = (Math.imul(31, h) + name.charCodeAt(i)) | 0
  return Math.abs(h)
}

export function SignalsDashboard() {
  const {
    purchaseSignals,
    trendSources,
    createManualSignal,
    generateSignalsFromInventory,
    sendSignalToTrends,
    dismissSignal,
  } = useAppData()

  const {
    variants,
    source,
    odooLoading,
    odooError,
    refetchOdoo,
  } = useVariantsWithOdoo()
  const insight = useAiInsight()

  const products = React.useMemo(() => {
    const set = new Set(variants.map((v) => v.productName))
    return [...set].sort()
  }, [variants])

  const [selectedProduct, setSelectedProduct] = React.useState(
    () => products[0] ?? ""
  )

  React.useEffect(() => {
    if (products.length && !products.includes(selectedProduct)) {
      setSelectedProduct(products[0]!)
    }
  }, [products, selectedProduct])

  const [marketNoise, setMarketNoise] = React.useState(0)

  const marketForProduct = React.useMemo(() => {
    const h = hashProduct(selectedProduct || "x")
    const baseDemand = 55 + (h % 35)
    const competitor = -3 + (h % 8)
    const sentiment = h % 2 === 0 ? "Constructive" : "Neutral"
    const n = marketNoise * 0.01
    return {
      demand: Math.min(99, Math.round(baseDemand * (1 + n))),
      competitorDelta: Math.round(competitor + marketNoise * 0.05),
      sentiment,
      promoPressure: 20 + (h % 60),
    }
  }, [selectedProduct, marketNoise])

  const refreshMarket = () => setMarketNoise((n) => n + 7)

  const purchaseTotal = purchaseSignals.filter((s) => !s.sentToTrends).length
  const salesVelocity = React.useMemo(() => {
    const sold = variants.reduce((a, v) => a + v.reserved, 0)
    const avail = variants.reduce((a, v) => a + v.onHand, 0)
    return { sold, avail }
  }, [variants])

  const [sku, setSku] = React.useState("")
  const [productName, setProductName] = React.useState("")
  const [variantLabel, setVariantLabel] = React.useState("")
  const [urgency, setUrgency] = React.useState<"low" | "medium" | "high">(
    "medium"
  )
  const [qty, setQty] = React.useState(48)
  const [reason, setReason] = React.useState("")

  const [genMsg, setGenMsg] = React.useState<string | null>(null)

  const onGenerate = () => {
    const n = generateSignalsFromInventory(variants)
    setGenMsg(
      n === 0
        ? "No new signals — low-cover variants already have open signals."
        : `Created ${n} signal(s) from inventory.`
    )
    window.setTimeout(() => setGenMsg(null), 4000)
  }

  const onAiSignals = () => {
    const low = variants.filter((v) => v.weeksCover < 1.5).length
    void insight.run("signals", {
      dataSource: source,
      variantCount: variants.length,
      lowCoverCount: low,
      totalOnHand: variants.reduce((a, v) => a + v.onHand, 0),
      openSignals: purchaseSignals.filter((s) => !s.sentToTrends).length,
      trendSourceCount: trendSources.filter((s) => s.enabled).length,
      sampleSkus: variants.slice(0, 16).map((v) => v.sku),
    })
  }

  const onApplyHints = () => {
    const hints = insight.data?.purchaseHints ?? []
    for (const h of hints) {
      const sku = h.sku?.trim()
      if (!sku || sku.toUpperCase() === "UNKNOWN") continue
      const v = variants.find((x) => x.sku === sku)
      const urgency: "low" | "medium" | "high" =
        h.urgency === "high" || h.urgency === "low" ? h.urgency : "medium"
      createManualSignal({
        sku,
        variantLabel: v?.attributes ?? "—",
        productName: v?.productName ?? "Product",
        urgency,
        qty: Math.max(16, v ? Math.round(72 - v.onHand * 0.3) : 48),
        reason: h.reason?.trim() || "AI suggestion (signals)",
      })
    }
  }

  const onCreateManual = () => {
    createManualSignal({
      sku,
      variantLabel,
      productName: productName || selectedProduct || "Custom",
      urgency,
      qty,
      reason,
    })
    setSku("")
    setVariantLabel("")
    setReason("")
  }

  return (
    <div className="flex flex-1 flex-col gap-5 px-4 py-5 pb-10 md:gap-6 md:px-6 md:py-6">
      <PageHeader
        title="Purchase &amp; sales signals"
        description="Market read per product, purchase signal queue, and one-click push into the trend activity feed. State persists in your browser."
      />

      <DataSourceBanner
        source={source}
        loading={odooLoading}
        error={odooError}
        onRefresh={refetchOdoo}
      />

      <div className="flex flex-wrap gap-2">
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="gap-2"
          disabled={insight.loading}
          onClick={onAiSignals}
        >
          {insight.loading ? (
            <RiLoader4Line className="size-4 animate-spin" aria-hidden />
          ) : (
            <RiFlashlightLine className="size-4" aria-hidden />
          )}
          AI signal suggestions
        </Button>
      </div>

      {(insight.data?.summary || insight.data?.error) && (
        <SurfaceCard className="border-primary/15 p-4 ring-1 ring-primary/10">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <h3 className="text-sm font-semibold">OpenRouter insight</h3>
            {insight.data.purchaseHints && insight.data.purchaseHints.length > 0 && (
              <Button type="button" size="sm" variant="secondary" onClick={onApplyHints}>
                Apply hints to queue
              </Button>
            )}
          </div>
          {insight.data.error ? (
            <p className="mt-2 text-sm text-destructive">{insight.data.error}</p>
          ) : (
            <>
              <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                {insight.data.summary}
              </p>
              {insight.data.bullets && insight.data.bullets.length > 0 && (
                <ul className="mt-3 list-inside list-disc text-sm text-foreground">
                  {insight.data.bullets.map((b, i) => (
                    <li key={i}>{b}</li>
                  ))}
                </ul>
              )}
              {insight.data.parseWarning && (
                <p className="mt-2 text-xs text-amber-700 dark:text-amber-300">
                  {insight.data.parseWarning}
                </p>
              )}
            </>
          )}
        </SurfaceCard>
      )}

      <div className="grid gap-4 md:grid-cols-3">
        <SurfaceCard className="p-4">
          <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            <RiShoppingBag3Line className="size-3.5" aria-hidden />
            Open purchase signals
          </div>
          <p className="mt-2 text-3xl font-semibold tabular-nums">
            {purchaseTotal}
          </p>
          <p className="mt-1 text-xs text-muted-foreground">
            Awaiting PO or dismiss
          </p>
        </SurfaceCard>
        <SurfaceCard className="p-4">
          <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            <RiLineChartLine className="size-3.5" aria-hidden />
            Allocated (sales pull)
          </div>
          <p className="mt-2 text-3xl font-semibold tabular-nums">
            {salesVelocity.sold.toLocaleString()}
          </p>
          <p className="mt-1 text-xs text-muted-foreground">
            Reserved units across variants
          </p>
        </SurfaceCard>
        <SurfaceCard className="p-4">
          <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Available to promise
          </div>
          <p className="mt-2 text-3xl font-semibold tabular-nums">
            {salesVelocity.avail.toLocaleString()}
          </p>
          <p className="mt-1 text-xs text-muted-foreground">
            On-hand aggregate
          </p>
        </SurfaceCard>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <SurfaceCard className="p-0 overflow-hidden">
          <div className="flex flex-col gap-3 border-b border-border/60 bg-muted/20 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h2 className="text-base font-semibold tracking-tight">
                Market analysis (product)
              </h2>
              <p className="mt-1 text-xs text-muted-foreground">
                Synthetic indices per product family — refresh to simulate new
                crawl.
              </p>
            </div>
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="gap-1.5 shrink-0"
              onClick={refreshMarket}
            >
              <RiRefreshLine className="size-3.5" aria-hidden />
              Refresh
            </Button>
          </div>
          <div className="space-y-4 p-4">
            <div className="flex flex-wrap gap-2">
              {products.map((p) => (
                <Button
                  key={p}
                  type="button"
                  size="xs"
                  variant={selectedProduct === p ? "default" : "outline"}
                  onClick={() => setSelectedProduct(p)}
                >
                  {p}
                </Button>
              ))}
            </div>
            <div className="grid gap-3 rounded-xl border border-border/60 bg-muted/25 p-4 sm:grid-cols-2">
              <div>
                <p className="text-xs text-muted-foreground">Demand index</p>
                <p className="text-2xl font-semibold tabular-nums">
                  {marketForProduct.demand}
                </p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">
                  vs competitor pricing
                </p>
                <p className="text-2xl font-semibold tabular-nums">
                  {marketForProduct.competitorDelta > 0 ? "+" : ""}
                  {marketForProduct.competitorDelta}%
                </p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Sentiment</p>
                <p className="font-medium">{marketForProduct.sentiment}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Promo pressure</p>
                <p className="font-medium tabular-nums">
                  {marketForProduct.promoPressure}%
                </p>
              </div>
            </div>
            <Button
              type="button"
              variant="secondary"
              size="sm"
              className="gap-1.5"
              onClick={() => {
                const v = variants.find((x) => x.productName === selectedProduct)
                if (!v) return
                createManualSignal({
                  sku: v.sku,
                  variantLabel: v.attributes,
                  productName: v.productName,
                  urgency:
                    marketForProduct.demand > 80
                      ? "high"
                      : marketForProduct.demand > 65
                        ? "medium"
                        : "low",
                  qty: Math.max(24, 120 - v.onHand),
                  reason: `Market demand ${marketForProduct.demand} + competitor ${marketForProduct.competitorDelta}%`,
                })
              }}
            >
              Create signal from this product
            </Button>
          </div>
        </SurfaceCard>

        <SurfaceCard className="p-0 overflow-hidden">
          <div className="border-b border-border/60 bg-muted/20 px-4 py-3">
            <h2 className="text-base font-semibold tracking-tight">
              Manual purchase signal
            </h2>
            <p className="mt-1 text-xs text-muted-foreground">
              Adds to the queue; then send to Trends.
            </p>
          </div>
          <div className="space-y-3 p-4">
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1.5">
                <label className="text-xs font-semibold" htmlFor="sig-sku">
                  SKU
                </label>
                <Input
                  id="sig-sku"
                  value={sku}
                  onChange={(e) => setSku(e.target.value)}
                  placeholder="EL-442"
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-semibold" htmlFor="sig-product">
                  Product
                </label>
                <Input
                  id="sig-product"
                  value={productName}
                  onChange={(e) => setProductName(e.target.value)}
                  placeholder="Optional override"
                />
              </div>
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-semibold" htmlFor="sig-var">
                Variant
              </label>
              <Input
                id="sig-var"
                value={variantLabel}
                onChange={(e) => setVariantLabel(e.target.value)}
                placeholder="Attributes / size / color"
              />
            </div>
            <div className="flex flex-wrap gap-2">
              {(["low", "medium", "high"] as const).map((u) => (
                <Button
                  key={u}
                  type="button"
                  size="xs"
                  variant={urgency === u ? "secondary" : "outline"}
                  onClick={() => setUrgency(u)}
                >
                  {u}
                </Button>
              ))}
              <div className="flex items-center gap-2">
                <label className="text-xs text-muted-foreground" htmlFor="sig-qty">
                  Qty
                </label>
                <Input
                  id="sig-qty"
                  type="number"
                  min={1}
                  className="w-20"
                  value={qty}
                  onChange={(e) => setQty(Number(e.target.value) || 1)}
                />
              </div>
            </div>
            <Input
              placeholder="Reason / note"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
            />
            <Button
              type="button"
              onClick={onCreateManual}
              disabled={!sku.trim()}
            >
              Add signal
            </Button>
          </div>
        </SurfaceCard>
      </div>

      <SurfaceCard className="p-0 overflow-hidden">
        <div className="flex flex-col gap-3 border-b border-border/60 bg-muted/20 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="text-base font-semibold tracking-tight">
              Purchase signal queue
            </h2>
            <p className="mt-1 text-xs text-muted-foreground">
              Send to Trends posts into the activity feed on the Trends page.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button type="button" variant="secondary" size="sm" onClick={onGenerate}>
              Generate from inventory
            </Button>
          </div>
        </div>
        {genMsg && (
          <p className="border-b border-border/50 bg-primary/5 px-4 py-2 text-xs text-primary">
            {genMsg}
          </p>
        )}
        <div className="overflow-x-auto">
          <table className="w-full min-w-[640px] text-sm">
            <thead>
              <tr className="border-b border-border/60 bg-muted/25 text-left text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                <th className="px-4 py-2.5">Product / variant</th>
                <th className="px-4 py-2.5">SKU</th>
                <th className="px-4 py-2.5 text-right">Qty</th>
                <th className="px-4 py-2.5">Urgency</th>
                <th className="px-4 py-2.5">Reason</th>
                <th className="px-4 py-2.5 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/50">
              {purchaseSignals.length === 0 ? (
                <tr>
                  <td
                    colSpan={6}
                    className="px-4 py-8 text-center text-muted-foreground"
                  >
                    No signals. Flag from Inventory, generate from low cover, or
                    add manually.
                  </td>
                </tr>
              ) : (
                purchaseSignals.map((s) => (
                  <tr key={s.id} className="hover:bg-muted/25">
                    <td className="px-4 py-2.5">
                      <p className="font-medium">{s.productName}</p>
                      <p className="text-xs text-muted-foreground">
                        {s.variantLabel}
                      </p>
                    </td>
                    <td className="px-4 py-2.5 font-mono text-xs">{s.sku}</td>
                    <td className="px-4 py-2.5 text-right tabular-nums">
                      {s.qtySuggestion}
                    </td>
                    <td className="px-4 py-2.5">
                      <span
                        className={`inline-flex rounded-full px-2 py-0.5 text-xs font-semibold ${
                          s.urgency === "high"
                            ? "bg-rose-500/15 text-rose-800 dark:text-rose-300"
                            : s.urgency === "medium"
                              ? "bg-amber-500/15 text-amber-900 dark:text-amber-300"
                              : "bg-muted text-muted-foreground"
                        }`}
                      >
                        {s.urgency}
                      </span>
                    </td>
                    <td className="max-w-[200px] px-4 py-2.5 text-xs text-muted-foreground">
                      {s.reason}
                    </td>
                    <td className="px-4 py-2.5 text-right">
                      <div className="flex flex-wrap justify-end gap-1.5">
                        {s.sentToTrends ? (
                          <span className="text-xs font-medium text-emerald-600 dark:text-emerald-400">
                            In trends
                          </span>
                        ) : (
                          <Button
                            type="button"
                            size="xs"
                            className="gap-1"
                            onClick={() => sendSignalToTrends(s.id)}
                          >
                            To trends
                            <RiArrowRightLine className="size-3" aria-hidden />
                          </Button>
                        )}
                        <Button
                          type="button"
                          size="icon-xs"
                          variant="ghost"
                          className="text-muted-foreground"
                          onClick={() => dismissSignal(s.id)}
                          aria-label="Dismiss"
                        >
                          <RiCloseLine className="size-3.5" />
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </SurfaceCard>
    </div>
  )
}
