"use client"

import * as React from "react"
import Link from "next/link"
import { RiInformationLine, RiPriceTag3Line } from "@remixicon/react"

import { Panel } from "@/components/panel"
import { Button } from "@/components/ui/button"
import { useVariantsWithOdoo } from "@/hooks/use-variants-with-odoo"
import { useWorkflowState } from "@/hooks/use-workflow-state"
import { computeRspAnalysis, pricingPowerHint, type RspInput } from "@/lib/intelligence"
import { resolveVariantImageUrl } from "@/lib/variant-image"
import { cn } from "@/lib/utils"

function clamp(n: number, min: number, max: number) {
  return Math.min(max, Math.max(min, n))
}

function inferredRspInput(v: {
  trendScore: number
  weeksCover: number
  onHand: number
  salesQty90d?: number
}): RspInput {
  const trend = v.trendScore
  const demandWeek = Math.max(1, Math.round((v.salesQty90d ?? v.onHand * 0.65) / 13))

  const landedCost = Math.max(
    90,
    Math.round(
      demandWeek * 8.4 +
        trend * 4.6 +
        (v.weeksCover < 2 ? 42 : 0) -
        (v.weeksCover > 9 ? 24 : 0)
    )
  )

  const competitorPrice = Math.round(
    landedCost * (1.42 + (trend - 50) * 0.0025 + (v.weeksCover < 2.2 ? 0.03 : 0))
  )

  const targetMarginPct = clamp(Math.round(27 + (trend - 50) * 0.12), 18, 44)
  const scenarioSlider = clamp(Math.round(52 + (trend - 50) * 0.35 - (v.weeksCover - 4) * 3.5), 20, 80)

  return {
    landedCost,
    competitorPrice,
    demandScore: trend,
    targetMarginPct,
    scenarioSlider,
  }
}

export function PricingWorkspace() {
  const { variants, source, odooLoading, odooError, refetchOdoo } = useVariantsWithOdoo()
  const { state, approveRsp, revokeRsp } = useWorkflowState()
  const [sku, setSku] = React.useState("")
  const [copied, setCopied] = React.useState(false)

  React.useEffect(() => {
    if (variants.length && !sku) setSku(variants[0].sku)
  }, [variants, sku])

  const v = variants.find((x) => x.sku === sku) ?? variants[0]
  const input = React.useMemo(() => (v ? inferredRspInput(v) : null), [v])
  const analysis = React.useMemo(() => (input ? computeRspAnalysis(input) : null), [input])
  const approvedForSku = v ? state.rspBySku[v.sku] : undefined

  const copySuggested = async () => {
    if (!analysis) return
    try {
      await navigator.clipboard.writeText(String(analysis.suggested))
      setCopied(true)
      setTimeout(() => setCopied(false), 1600)
    } catch {
      setCopied(false)
    }
  }

  const dataIsSample = source === "demo"
  const odooUnavailable = dataIsSample && Boolean(odooError)

  return (
    <div className="space-y-3 pb-8">
      <div className="grid items-start gap-3 lg:grid-cols-12">
        <div className="lg:col-span-8">
          <h1 className="text-2xl font-semibold tracking-tight md:text-3xl">RSP Generator</h1>
          <p className="mt-1 text-sm leading-relaxed text-muted-foreground">
            1) Pick product  2) Review computed price  3) Approve and continue to ordering.
          </p>
        </div>
        <Panel className="flex flex-wrap items-center gap-3 border-primary/25 bg-primary/5 p-3 text-sm lg:col-span-4 lg:justify-self-end">
          <span className="inline-flex size-7 shrink-0 items-center justify-center rounded-full bg-primary text-xs font-bold text-primary-foreground">
            2
          </span>
          <span className="text-muted-foreground">Next:</span>
          <Link href="/purchase" className="font-semibold text-primary underline-offset-4 hover:underline">
            Retailer order creation →
          </Link>
        </Panel>
      </div>

      <div className="grid items-stretch gap-3 lg:grid-cols-12">
        <Panel className="space-y-3 overflow-y-auto border-border/60 bg-card/95 p-3 lg:col-span-3 lg:h-[360px]">
          {odooUnavailable ? (
            <div className="flex gap-3 rounded-xl border border-amber-500/30 bg-amber-500/8 p-3 text-sm text-amber-950 dark:border-amber-500/25 dark:bg-amber-500/10 dark:text-amber-50/95">
              <RiInformationLine className="mt-0.5 size-5 shrink-0 text-amber-600 dark:text-amber-400" aria-hidden />
              <div className="min-w-0">
                <p className="font-medium">Live catalog unavailable</p>
                <p className="mt-1 text-xs leading-relaxed opacity-90">
                  Using sample inventory. RSP still works with inferred market anchors.
                </p>
              </div>
            </div>
          ) : null}
          <div className="flex flex-wrap items-center justify-between gap-2 text-sm">
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
            <span className="text-xs text-muted-foreground">{variants.length} products</span>
          </div>
          <Button type="button" variant="outline" size="sm" className="w-fit" onClick={() => refetchOdoo()}>
            Refresh data
          </Button>
          {v ? (
            <div className="rounded-xl border border-border/60 bg-muted/20 p-3 shadow-sm">
              <p className="text-xs font-medium text-muted-foreground">Selected product</p>
              <div className="mt-2 flex items-start gap-2">
                <img
                  src={resolveVariantImageUrl({ sku: v.sku, id: v.id, imageUrl: v.imageUrl })}
                  alt=""
                  className="size-10 shrink-0 rounded-md object-cover"
                  loading="lazy"
                />
                <div className="min-w-0">
                  <p className="line-clamp-2 text-sm font-medium leading-snug">{v.productName}</p>
                  <p className="mt-0.5 font-mono text-xs text-muted-foreground">{v.sku}</p>
                </div>
              </div>
              <p className="mt-2 text-[11px] text-muted-foreground">{pricingPowerHint(v)}</p>
            </div>
          ) : null}
        </Panel>

        <Panel className="space-y-3 border-border/60 bg-card/95 p-3 lg:col-span-4 lg:h-[360px]">
          <h2 className="text-sm font-semibold">Step 1: Select product</h2>
          <select
            className="h-10 w-full rounded-lg border border-input bg-background px-3 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            value={sku}
            onChange={(e) => setSku(e.target.value)}
          >
            {variants.map((x) => (
              <option key={x.id} value={x.sku}>
                {x.sku} — {x.productName}
              </option>
            ))}
          </select>

          {input ? (
            <div className="grid grid-cols-2 gap-2">
              <div className="rounded-lg border border-border/60 bg-card px-3 py-2.5 shadow-sm">
                <p className="text-[11px] text-muted-foreground">Estimated landed cost</p>
                <p className="mt-1 text-xl font-semibold tabular-nums">₹{input.landedCost.toLocaleString("en-IN")}</p>
              </div>
              <div className="rounded-lg border border-border/60 bg-card px-3 py-2.5 shadow-sm">
                <p className="text-[11px] text-muted-foreground">Market reference price</p>
                <p className="mt-1 text-xl font-semibold tabular-nums">₹{input.competitorPrice.toLocaleString("en-IN")}</p>
              </div>
              <div className="rounded-lg border border-border/60 bg-card px-3 py-2.5 shadow-sm">
                <p className="text-[11px] text-muted-foreground">Target margin</p>
                <p className="mt-1 text-xl font-semibold tabular-nums">{input.targetMarginPct}%</p>
              </div>
              <div className="rounded-lg border border-border/60 bg-card px-3 py-2.5 shadow-sm">
                <p className="text-[11px] text-muted-foreground">Pricing strategy</p>
                <p className="mt-1 text-xl font-semibold tabular-nums">
                  {input.scenarioSlider < 40 ? "Volume" : input.scenarioSlider > 63 ? "Margin" : "Balanced"}
                </p>
              </div>
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">No products.</p>
          )}
        </Panel>

        <Panel className="relative overflow-hidden border-primary/20 bg-linear-to-br from-primary/15 via-background to-chart-3/15 p-4 lg:col-span-5 lg:h-[360px]">
          <div className="pointer-events-none absolute -right-16 -top-16 size-44 rounded-full bg-primary/10 blur-3xl" />
          <p className="text-xs font-medium text-muted-foreground">Step 2: Final in-house RSP</p>
          {analysis ? (
            <>
              <div className="mt-2 flex items-end justify-between gap-3">
                <p className="text-4xl font-bold tracking-tight tabular-nums lg:text-5xl">
                  ₹{analysis.suggested.toLocaleString("en-IN")}
                </p>
                <div className="text-right text-xs">
                  <p className="text-muted-foreground">Margin</p>
                  <p className="font-semibold tabular-nums">{analysis.suggestedMarginPct}%</p>
                </div>
              </div>
              <div className="mt-3 flex flex-wrap gap-2 text-xs">
                <span className="rounded-md bg-background/90 px-2 py-1 shadow-sm ring-1 ring-border/60">
                  Profit ₹{analysis.profitPerUnit}/unit
                </span>
                {analysis.vsCompetitorPct != null ? (
                  <span className="rounded-md bg-background/90 px-2 py-1 shadow-sm ring-1 ring-border/60">
                    vs market ref {analysis.vsCompetitorPct > 0 ? "+" : ""}
                    {analysis.vsCompetitorPct}%
                  </span>
                ) : null}
                <span className="rounded-md bg-background/90 px-2 py-1 shadow-sm ring-1 ring-border/60">
                  Demand x{analysis.demandMultiplier.toFixed(2)}
                </span>
              </div>
              <div className="mt-4 flex flex-wrap gap-2">
                <Button type="button" variant="secondary" size="sm" onClick={copySuggested}>
                  {copied ? "Copied" : "Copy ₹"}
                </Button>
                {v ? (
                  <Button
                    type="button"
                    size="sm"
                    onClick={() =>
                      approveRsp(v, analysis.suggested, {
                        landedCost: input?.landedCost ?? 0,
                        competitorPrice: input?.competitorPrice ?? 0,
                      })
                    }
                  >
                    Step 3: Approve RSP
                  </Button>
                ) : null}
                {v && approvedForSku ? (
                  <Button type="button" variant="outline" size="sm" onClick={() => revokeRsp(v.sku)}>
                    Revoke
                  </Button>
                ) : null}
              </div>
            </>
          ) : (
            <p className="mt-2 text-sm text-muted-foreground">No price yet.</p>
          )}
        </Panel>
      </div>

      {analysis ? (
        <div className="grid gap-3 lg:grid-cols-12">
          <Panel className="space-y-3 border-border/60 p-4 lg:col-span-8">
            <h2 className="text-sm font-semibold">How this price was calculated</h2>
            <div className="grid gap-2 sm:grid-cols-2">
              {analysis.steps.map((step, i) => (
                <div key={step.id} className="rounded-lg border border-border/60 bg-card p-3 shadow-sm">
                  <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                    Step {i + 1}
                  </p>
                  <p className="mt-1 text-sm font-medium">{step.title}</p>
                  <p className="mt-1 text-xs leading-relaxed text-muted-foreground">{step.detail}</p>
                  {step.amountInr != null ? (
                    <p className="mt-2 text-xs font-semibold tabular-nums text-primary">
                      Result: ₹{step.amountInr.toLocaleString("en-IN")}
                    </p>
                  ) : null}
                </div>
              ))}
            </div>
          </Panel>

          <Panel className="space-y-3 border-border/60 p-4 lg:col-span-4">
            <h2 className="text-sm font-semibold">Quick range check</h2>
            <div className="space-y-2 text-sm">
              <div className="flex items-center justify-between rounded-md border border-border/60 bg-muted/20 px-3 py-2 shadow-sm">
                <span>Fast movement</span>
                <span className="font-semibold tabular-nums">₹{analysis.lowPrice}</span>
              </div>
              <div className="flex items-center justify-between rounded-md border border-primary/40 bg-primary/10 px-3 py-2 shadow-sm">
                <span className="font-medium">Final RSP</span>
                <span className="font-bold tabular-nums">₹{analysis.suggested}</span>
              </div>
              <div className="flex items-center justify-between rounded-md border border-border/60 bg-muted/20 px-3 py-2 shadow-sm">
                <span>Margin-max</span>
                <span className="font-semibold tabular-nums">₹{analysis.highPrice}</span>
              </div>
            </div>
            <p className="text-xs text-muted-foreground">
              Final RSP is cost-based, checked against market reference, then adjusted by demand trend.
            </p>
          </Panel>
        </div>
      ) : null}

      {approvedForSku ? (
        <Panel className="flex flex-wrap items-center justify-between gap-3 border-emerald-500/20 bg-emerald-500/5 p-4">
          <div>
            <p className="text-sm font-medium">RSP approved — ready for order?</p>
            <p className="text-xs text-muted-foreground">
              Move to retailer order creation with this approved price context.
            </p>
          </div>
          <Button type="button" size="sm" asChild>
            <Link href="/purchase">Create retailer order →</Link>
          </Button>
        </Panel>
      ) : null}

      <Panel className="border-primary/20 bg-primary/5 p-4">
        <p className="text-sm text-muted-foreground">
          <span className="mr-2 inline-flex size-5 items-center justify-center rounded-full bg-primary text-[10px] font-bold text-primary-foreground">
            3
          </span>
          After RSP approval, continue to{" "}
          <Link href="/purchase" className="font-medium text-primary hover:underline">
            Retailer order creation
          </Link>
          .
        </p>
      </Panel>
    </div>
  )
}