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
import { buildWeeklyForecast, weeklyDemand } from "@/lib/planning-math"
import { resolveVariantImageUrl } from "@/lib/variant-image"
import { cn } from "@/lib/utils"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"

const forecastChartConfig = {
  past: { label: "Recent weeks", color: "var(--chart-2)" },
  future: { label: "Next weeks", color: "var(--primary)" },
  low: { label: "Low", color: "var(--muted-foreground)" },
} satisfies ChartConfig

function probabilityHue(p: number) {
  if (p >= 70) return "from-emerald-500/20 to-emerald-500/5"
  if (p >= 45) return "from-amber-500/20 to-amber-500/5"
  return "from-rose-500/15 to-rose-500/5"
}

export function PredictionWorkspace() {
  const { variants, source, odooLoading, odooError, refetchOdoo } =
    useVariantsWithOdoo()
  const [sku, setSku] = React.useState("")
  const [external, setExternal] =
    React.useState<ExternalSignals>(defaultExternalSignals)
  const [regionHeat, setRegionHeat] = React.useState(55)
  const [categoryHeat, setCategoryHeat] = React.useState(50)
  const [leadW, setLeadW] = React.useState(2)
  const [safetyW, setSafetyW] = React.useState(1)
  const [targetW, setTargetW] = React.useState(4)

  React.useEffect(() => {
    if (variants.length && !sku) setSku(variants[0].sku)
  }, [variants, sku])

  const v = variants.find((x) => x.sku === sku) ?? variants[0]

  const breakdown = React.useMemo(() => {
    if (!v) return null
    return demandProbabilityBreakdown(v, external, {
      regionHeat,
      categoryHeat,
    })
  }, [v, external, regionHeat, categoryHeat])

  const prob = breakdown?.total ?? 0
  const reorder = v
    ? suggestedReorderQty(v, leadW, safetyW, targetW)
    : 0
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
    if (!v || variants.length === 0) return null
    const sorted = [...variants].sort((a, b) => b.trendScore - a.trendScore)
    const idx = sorted.findIndex((x) => x.sku === v.sku)
    return idx >= 0 ? idx + 1 : null
  }, [v, variants])

  const maxPart = React.useMemo(() => {
    if (!breakdown?.parts.length) return 1
    return Math.max(
      1,
      ...breakdown.parts.map((p) => Math.abs(p.points))
    )
  }, [breakdown])

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Demand</h1>
        <p className="mt-1 max-w-2xl text-sm leading-relaxed text-muted-foreground">
          A simple score for how sales might look in the next month, plus what goes into it, a
          small weekly chart, and when to order using your lead time and target stock weeks.
        </p>
      </div>

      <Panel className="border-primary/20 bg-primary/5 p-4">
        <p className="text-sm text-muted-foreground">
          Part of the buying flow? See the full steps — demand, approved price, purchase draft,
          then stock check — on the{" "}
          <Link href="/workflow" className="font-medium text-primary underline-offset-2 hover:underline">
            Workflow
          </Link>{" "}
          page.
        </p>
      </Panel>

      <Panel className="flex flex-wrap items-center justify-between gap-3 p-4">
        <div className="text-sm">
          <span className="text-muted-foreground">Products from </span>
          <span className="font-medium text-foreground">
            {source === "odoo" ? "Odoo" : "demo data"}
          </span>
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

      <div className="grid gap-4 lg:grid-cols-3">
        <Panel className="space-y-4 p-4 lg:col-span-2">
          <h2 className="text-sm font-semibold">SKU</h2>
          {variants.length === 0 ? (
            <p className="text-sm text-muted-foreground">No products.</p>
          ) : (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  type="button"
                  variant="outline"
                  className={cn(
                    "h-9 w-full max-w-xl justify-start gap-3 rounded-xl px-3 text-sm",
                    "overflow-hidden"
                  )}
                >
                  {v ? (
                    <img
                      src={resolveVariantImageUrl({
                        sku: v.sku,
                        id: v.id,
                        imageUrl: v.imageUrl,
                      })}
                      alt={v.productName}
                      className="size-6 shrink-0 rounded-md object-cover"
                      loading="lazy"
                    />
                  ) : null}
                  <div className="min-w-0 text-left">
                    <div className="truncate font-medium">{v?.sku ?? sku}</div>
                    <div className="truncate text-xs text-muted-foreground">
                      {v?.productName ?? ""}
                    </div>
                  </div>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent className="max-h-[360px] overflow-auto">
                {variants.map((x) => (
                  <DropdownMenuItem
                    key={x.id}
                    className="gap-3"
                    onSelect={() => setSku(x.sku)}
                  >
                    <img
                      src={resolveVariantImageUrl({
                        sku: x.sku,
                        id: x.id,
                        imageUrl: x.imageUrl,
                      })}
                      alt={x.productName}
                      className="size-7 shrink-0 rounded-md object-cover"
                      loading="lazy"
                    />
                    <div className="min-w-0 text-left">
                      <div className="truncate font-medium">{x.sku}</div>
                      <div className="truncate text-xs text-muted-foreground">
                        {x.productName}
                      </div>
                    </div>
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>
          )}
          {v ? (
            <div className="flex flex-wrap gap-2">
              {[
                ["On hand", v.onHand],
                ["Inbound", v.inbound],
                ["Cover (wk)", v.weeksCover],
                ["Trend", v.trendScore],
                ["~Units/wk", wk.toFixed(1)],
              ].map(([label, val]) => (
                <span
                  key={String(label)}
                  className="inline-flex items-center gap-1.5 rounded-md border border-border/60 bg-muted/30 px-2.5 py-1 text-xs"
                >
                  <span className="text-muted-foreground">{label}</span>
                  <span className="font-semibold tabular-nums">{val}</span>
                </span>
              ))}
              {rank != null ? (
                <span className="inline-flex items-center rounded-md border border-primary/25 bg-primary/10 px-2.5 py-1 text-xs font-medium text-primary">
                  #{rank} of {variants.length} by trend
                </span>
              ) : null}
            </div>
          ) : null}
          {v?.salesQty90d != null ? (
            <p className="text-xs text-muted-foreground">
              <span className="font-medium text-foreground">{v.salesQty90d} units</span> in about
              the last 90 days (from Odoo).
            </p>
          ) : (
            <p className="text-xs text-muted-foreground">
              No 90-day sales total yet — the score uses trend and weeks of stock instead.
            </p>
          )}
        </Panel>

        <Panel
          className={cn(
            "relative overflow-hidden p-5",
            "bg-linear-to-b",
            probabilityHue(prob)
          )}
        >
          <p className="text-xs font-medium text-muted-foreground">
            Demand score (about 30 days)
          </p>
          <div className="mt-2 flex items-end gap-2">
            <span className="text-5xl font-bold tabular-nums tracking-tight text-foreground">
              {prob}%
            </span>
          </div>
          {breakdown ? (
            <p className="mt-1 text-xs text-muted-foreground">
              Rough range {breakdown.bandLow}%–{breakdown.bandHigh}%
            </p>
          ) : null}
          <div
            className="mt-4 h-2.5 overflow-hidden rounded-full bg-background/60 ring-1 ring-border/50"
            role="presentation"
          >
            <div
              className={cn(
                "h-full rounded-full transition-all duration-300",
                prob >= 70 && "bg-emerald-500",
                prob >= 45 && prob < 70 && "bg-amber-500",
                prob < 45 && "bg-rose-500"
              )}
              style={{ width: `${prob}%` }}
            />
          </div>
          <div className="mt-4 space-y-2 rounded-lg border border-border/50 bg-background/70 p-3 text-sm backdrop-blur-sm">
            <div className="flex justify-between gap-2">
              <span className="text-muted-foreground">Suggested buy</span>
              <span className="font-semibold tabular-nums">{reorder} units</span>
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
              <span className="text-xs text-muted-foreground">{timing?.reason}</span>
            </div>
          </div>
        </Panel>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Panel className="space-y-3 p-4">
          <h2 className="text-sm font-semibold">Order settings</h2>
          <p className="text-xs text-muted-foreground">
            Same math as Restock: target + lead + safety weeks × units per week, minus what you
            already have and what is incoming.
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

        <Panel className="space-y-3 p-4">
          <h2 className="text-sm font-semibold">What changes the score</h2>
          {breakdown ? (
            <ul className="space-y-2.5">
              {breakdown.parts.map((part) => (
                <li key={part.id}>
                  <div className="flex items-center justify-between gap-2 text-xs">
                    <span className="font-medium text-foreground">{part.label}</span>
                    <span
                      className={cn(
                        "tabular-nums",
                        part.points > 0 && "text-emerald-600 dark:text-emerald-400",
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
                  <p className="mt-0.5 text-[11px] text-muted-foreground">{part.detail}</p>
                </li>
              ))}
            </ul>
          ) : null}
          {breakdown ? (
            <p className="border-t border-border/50 pt-2 text-[11px] text-muted-foreground">
              Parts add to {breakdown.rawBeforeClamp.toFixed(1)}; the big number is capped between
              12% and 94% → {breakdown.total}%.
            </p>
          ) : null}
        </Panel>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Panel className="space-y-3 p-4">
          <h2 className="text-sm font-semibold">Extra demand (sliders)</h2>
          <p className="text-xs text-muted-foreground">
            Slide these if you feel search, marketplaces, or word of mouth are hotter or colder
            than usual.
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
              <span className="text-muted-foreground">Region: {regionHeat}%</span>
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
              <span className="text-muted-foreground">Category strength: {categoryHeat}%</span>
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

        <Panel className="overflow-hidden p-0">
          <div className="border-b border-border/60 px-4 py-3">
            <h2 className="text-sm font-semibold">Units per week</h2>
            <p className="mt-1 text-xs text-muted-foreground">
              Rough history and a short look ahead. The dashed line at week{" "}
              <span className="font-mono">-1</span> is where we switch from past to next weeks.
            </p>
          </div>
          <div className="p-3 sm:p-4">
            {chartData.length === 0 ? (
              <p className="text-sm text-muted-foreground">No chart data.</p>
            ) : (
              <ChartContainer
                config={forecastChartConfig}
                className="aspect-auto h-[min(260px,38vh)] min-h-[200px] w-full"
                initialDimension={{ width: 560, height: 240 }}
              >
                <LineChart data={chartData} margin={{ left: 4, right: 8, top: 8, bottom: 4 }}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-border/60" vertical={false} />
                  <XAxis dataKey="week" tickLine={false} axisLine={false} tickMargin={6} />
                  <YAxis width={36} tickLine={false} axisLine={false} tickMargin={6} />
                  <ChartTooltip content={<ChartTooltipContent />} />
                  <Legend />
                  <ReferenceLine x="-1" stroke="var(--border)" strokeDasharray="4 4" />
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
    </div>
  )
}
