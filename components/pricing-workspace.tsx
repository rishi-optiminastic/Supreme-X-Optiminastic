"use client"

import * as React from "react"
import Link from "next/link"
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
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
import { Input } from "@/components/ui/input"
import { useVariantsWithOdoo } from "@/hooks/use-variants-with-odoo"
import { useWorkflowState } from "@/hooks/use-workflow-state"
import {
  computeRspAnalysis,
  pricingPowerHint,
  type RspInput,
} from "@/lib/intelligence"
import { cn } from "@/lib/utils"

const barConfig = {
  inr: { label: "₹", color: "var(--primary)" },
} satisfies ChartConfig

export function PricingWorkspace() {
  const { variants, source, odooLoading, odooError, refetchOdoo } =
    useVariantsWithOdoo()
  const { state, approveRsp, revokeRsp } = useWorkflowState()
  const [sku, setSku] = React.useState("")
  const [landed, setLanded] = React.useState(420)
  const [competitor, setCompetitor] = React.useState(999)
  const [marginTarget, setMarginTarget] = React.useState(32)
  const [scenarioSlider, setScenarioSlider] = React.useState(45)
  const [copied, setCopied] = React.useState(false)

  React.useEffect(() => {
    if (variants.length && !sku) setSku(variants[0].sku)
  }, [variants, sku])

  const v = variants.find((x) => x.sku === sku) ?? variants[0]
  const demandScore = v?.trendScore ?? 50

  const input: RspInput = {
    landedCost: landed,
    competitorPrice: competitor,
    demandScore,
    targetMarginPct: marginTarget,
    scenarioSlider,
  }

  const analysis = landed > 0 ? computeRspAnalysis(input) : null

  const approvedForSku = v ? state.rspBySku[v.sku] : undefined

  const barData = React.useMemo(() => {
    if (!analysis) return []
    return [
      { name: "Lower", key: "vol", value: analysis.lowPrice, fill: "var(--chart-2)" },
      {
        name: "Suggested",
        key: "mid",
        value: analysis.suggested,
        fill: "var(--primary)",
      },
      { name: "Higher", key: "hi", value: analysis.highPrice, fill: "var(--chart-3)" },
    ]
  }, [analysis])

  const copySuggested = async () => {
    if (!analysis) return
    try {
      await navigator.clipboard.writeText(String(analysis.suggested))
      setCopied(true)
      window.setTimeout(() => setCopied(false), 2000)
    } catch {
      setCopied(false)
    }
  }

  const sliderLabel =
    scenarioSlider < 33 ? "Volume" : scenarioSlider > 66 ? "Margin" : "Balanced"

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Price</h1>
        <p className="mt-1 max-w-2xl text-sm leading-relaxed text-muted-foreground">
          Enter your landed cost and a competitor price if you have one. We mix those with your
          SKU trend and show a suggested rupee price plus two alternatives.
        </p>
      </div>

      <Panel className="flex flex-wrap items-center justify-between gap-3 p-4">
        <div className="text-sm">
          <span className="text-muted-foreground">Trend from </span>
          <span className="font-medium text-foreground">{source === "odoo" ? "Odoo" : "demo"}</span>
          {odooLoading ? (
            <span className="ml-2 text-muted-foreground">Loading…</span>
          ) : null}
          {odooError ? (
            <span className="ml-2 text-destructive">{odooError}</span>
          ) : null}
        </div>
        <Button type="button" variant="outline" size="sm" onClick={() => refetchOdoo()}>
          Refresh
        </Button>
      </Panel>

      <div className="grid gap-4 lg:grid-cols-12">
        <Panel className="space-y-4 p-4 lg:col-span-5">
          <h2 className="text-sm font-semibold">Inputs</h2>
          {variants.length > 0 ? (
            <div className="space-y-1">
              <label className="text-xs text-muted-foreground">SKU</label>
              <select
                className={cn(
                  "h-9 w-full rounded-md border border-input bg-background px-3 text-sm",
                  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                )}
                value={sku}
                onChange={(e) => setSku(e.target.value)}
              >
                {variants.map((x) => (
                  <option key={x.id} value={x.sku}>
                    {x.sku} — trend {x.trendScore}, {x.weeksCover} wk cover
                  </option>
                ))}
              </select>
            </div>
          ) : null}
          {v ? (
            <p className="rounded-md border border-border/60 bg-muted/30 px-3 py-2 text-xs text-muted-foreground">
              {pricingPowerHint(v)}
            </p>
          ) : null}
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1">
              <label className="text-xs text-muted-foreground" htmlFor="pc-landed">
                Landed cost (₹)
              </label>
              <Input
                id="pc-landed"
                type="number"
                min={1}
                value={landed}
                onChange={(e) => setLanded(Number(e.target.value) || 0)}
              />
            </div>
            <div className="space-y-1">
              <label className="text-xs text-muted-foreground" htmlFor="pc-comp">
                Competitor (₹)
              </label>
              <Input
                id="pc-comp"
                type="number"
                min={0}
                value={competitor}
                onChange={(e) => setCompetitor(Number(e.target.value) || 0)}
              />
            </div>
            <div className="space-y-1 sm:col-span-2">
              <label className="text-xs text-muted-foreground" htmlFor="pc-margin">
                Target margin %
              </label>
              <Input
                id="pc-margin"
                type="number"
                min={5}
                max={60}
                value={marginTarget}
                onChange={(e) => setMarginTarget(Number(e.target.value) || 20)}
              />
            </div>
          </div>
          <div className="space-y-2 border-t border-border/50 pt-3">
            <div className="flex items-center justify-between text-xs">
              <span className="text-muted-foreground">Tilt</span>
              <span className="font-medium text-foreground">{sliderLabel}</span>
            </div>
            <div className="flex justify-between text-[10px] text-muted-foreground">
              <span>Move stock</span>
              <span>Keep margin</span>
            </div>
            <input
              type="range"
              min={0}
              max={100}
              value={scenarioSlider}
              onChange={(e) => setScenarioSlider(Number(e.target.value))}
              className="w-full accent-primary"
            />
            <p className="text-[11px] text-muted-foreground">
              Left = aim to sell more; right = aim for more profit per unit.
            </p>
          </div>
        </Panel>

        <Panel
          className={cn(
            "relative overflow-hidden p-5 lg:col-span-7",
            "bg-linear-to-br from-primary/10 via-transparent to-chart-3/10"
          )}
        >
          {!analysis ? (
            <p className="text-sm text-muted-foreground">Add your landed cost above to see prices.</p>
          ) : (
            <>
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className="text-xs font-medium text-muted-foreground">Suggested price</p>
                  <p className="mt-1 text-4xl font-bold tabular-nums tracking-tight">
                    ₹{analysis.suggested.toLocaleString("en-IN")}
                  </p>
                  <div className="mt-2 flex flex-wrap gap-2 text-xs">
                    <span className="rounded-md bg-background/80 px-2 py-1 font-medium tabular-nums ring-1 ring-border/60">
                      Margin ~{analysis.suggestedMarginPct}%
                    </span>
                    <span className="rounded-md bg-background/80 px-2 py-1 font-medium tabular-nums ring-1 ring-border/60">
                      Profit ₹{analysis.profitPerUnit}/unit
                    </span>
                    {analysis.vsCompetitorPct != null ? (
                      <span
                        className={cn(
                          "rounded-md px-2 py-1 font-medium tabular-nums ring-1 ring-border/60",
                          analysis.vsCompetitorPct > 0
                            ? "bg-amber-500/10 text-amber-900 dark:text-amber-200"
                            : analysis.vsCompetitorPct < 0
                              ? "bg-emerald-500/10 text-emerald-900 dark:text-emerald-200"
                              : "bg-muted text-muted-foreground"
                        )}
                      >
                        vs their price{" "}
                        {analysis.vsCompetitorPct > 0 ? "+" : ""}
                        {analysis.vsCompetitorPct}%
                      </span>
                    ) : null}
                  </div>
                </div>
                <div className="flex flex-wrap gap-2">
                  <Button type="button" variant="secondary" size="sm" onClick={copySuggested}>
                    {copied ? "Copied" : "Copy ₹"}
                  </Button>
                  {v && analysis ? (
                    <Button
                      type="button"
                      size="sm"
                      onClick={() =>
                        approveRsp(v, analysis.suggested, {
                          landedCost: landed,
                          competitorPrice: competitor,
                        })
                      }
                    >
                      Approve price
                    </Button>
                  ) : null}
                  {v && approvedForSku ? (
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => revokeRsp(v.sku)}
                    >
                      Clear approval
                    </Button>
                  ) : null}
                </div>
              </div>
              {approvedForSku ? (
                <p className="mt-3 text-xs text-emerald-700 dark:text-emerald-400">
                  Approved ₹{approvedForSku.rspInr.toLocaleString("en-IN")} for this SKU — next:{" "}
                  <Link href="/workflow" className="font-medium underline-offset-2 hover:underline">
                    Workflow
                  </Link>{" "}
                  or{" "}
                  <Link
                    href="/smart-orders"
                    className="font-medium underline-offset-2 hover:underline"
                  >
                    Restock
                  </Link>{" "}
                  with &quot;After RSP&quot; template.
                </p>
              ) : null}

              <div className="mt-5 grid gap-3 sm:grid-cols-2">
                {analysis.scenarios.map((s) => {
                  const delta = s.price - analysis.suggested
                  return (
                    <div
                      key={s.label}
                      className="rounded-lg border border-border/60 bg-background/85 p-3 text-sm backdrop-blur-sm"
                    >
                      <p className="font-semibold">{s.label}</p>
                      <p className="mt-1 text-xs text-muted-foreground">{s.note}</p>
                      <p className="mt-2 tabular-nums">
                        <span className="text-muted-foreground">Margin </span>
                        <span className="font-medium">{s.marginPct}%</span>
                        {delta !== 0 ? (
                          <span className="ml-2 text-xs text-muted-foreground">
                            ({delta > 0 ? "+" : ""}
                            {delta} vs suggested)
                          </span>
                        ) : null}
                      </p>
                    </div>
                  )
                })}
              </div>
            </>
          )}
        </Panel>
      </div>

      {analysis ? (
        <div className="grid gap-4 lg:grid-cols-2">
          <Panel className="overflow-hidden p-0">
            <div className="border-b border-border/60 px-4 py-3">
              <h2 className="text-sm font-semibold">Three price levels</h2>
              <p className="mt-1 text-xs text-muted-foreground">
                Same trend tweak on each bar so you can compare fairly.
              </p>
            </div>
            <div className="p-3 sm:p-4">
              <ChartContainer
                config={barConfig}
                className="aspect-auto h-[200px] w-full"
                initialDimension={{ width: 480, height: 200 }}
              >
                <BarChart
                  data={barData}
                  layout="vertical"
                  margin={{ left: 4, right: 16, top: 8, bottom: 4 }}
                >
                  <CartesianGrid strokeDasharray="3 3" className="stroke-border/60" horizontal={false} />
                  <XAxis type="number" tickLine={false} axisLine={false} tickMargin={8} />
                  <YAxis
                    type="category"
                    dataKey="name"
                    width={72}
                    tickLine={false}
                    axisLine={false}
                    tickMargin={8}
                  />
                  <ChartTooltip
                    content={
                      <ChartTooltipContent
                        formatter={(value) =>
                          `₹${Number(value).toLocaleString("en-IN")}`
                        }
                      />
                    }
                  />
                  <Bar dataKey="value" radius={[0, 4, 4, 0]} maxBarSize={28}>
                    {barData.map((entry) => (
                      <Cell key={entry.key} fill={entry.fill} />
                    ))}
                  </Bar>
                </BarChart>
              </ChartContainer>
            </div>
          </Panel>

          <Panel className="space-y-3 p-4">
            <h2 className="text-sm font-semibold">How we calculated it</h2>
            <ol className="space-y-3">
              {analysis.steps.map((step, i) => (
                <li key={step.id} className="flex gap-3 text-sm">
                  <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-primary/15 text-xs font-bold text-primary">
                    {i + 1}
                  </span>
                  <div className="min-w-0">
                    <p className="font-medium">{step.title}</p>
                    <p className="mt-0.5 text-xs text-muted-foreground">{step.detail}</p>
                    {step.amountInr != null ? (
                      <p className="mt-1 font-mono text-xs tabular-nums text-foreground">
                        → ₹{step.amountInr.toLocaleString("en-IN")}
                      </p>
                    ) : null}
                  </div>
                </li>
              ))}
            </ol>
            <p className="border-t border-border/50 pt-3 text-[11px] text-muted-foreground">
              Before trend: ₹{analysis.blendedBeforeDemand.toLocaleString("en-IN")} ×{" "}
              {analysis.demandMultiplier.toFixed(2)} → rounded suggestion. Does not include tax or
              marketplace fees.
            </p>
          </Panel>
        </div>
      ) : null}
    </div>
  )
}
