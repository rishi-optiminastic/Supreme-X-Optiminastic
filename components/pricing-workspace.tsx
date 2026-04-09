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

type CostBreakdown = {
  exFactoryCost: number
  freightCost: number
  importAndDutyCost: number
  warehousingCost: number
  companyOverheadCost: number
  marketingCost: number
  paymentAndChannelCost: number
  returnReserveCost: number
  landedCost: number
}

function toMoney(n: number) {
  return `₹${Math.round(n).toLocaleString("en-IN")}`
}

function computeCostBreakdown(v: {
  trendScore: number
  weeksCover: number
  onHand: number
  salesQty90d?: number
}, exFactoryCost: number): CostBreakdown {
  const freightPct = v.weeksCover < 2 ? 0.082 : 0.064
  const importAndDutyPct = 0.045
  const warehousingPct = 0.023 + Math.min(0.012, Math.max(0, (v.weeksCover - 4) * 0.002))
  const companyOverheadPct = 0.052
  const marketingPct = v.trendScore >= 70 ? 0.036 : v.trendScore <= 40 ? 0.028 : 0.032
  const paymentAndChannelPct = 0.018
  const returnReservePct = clamp(0.01 + (v.weeksCover > 8 ? 0.01 : 0) + (v.trendScore < 45 ? 0.007 : 0), 0.008, 0.03)

  const freightCost = exFactoryCost * freightPct
  const importAndDutyCost = exFactoryCost * importAndDutyPct
  const warehousingCost = exFactoryCost * warehousingPct
  const companyOverheadCost = exFactoryCost * companyOverheadPct
  const marketingCost = exFactoryCost * marketingPct
  const paymentAndChannelCost = exFactoryCost * paymentAndChannelPct
  const returnReserveCost = exFactoryCost * returnReservePct
  const landedCost = Math.round(
    exFactoryCost +
      freightCost +
      importAndDutyCost +
      warehousingCost +
      companyOverheadCost +
      marketingCost +
      paymentAndChannelCost +
      returnReserveCost
  )

  return {
    exFactoryCost: Math.round(exFactoryCost),
    freightCost: Math.round(freightCost),
    importAndDutyCost: Math.round(importAndDutyCost),
    warehousingCost: Math.round(warehousingCost),
    companyOverheadCost: Math.round(companyOverheadCost),
    marketingCost: Math.round(marketingCost),
    paymentAndChannelCost: Math.round(paymentAndChannelCost),
    returnReserveCost: Math.round(returnReserveCost),
    landedCost,
  }
}

type PricingGuardrail = {
  label: string
  tone: "ok" | "warn"
}

export function PricingWorkspace() {
  const { variants, source, odooLoading, odooError, refetchOdoo } = useVariantsWithOdoo()
  const { state, approveRsp, revokeRsp } = useWorkflowState()
  const [sku, setSku] = React.useState("")
  const [copied, setCopied] = React.useState(false)
  const [enteredBaseCost, setEnteredBaseCost] = React.useState("")
  const [generatedInput, setGeneratedInput] = React.useState<RspInput | null>(null)
  const [generatedBreakdown, setGeneratedBreakdown] = React.useState<CostBreakdown | null>(null)
  const [generationError, setGenerationError] = React.useState<string | null>(null)
  const [showGenerateDialog, setShowGenerateDialog] = React.useState(false)
  const [draftSku, setDraftSku] = React.useState("")
  const [draftBaseCost, setDraftBaseCost] = React.useState("")
  const [lastGeneratedAt, setLastGeneratedAt] = React.useState<string | null>(null)

  React.useEffect(() => {
    if (variants.length && !sku) setSku(variants[0].sku)
  }, [variants, sku])

  const v = variants.find((x) => x.sku === sku) ?? variants[0]
  const inferredInput = React.useMemo(() => (v ? inferredRspInput(v) : null), [v])
  const analysis = React.useMemo(
    () => (generatedInput ? computeRspAnalysis(generatedInput) : null),
    [generatedInput]
  )
  const approvedForSku = v ? state.rspBySku[v.sku] : undefined
  const breakdownTotal = generatedBreakdown?.landedCost ?? 0
  const pricingGuardrails = React.useMemo((): PricingGuardrail[] => {
    if (!analysis) return []
    const rows: PricingGuardrail[] = []
    rows.push({
      label: analysis.suggestedMarginPct >= 16 ? "Healthy margin floor" : "Margin may be too thin",
      tone: analysis.suggestedMarginPct >= 16 ? "ok" : "warn",
    })
    rows.push({
      label:
        analysis.vsCompetitorPct == null || analysis.vsCompetitorPct <= 12
          ? "Within market band"
          : "Above market reference",
      tone: analysis.vsCompetitorPct == null || analysis.vsCompetitorPct <= 12 ? "ok" : "warn",
    })
    rows.push({
      label: analysis.demandMultiplier >= 1 ? "Demand tailwind" : "Demand headwind",
      tone: analysis.demandMultiplier >= 1 ? "ok" : "warn",
    })
    return rows
  }, [analysis])

  React.useEffect(() => {
    if (!v || !inferredInput) return
    const approxBase = Math.max(1, Math.round(inferredInput.landedCost / 1.25))
    setEnteredBaseCost(String(approxBase))
    setDraftBaseCost(String(approxBase))
    setDraftSku(v.sku)
    setGeneratedInput(null)
    setGeneratedBreakdown(null)
    setGenerationError(null)
  }, [v?.sku, inferredInput?.landedCost])

  const generateRsp = React.useCallback((nextSku?: string, nextBaseCost?: string) => {
    const effectiveSku = nextSku ?? sku
    const selected = variants.find((x) => x.sku === effectiveSku) ?? variants[0]
    if (!selected) return
    const selectedInferred = inferredRspInput(selected)
    const cleaned = (nextBaseCost ?? enteredBaseCost).replace(/,/g, "").trim()
    const baseCost = Number(cleaned)
    if (!Number.isFinite(baseCost) || baseCost <= 0) {
      setGenerationError("Enter a valid base unit cost to generate RSP.")
      setGeneratedInput(null)
      setGeneratedBreakdown(null)
      return false
    }
    setSku(selected.sku)
    setEnteredBaseCost(cleaned)
    const breakdown = computeCostBreakdown(selected, baseCost)
    setGeneratedBreakdown(breakdown)
    setGeneratedInput({
      landedCost: breakdown.landedCost,
      competitorPrice: selectedInferred.competitorPrice,
      demandScore: selectedInferred.demandScore,
      targetMarginPct: selectedInferred.targetMarginPct,
      scenarioSlider: selectedInferred.scenarioSlider,
    })
    setGenerationError(null)
    setLastGeneratedAt(new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }))
    return true
  }, [enteredBaseCost, sku, variants])

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
          <h1 className="text-2xl font-semibold tracking-tight md:text-3xl">RSP</h1>
          <p className="mt-1 text-sm leading-relaxed text-muted-foreground">
            Pick a product, enter base cost, review landed cost and shelf scenarios—then approve and continue to order creation.
          </p>
        </div>
        {/* <Panel className="flex flex-wrap items-center gap-3 border-primary/25 bg-primary/5 p-3 text-sm lg:col-span-4 lg:justify-self-end">
          <span className="inline-flex size-7 shrink-0 items-center justify-center rounded-full bg-primary text-xs font-bold text-primary-foreground">
            2
          </span>
          <span className="text-muted-foreground">Next:</span>
          <Link href="/purchase" className="font-semibold text-primary underline-offset-4 hover:underline">
            Order creation →
          </Link>
        </Panel> */}
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

        <Panel className="space-y-3 border-border/60 bg-card/95 p-3 lg:col-span-4 lg:min-h-[360px]">
          <h2 className="text-sm font-semibold">Step 1: Start generation</h2>
          <div className="rounded-xl border border-primary/20 bg-linear-to-br from-primary/10 via-background to-primary/5 p-4">
            <p className="text-sm font-medium">Open RSP dialog</p>
            <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
              Select product + enter base cost in one focused modal, then generate.
            </p>
            <Button
              type="button"
              className="mt-3"
              onClick={() => {
                setDraftSku(v?.sku ?? variants[0]?.sku ?? "")
                setDraftBaseCost(enteredBaseCost)
                setGenerationError(null)
                setShowGenerateDialog(true)
              }}
            >
              Generate / Get RSP
            </Button>
          </div>

          {generationError ? (
            <p className="rounded-md border border-rose-500/30 bg-rose-500/8 px-3 py-2 text-xs text-rose-700 dark:text-rose-300">
              {generationError}
            </p>
          ) : null}

          {inferredInput ? (
            <div className="grid grid-cols-2 gap-2">
              <div className="rounded-lg border border-border/60 bg-card px-3 py-2.5 shadow-sm">
                <p className="text-[11px] text-muted-foreground">Generated landed cost</p>
                <p className="mt-1 text-xl font-semibold tabular-nums">
                  {generatedBreakdown ? toMoney(generatedBreakdown.landedCost) : "—"}
                </p>
              </div>
              <div className="rounded-lg border border-border/60 bg-card px-3 py-2.5 shadow-sm">
                <p className="text-[11px] text-muted-foreground">Base unit cost</p>
                <p className="mt-1 text-xl font-semibold tabular-nums">
                  {enteredBaseCost.trim() ? toMoney(Number(enteredBaseCost)) : "—"}
                </p>
              </div>
              <div className="rounded-lg border border-border/60 bg-card px-3 py-2.5 shadow-sm">
                <p className="text-[11px] text-muted-foreground">Market reference price</p>
                <p className="mt-1 text-xl font-semibold tabular-nums">{toMoney(inferredInput.competitorPrice)}</p>
              </div>
              <div className="rounded-lg border border-border/60 bg-card px-3 py-2.5 shadow-sm">
                <p className="text-[11px] text-muted-foreground">Target margin</p>
                <p className="mt-1 text-xl font-semibold tabular-nums">{inferredInput.targetMarginPct}%</p>
              </div>
              <div className="rounded-lg border border-border/60 bg-card px-3 py-2.5 shadow-sm">
                <p className="text-[11px] text-muted-foreground">Pricing strategy</p>
                <p className="mt-1 text-xl font-semibold tabular-nums">
                  {inferredInput.scenarioSlider < 40
                    ? "Volume"
                    : inferredInput.scenarioSlider > 63
                      ? "Margin"
                      : "Balanced"}
                </p>
              </div>
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">No products.</p>
          )}
          {lastGeneratedAt ? (
            <p className="text-[11px] text-muted-foreground">
              Last generated at {lastGeneratedAt}
            </p>
          ) : null}
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
                {pricingGuardrails.map((g) => (
                  <span
                    key={g.label}
                    className={cn(
                      "rounded-md px-2 py-1 shadow-sm ring-1",
                      g.tone === "ok"
                        ? "bg-emerald-500/10 text-emerald-800 ring-emerald-500/25 dark:text-emerald-300"
                        : "bg-amber-500/10 text-amber-900 ring-amber-500/25 dark:text-amber-300"
                    )}
                  >
                    {g.label}
                  </span>
                ))}
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
                        landedCost: generatedInput?.landedCost ?? 0,
                        competitorPrice: generatedInput?.competitorPrice ?? 0,
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
            <p className="mt-2 text-sm text-muted-foreground">
              Pick a product, enter base unit cost, then click Generate RSP.
            </p>
          )}
        </Panel>
      </div>

      {analysis ? (
        <div className="grid gap-3 lg:grid-cols-12">
          <Panel className="space-y-4 border-border/60 p-4 lg:col-span-8">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h2 className="text-sm font-semibold">How this price was calculated</h2>
              <div className="flex items-center gap-2 text-xs">
                <span className="rounded-md border border-border/60 bg-muted/20 px-2 py-1">
                  Cost-led
                </span>
                <span className="rounded-md border border-border/60 bg-muted/20 px-2 py-1">
                  Market-checked
                </span>
                <span className="rounded-md border border-border/60 bg-muted/20 px-2 py-1">
                  Demand-adjusted
                </span>
              </div>
            </div>

            <div className="grid gap-3 sm:grid-cols-3">
              <div className="rounded-lg border border-border/60 bg-card p-3">
                <p className="text-[11px] text-muted-foreground">Base to final move</p>
                <p className="mt-1 text-lg font-semibold tabular-nums">
                  {analysis.blendedBeforeDemand > 0
                    ? `${Math.round(((analysis.suggested - analysis.blendedBeforeDemand) / analysis.blendedBeforeDemand) * 100)}%`
                    : "0%"}
                </p>
              </div>
              <div className="rounded-lg border border-border/60 bg-card p-3">
                <p className="text-[11px] text-muted-foreground">Implied margin model</p>
                <p className="mt-1 text-lg font-semibold tabular-nums">
                  {(analysis.impliedMarginRate * 100).toFixed(1)}%
                </p>
              </div>
              <div className="rounded-lg border border-primary/30 bg-primary/10 p-3">
                <p className="text-[11px] text-muted-foreground">Final RSP</p>
                <p className="mt-1 text-lg font-bold tabular-nums">₹{analysis.suggested.toLocaleString("en-IN")}</p>
              </div>
            </div>

            <div className="space-y-0">
              {analysis.steps.map((step, i) => (
                <div key={step.id} className="relative pl-7 pb-4 last:pb-0">
                  <span className="absolute top-1 left-0 inline-flex size-5 items-center justify-center rounded-full border border-primary/35 bg-primary/10 text-[10px] font-semibold text-primary">
                    {i + 1}
                  </span>
                  {i < analysis.steps.length - 1 ? (
                    <span className="absolute top-6 left-2 h-[calc(100%-8px)] w-px bg-border/80" />
                  ) : null}
                  <div className="rounded-lg border border-border/60 bg-card p-3 shadow-sm">
                    <p className="text-sm font-medium">{step.title}</p>
                    <p className="mt-1 text-xs leading-relaxed text-muted-foreground">{step.detail}</p>
                    {step.amountInr != null ? (
                      <div className="mt-2 inline-flex items-center rounded-md bg-primary/10 px-2 py-1 text-xs font-semibold text-primary tabular-nums">
                        ₹{step.amountInr.toLocaleString("en-IN")}
                      </div>
                    ) : null}
                  </div>
                </div>
              ))}
            </div>
          </Panel>

          <Panel className="space-y-3 border-border/60 p-4 lg:col-span-4">
            <h2 className="text-sm font-semibold">Detailed cost breakdown</h2>
            {generatedBreakdown ? (
              <>
                <div className="rounded-xl border border-border/60 bg-card/60 p-3">
                  {([
                    ["Base unit cost", generatedBreakdown.exFactoryCost, "bg-violet-500/70"],
                    ["Freight", generatedBreakdown.freightCost, "bg-sky-500/70"],
                    ["Import & duty", generatedBreakdown.importAndDutyCost, "bg-cyan-500/70"],
                    ["Warehousing", generatedBreakdown.warehousingCost, "bg-emerald-500/70"],
                    ["Company overhead", generatedBreakdown.companyOverheadCost, "bg-amber-500/70"],
                    ["Marketing", generatedBreakdown.marketingCost, "bg-orange-500/70"],
                    ["Payment/channel", generatedBreakdown.paymentAndChannelCost, "bg-fuchsia-500/70"],
                    ["Returns reserve", generatedBreakdown.returnReserveCost, "bg-rose-500/70"],
                  ] as const).map(([label, amount, color]) => (
                    <div key={label} className="mb-2 last:mb-0">
                      <div className="mb-1 flex items-center justify-between text-[11px]">
                        <span className="text-muted-foreground">{label}</span>
                        <span className="font-semibold tabular-nums">{toMoney(amount)}</span>
                      </div>
                      <div className="h-2 overflow-hidden rounded-full bg-muted">
                        <div
                          className={cn("h-full rounded-full transition-all", color)}
                          style={{ width: `${Math.max(5, (amount / Math.max(1, breakdownTotal)) * 100)}%` }}
                        />
                      </div>
                    </div>
                  ))}
                </div>
                <div className="rounded-lg border border-primary/35 bg-primary/10 px-3 py-2 shadow-sm">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-medium">Total landed cost</span>
                    <span className="text-base font-bold tabular-nums">{toMoney(generatedBreakdown.landedCost)}</span>
                  </div>
                </div>
                <h3 className="pt-1 text-xs font-semibold tracking-wide text-muted-foreground uppercase">
                  Quick range check
                </h3>
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
              </>
            ) : (
              <p className="text-sm text-muted-foreground">
                Generate RSP to see freight, company, marketing and full landed-cost breakdown.
              </p>
            )}
            <p className="text-xs text-muted-foreground">
              Final RSP is cost-based, checked against market reference, then adjusted by demand trend.
            </p>
          </Panel>
        </div>
      ) : null}

      {showGenerateDialog ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <button
            type="button"
            aria-label="Close dialog"
            className="absolute inset-0 bg-black/45 backdrop-blur-[1px]"
            onClick={() => setShowGenerateDialog(false)}
          />
          <Panel className="relative z-10 w-full max-w-lg border-border/70 bg-card p-4 shadow-2xl">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-sm font-semibold">Generate RSP</p>
                <p className="mt-1 text-xs text-muted-foreground">
                  Pick the product and enter your base unit cost.
                </p>
              </div>
              <Button type="button" variant="ghost" size="sm" onClick={() => setShowGenerateDialog(false)}>
                Close
              </Button>
            </div>
            <div className="mt-4 space-y-3">
              <div className="space-y-1">
                <label htmlFor="dialog-product" className="text-xs font-medium text-muted-foreground">
                  Product
                </label>
                <select
                  id="dialog-product"
                  className="h-10 w-full rounded-lg border border-input bg-background px-3 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  value={draftSku}
                  onChange={(e) => setDraftSku(e.target.value)}
                >
                  {variants.map((x) => (
                    <option key={x.id} value={x.sku}>
                      {x.sku} — {x.productName}
                    </option>
                  ))}
                </select>
              </div>
              <div className="space-y-1">
                <label htmlFor="dialog-base-cost" className="text-xs font-medium text-muted-foreground">
                  Base unit cost
                </label>
                <input
                  id="dialog-base-cost"
                  inputMode="decimal"
                  className="h-10 w-full rounded-lg border border-input bg-background px-3 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  placeholder="Enter supplier/base cost"
                  value={draftBaseCost}
                  onChange={(e) => setDraftBaseCost(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault()
                      const ok = generateRsp(draftSku, draftBaseCost)
                      if (ok) setShowGenerateDialog(false)
                    }
                  }}
                />
              </div>
              <div className="flex items-center justify-end gap-2 pt-1">
                <Button type="button" variant="outline" onClick={() => setShowGenerateDialog(false)}>
                  Cancel
                </Button>
                <Button
                  type="button"
                  onClick={() => {
                    const ok = generateRsp(draftSku, draftBaseCost)
                    if (ok) setShowGenerateDialog(false)
                  }}
                >
                  Generate RSP
                </Button>
              </div>
            </div>
          </Panel>
        </div>
      ) : null}

      {approvedForSku ? (
        <Panel className="flex flex-wrap items-center justify-between gap-3 border-emerald-500/20 bg-emerald-500/5 p-4">
          <div>
            <p className="text-sm font-medium">RSP approved — ready for order?</p>
            <p className="text-xs text-muted-foreground">
              Move to order creation with this approved price context.
            </p>
          </div>
          <Button type="button" size="sm" asChild>
            <Link href="/purchase">Order creation →</Link>
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
            Order creation
          </Link>
          .
        </p>
      </Panel>
    </div>
  )
}