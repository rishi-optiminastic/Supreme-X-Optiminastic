"use client"

import * as React from "react"
import Link from "next/link"
import { Area, AreaChart, CartesianGrid, XAxis, YAxis } from "recharts"

import { useAppData } from "@/components/app-data-context"
import { DataSourceBanner } from "@/components/data-source-banner"
import { PageHeader } from "@/components/page-header"
import { SurfaceCard } from "@/components/surface-card"
import { Button } from "@/components/ui/button"
import { useAiInsight } from "@/hooks/use-ai-insight"
import { useVariantsWithOdoo } from "@/hooks/use-variants-with-odoo"
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from "@/components/ui/chart"
import { cn } from "@/lib/utils"
import {
  RiArrowDownLine,
  RiArrowRightLine,
  RiArrowUpLine,
  RiBox3Line,
  RiFlashlightLine,
  RiLoader4Line,
  RiShoppingCart2Line,
  RiTimerLine,
  RiTruckLine,
} from "@remixicon/react"

const statCards = [
  {
    label: "Revenue (30d)",
    value: "$284.2k",
    delta: "+12.4%",
    up: true,
    icon: RiShoppingCart2Line,
    href: "/signals",
    hint: "Sales & signals",
  },
  {
    label: "Open orders",
    value: "1,428",
    delta: "+3.1%",
    up: true,
    icon: RiBox3Line,
    href: "/inventory",
    hint: "Stock & variants",
  },
  {
    label: "Fulfillment rate",
    value: "97.2%",
    delta: "−0.4%",
    up: false,
    icon: RiTruckLine,
    href: "/warehouse",
    hint: "Warehouse ops",
  },
  {
    label: "Avg. lead time",
    value: "2.4 d",
    delta: "−8%",
    up: true,
    icon: RiTimerLine,
    href: "/trends",
    hint: "Trends & forecast",
  },
]

const weeklyOrders = [
  { label: "Mon", value: 42 },
  { label: "Tue", value: 58 },
  { label: "Wed", value: 51 },
  { label: "Thu", value: 72 },
  { label: "Fri", value: 68 },
  { label: "Sat", value: 44 },
  { label: "Sun", value: 39 },
] as const

const fulfillmentTrend = [
  { month: "Jan", score: 62 },
  { month: "Feb", score: 71 },
  { month: "Mar", score: 68 },
  { month: "Apr", score: 79 },
  { month: "May", score: 84 },
  { month: "Jun", score: 88 },
] as const

const fulfillmentChartConfig = {
  score: {
    label: "Fulfillment score",
    color: "var(--primary)",
  },
} satisfies ChartConfig

const categoryMix = [
  { name: "Electronics", pct: 38, color: "var(--chart-1)" },
  { name: "Apparel", pct: 27, color: "var(--chart-2)" },
  { name: "Home", pct: 21, color: "var(--chart-3)" },
  { name: "Other", pct: 14, color: "var(--chart-4)" },
] as const

function formatUsd(n: number) {
  return new Intl.NumberFormat(undefined, {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(n)
}

function parseAmountToNumber(amount: string) {
  const n = parseFloat(String(amount).replace(/[^0-9.-]/g, ""))
  return Number.isNaN(n) ? 0 : n
}

function orderStatusClass(status: string) {
  if (status === "Shipped")
    return "bg-emerald-500/15 text-emerald-800 dark:text-emerald-300"
  if (status === "Picking" || status === "Confirmed")
    return "bg-amber-500/15 text-amber-900 dark:text-amber-300"
  if (status === "Cancelled")
    return "bg-muted text-muted-foreground"
  if (status === "Quoted" || status === "Draft")
    return "bg-slate-500/15 text-slate-800 dark:text-slate-300"
  return "bg-primary/12 text-primary ring-1 ring-primary/20"
}

const recent = [
  {
    id: "SO-10482",
    customer: "Northwind Trading",
    amount: "$12,400",
    status: "Shipped",
  },
  {
    id: "SO-10481",
    customer: "Acme Retail Co.",
    amount: "$3,210",
    status: "Picking",
  },
  {
    id: "SO-10480",
    customer: "Globex LLC",
    amount: "$28,900",
    status: "Confirmed",
  },
  {
    id: "SO-10479",
    customer: "Initech Supply",
    amount: "$1,045",
    status: "Shipped",
  },
] as const

function BarChartBlock() {
  const max = Math.max(...weeklyOrders.map((d) => d.value), 1)

  return (
    <div className="rounded-xl border border-border/50 bg-linear-to-b from-muted/50 to-muted/25 p-4 shadow-inner ring-1 ring-black/[0.03] ring-inset dark:from-muted/30 dark:to-muted/15 dark:ring-white/[0.04]">
      <div className="flex h-[220px] items-end justify-between gap-1.5 sm:gap-3">
        {weeklyOrders.map(({ label, value }) => {
          const pct = (value / max) * 100
          return (
            <div
              key={label}
              className="group/bar flex min-w-0 flex-1 flex-col items-center gap-2"
            >
              <span className="text-[11px] font-bold text-primary tabular-nums opacity-90 sm:text-xs">
                {value}
              </span>
              <div className="relative flex h-[148px] w-full max-w-[2.75rem] flex-col justify-end sm:max-w-11">
                <div
                  className="absolute inset-0 rounded-lg bg-muted/70 ring-1 ring-border/50 ring-inset dark:bg-muted/40"
                  aria-hidden
                />
                <div
                  className="relative z-[1] mx-0.5 rounded-md bg-linear-to-t from-primary from-40% via-primary/90 to-primary/75 shadow-[0_4px_14px_-2px_var(--primary)] ring-1 ring-primary/25 transition-all duration-200 group-hover/bar:from-primary group-hover/bar:shadow-[0_6px_20px_-4px_var(--primary)] dark:shadow-primary/35"
                  style={{
                    height: `${Math.max(pct, 12)}%`,
                    minHeight: "1.25rem",
                  }}
                  title={`${label}: ${value} units`}
                />
              </div>
              <span className="text-[10px] font-bold tracking-wide text-muted-foreground uppercase sm:text-[11px]">
                {label}
              </span>
            </div>
          )
        })}
      </div>
    </div>
  )
}

function FulfillmentLineChart() {
  return (
    <div className="rounded-xl border border-primary/10 bg-linear-to-b from-primary/[0.06] to-transparent p-1 sm:p-2">
      <ChartContainer
        config={fulfillmentChartConfig}
        className="aspect-auto h-[min(292px,42vh)] min-h-[220px] w-full"
        initialDimension={{ width: 400, height: 280 }}
      >
        <AreaChart
          accessibilityLayer
          data={[...fulfillmentTrend]}
          margin={{ left: 4, right: 12, top: 16, bottom: 0 }}
        >
          <defs>
            <linearGradient
              id="overview-fill-score"
              x1="0"
              y1="0"
              x2="0"
              y2="1"
            >
              <stop offset="0%" stopColor="var(--primary)" stopOpacity={0.26} />
              <stop
                offset="100%"
                stopColor="var(--primary)"
                stopOpacity={0.03}
              />
            </linearGradient>
          </defs>
          <CartesianGrid
            vertical={false}
            strokeDasharray="3 3"
            className="stroke-border/60"
          />
          <XAxis
            dataKey="month"
            tickLine={false}
            axisLine={false}
            tickMargin={12}
          />
          <YAxis
            tickLine={false}
            axisLine={false}
            width={40}
            domain={["dataMin - 4", "dataMax + 4"]}
            tickMargin={8}
          />
          <ChartTooltip
            cursor={{
              stroke: "var(--primary)",
              strokeWidth: 1,
              strokeOpacity: 0.35,
            }}
            content={<ChartTooltipContent indicator="line" />}
          />
          <Area
            type="monotone"
            dataKey="score"
            name="Fulfillment score"
            stroke="var(--color-score)"
            strokeWidth={2.5}
            fill="url(#overview-fill-score)"
            dot={{
              r: 4,
              fill: "var(--background)",
              stroke: "var(--color-score)",
              strokeWidth: 2.5,
            }}
            activeDot={{
              r: 6,
              fill: "var(--color-score)",
              stroke: "var(--background)",
              strokeWidth: 2,
            }}
          />
        </AreaChart>
      </ChartContainer>
    </div>
  )
}

function DonutBlock() {
  const [a, b, c, d] = categoryMix
  const gradient = `conic-gradient(
    ${a.color} 0% ${a.pct}%,
    ${b.color} ${a.pct}% ${a.pct + b.pct}%,
    ${c.color} ${a.pct + b.pct}% ${a.pct + b.pct + c.pct}%,
    ${d.color} ${a.pct + b.pct + c.pct}% 100%
  )`

  return (
    <div className="flex flex-col items-center gap-6 sm:flex-row sm:items-center sm:justify-between sm:gap-8">
      <div
        className="relative size-33 shrink-0 rounded-full shadow-[inset_0_2px_6px_var(--border),0_16px_48px_-12px_var(--primary)] ring-2 ring-primary/15"
        style={{ background: gradient }}
        aria-hidden
      >
        <div className="absolute inset-[19%] rounded-full bg-card shadow-lg ring-1 ring-border/60" />
      </div>
      <ul className="grid w-full gap-3 text-sm">
        {categoryMix.map((c) => (
          <li
            key={c.name}
            className="flex items-center justify-between gap-4 rounded-xl border border-transparent px-3 py-2 transition-colors hover:border-border/60 hover:bg-muted/40"
          >
            <span className="flex items-center gap-2.5 font-medium">
              <span
                className="size-2.5 shrink-0 rounded-full shadow-sm ring-2 ring-background"
                style={{ backgroundColor: c.color }}
              />
              {c.name}
            </span>
            <span className="text-sm font-semibold text-muted-foreground tabular-nums">
              {c.pct}%
            </span>
          </li>
        ))}
      </ul>
    </div>
  )
}

type KpiCard = {
  label: string
  value: string
  delta: string
  up: boolean
  icon: typeof RiShoppingCart2Line
  href: string
  hint: string
  footnote: string
}

export function OverviewDashboard() {
  const { purchaseSignals, trendSources, createManualSignal } = useAppData()
  const {
    variants: merged,
    source,
    odooLoading,
    odooError,
    refetchOdoo,
    liveOrders,
  } = useVariantsWithOdoo()
  const insight = useAiInsight()

  const openSignals = purchaseSignals.filter((s) => !s.sentToTrends).length
  const enabledTrendSources = trendSources.filter((s) => s.enabled).length

  const displayStats = React.useMemo((): KpiCard[] => {
    if (source !== "odoo") {
      return statCards.map((s) => ({
        label: s.label,
        value: s.value,
        delta: s.delta,
        up: s.up,
        icon: s.icon,
        href: s.href,
        hint: s.hint,
        footnote: "vs last period",
      }))
    }
    const pipeline = liveOrders.reduce(
      (a, o) => a + parseAmountToNumber(o.amount),
      0
    )
    const totalOnHand = merged.reduce((a, v) => a + v.onHand, 0)
    const shipped =
      liveOrders.length > 0
        ? liveOrders.filter((o) => o.status === "Shipped").length
        : 0
    const shipPct =
      liveOrders.length > 0
        ? Math.round((shipped / liveOrders.length) * 1000) / 10
        : null

    return [
      {
        label: "Order pipeline (sample)",
        value: pipeline > 0 ? formatUsd(pipeline) : "—",
        delta:
          liveOrders.length > 0
            ? `${liveOrders.length} recent SOs`
            : "No orders in sample",
        up: true,
        icon: RiShoppingCart2Line,
        href: "/signals",
        hint: "Sale orders from Odoo",
        footnote: "last 8 from Odoo",
      },
      {
        label: "Stock lines",
        value: String(merged.length),
        delta: `${totalOnHand.toLocaleString()} units on hand`,
        up: true,
        icon: RiBox3Line,
        href: "/inventory",
        hint: "Variants in feed",
        footnote: "live catalog",
      },
      {
        label: "Shipped (sample mix)",
        value: shipPct != null ? `${shipPct}%` : "—",
        delta:
          liveOrders.length > 0
            ? `${shipped} of ${liveOrders.length} in sample`
            : "Add SO data",
        up: shipPct == null || shipPct >= 50,
        icon: RiTruckLine,
        href: "/warehouse",
        hint: "From SO states",
        footnote: "in this sample only",
      },
      {
        label: "Open signals",
        value: String(openSignals),
        delta: `${enabledTrendSources} trend sources on`,
        up: openSignals < 8,
        icon: RiTimerLine,
        href: "/trends",
        hint: "Queue & forecast",
        footnote: "local workspace",
      },
    ]
  }, [
    source,
    liveOrders,
    merged,
    openSignals,
    enabledTrendSources,
  ])

  const tableRows =
    source === "odoo" && liveOrders.length > 0 ? liveOrders : recent

  const onOverviewAi = () => {
    const low = merged.filter((v) => v.weeksCover < 1.5).length
    void insight.run("overview", {
      dataSource: source,
      variantCount: merged.length,
      lowCoverCount: low,
      totalOnHand: merged.reduce((a, v) => a + v.onHand, 0),
      openSignals,
      trendSourceCount: enabledTrendSources,
      sampleSkus: merged.slice(0, 12).map((v) => v.sku),
    })
  }

  const onApplyHints = () => {
    const hints = insight.data?.purchaseHints ?? []
    for (const h of hints) {
      const sku = h.sku?.trim()
      if (!sku || sku.toUpperCase() === "UNKNOWN") continue
      const v = merged.find((x) => x.sku === sku)
      const urgency: "low" | "medium" | "high" =
        h.urgency === "high" || h.urgency === "low" ? h.urgency : "medium"
      createManualSignal({
        sku,
        variantLabel: v?.attributes ?? "—",
        productName: v?.productName ?? "Product",
        urgency,
        qty: Math.max(16, v ? Math.round(64 - v.onHand * 0.25) : 48),
        reason: h.reason?.trim() || "AI suggestion (overview)",
      })
    }
  }

  return (
    <div className="flex flex-1 flex-col gap-6 px-4 py-6 pb-14 md:gap-8 md:px-6 md:py-8">
      <section
        className="relative overflow-hidden rounded-3xl border border-border/70 bg-card/90 p-6 shadow-lg ring-1 shadow-primary/[0.07] ring-black/[0.04] md:p-8 dark:bg-card/80 dark:shadow-primary/15 dark:ring-white/[0.06]"
        aria-labelledby="overview-heading"
      >
        <div
          className="pointer-events-none absolute -top-24 -right-24 size-[22rem] rounded-full bg-primary/[0.12] blur-3xl dark:bg-primary/20"
          aria-hidden
        />
        <div
          className="pointer-events-none absolute bottom-0 left-1/4 size-48 rounded-full bg-primary/[0.06] blur-2xl"
          aria-hidden
        />

        <div className="flex items-start justify-between gap-4">
          <PageHeader
            id="overview-heading"
            title="Overview"
            description="Snapshot of warehouse throughput, orders, and fulfillment health—built for quick scans and spot checks."
          />

          <div className="flex flex-wrap gap-2 lg:shrink-0">
            <Button
              asChild
              variant="outline"
              size="sm"
              className="gap-1 shadow-sm"
            >
              <Link href="/inventory">
                Inventory
                <RiArrowRightLine className="size-3.5 opacity-70" aria-hidden />
              </Link>
            </Button>

            <Button
              asChild
              variant="outline"
              size="sm"
              className="gap-1 shadow-sm"
            >
              <Link href="/trends">
                Trends
                <RiArrowRightLine className="size-3.5 opacity-70" aria-hidden />
              </Link>
            </Button>

            <Button
              asChild
              variant="default"
              size="sm"
              className="gap-1 shadow-md"
            >
              <Link href="/signals">
                Signals
                <RiArrowRightLine className="size-3.5 opacity-90" aria-hidden />
              </Link>
            </Button>
          </div>
        </div>
      </section>

      <DataSourceBanner
        source={source}
        loading={odooLoading}
        error={odooError}
        onRefresh={refetchOdoo}
      />

      <div className="flex flex-wrap items-center justify-end gap-2">
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="gap-2"
          disabled={insight.loading}
          onClick={onOverviewAi}
        >
          {insight.loading ? (
            <RiLoader4Line className="size-4 animate-spin" aria-hidden />
          ) : (
            <RiFlashlightLine className="size-4" aria-hidden />
          )}
          AI executive brief
        </Button>
      </div>

      {(insight.data?.summary || insight.data?.error) && (
        <SurfaceCard className="border-primary/15 p-5 ring-1 ring-primary/10">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <h3 className="text-sm font-semibold">OpenRouter insight</h3>
            {insight.data.purchaseHints && insight.data.purchaseHints.length > 0 && (
              <Button type="button" size="sm" variant="secondary" onClick={onApplyHints}>
                Add suggested signals
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
              {insight.data.actions && insight.data.actions.length > 0 && (
                <ul className="mt-3 space-y-1 text-xs text-muted-foreground">
                  {insight.data.actions.map((a, i) => (
                    <li key={i} className="flex gap-2">
                      <span className="font-semibold text-primary">{i + 1}.</span>
                      {a}
                    </li>
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

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {displayStats.map((s) => (
          <Link
            key={s.label}
            href={s.href}
            className="group/kpi block rounded-2xl outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
          >
            <SurfaceCard
              elevated
              className="relative h-full overflow-hidden p-5 transition-all duration-200 hover:-translate-y-0.5 hover:border-primary/25 hover:shadow-lg hover:shadow-primary/10"
            >
              <div
                className="pointer-events-none absolute inset-x-0 top-0 h-1 bg-linear-to-r from-primary/0 via-primary/50 to-primary/0 opacity-0 transition-opacity duration-200 group-hover/kpi:opacity-100"
                aria-hidden
              />
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-sm font-medium text-muted-foreground">
                    {s.label}
                  </p>
                  <p className="mt-3 text-3xl font-semibold tracking-tight text-foreground tabular-nums">
                    {s.value}
                  </p>
                </div>
                <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-primary/14 text-primary shadow-sm ring-1 ring-primary/20 transition-transform duration-200 group-hover/kpi:scale-105 dark:bg-primary/22">
                  <s.icon className="size-[1.15rem]" aria-hidden />
                </span>
              </div>
              <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
                <p
                  className={cn(
                    "inline-flex flex-wrap items-center gap-1 text-xs font-semibold",
                    s.up
                      ? "text-emerald-600 dark:text-emerald-400"
                      : "text-rose-600 dark:text-rose-400"
                  )}
                >
                  {s.up ? (
                    <RiArrowUpLine className="size-3.5" aria-hidden />
                  ) : (
                    <RiArrowDownLine className="size-3.5" aria-hidden />
                  )}
                  {s.delta}
                  <span className="font-normal text-muted-foreground">
                    {s.footnote}
                  </span>
                </p>
                <span className="inline-flex items-center gap-0.5 text-[11px] font-medium text-primary opacity-0 transition-opacity group-hover/kpi:opacity-100">
                  {s.hint}
                  <RiArrowRightLine className="size-3" aria-hidden />
                </span>
              </div>
            </SurfaceCard>
          </Link>
        ))}
      </div>

      <div className="grid gap-5 lg:grid-cols-2">
        <SurfaceCard elevated className="overflow-hidden p-0">
          <div className="border-b border-border/60 bg-linear-to-r from-muted/40 via-muted/25 to-transparent px-5 py-4">
            <div className="flex flex-wrap items-end justify-between gap-3">
              <div className="space-y-1">
                <h2 className="text-base font-semibold tracking-tight">
                  Fulfillment score
                </h2>
                <p className="text-xs leading-relaxed text-muted-foreground">
                  Six-month trend (indexed); higher is better throughput.
                </p>
              </div>
              <span className="shrink-0 rounded-full bg-primary/15 px-3 py-1 text-xs font-semibold text-primary shadow-sm ring-1 ring-primary/25">
                +26% YoY
              </span>
            </div>
          </div>
          <div className="p-4 sm:p-5">
            <FulfillmentLineChart />
          </div>
        </SurfaceCard>

        <SurfaceCard elevated className="overflow-hidden p-0">
          <div className="border-b border-border/60 bg-linear-to-r from-muted/40 via-muted/25 to-transparent px-5 py-4">
            <h2 className="text-base font-semibold tracking-tight">
              Orders this week
            </h2>
            <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
              Daily inbound orders (units). Values above each bar.
              {source === "odoo" && (
                <span className="mt-1 block text-[10px] text-muted-foreground/90">
                  Bars are illustrative; real Odoo orders appear in the table
                  below.
                </span>
              )}
            </p>
          </div>
          <div className="p-4 sm:p-5">
            <BarChartBlock />
          </div>
        </SurfaceCard>
      </div>

      <div className="grid gap-5 lg:grid-cols-5">
        <SurfaceCard elevated className="p-5 lg:col-span-2">
          <h2 className="text-base font-semibold tracking-tight">
            Category mix
          </h2>
          <p className="mt-1 mb-6 text-xs leading-relaxed text-muted-foreground">
            Share of outbound volume by merchandising class.
            {source === "odoo" && (
              <span className="mt-1 block text-[10px] text-muted-foreground/90">
                Demo split — wire category tags from Odoo for production charts.
              </span>
            )}
          </p>
          <DonutBlock />
        </SurfaceCard>

        <SurfaceCard elevated className="overflow-hidden p-0 lg:col-span-3">
          <div className="border-b border-border/60 bg-linear-to-r from-muted/40 via-muted/25 to-transparent px-5 py-4">
            <h2 className="text-base font-semibold tracking-tight">
              Recent sales orders
            </h2>
            <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
              {source === "odoo" && liveOrders.length > 0
                ? "Latest sale orders from your Odoo database (sample)."
                : "Latest notable movements and fulfillment state (demo)."}
            </p>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[480px] text-sm">
              <thead>
                <tr className="border-b border-border/60 bg-muted/30 text-left text-xs font-semibold tracking-wide text-muted-foreground uppercase">
                  <th className="px-5 py-3.5">Order</th>
                  <th className="px-5 py-3.5">Customer</th>
                  <th className="px-5 py-3.5 text-right">Amount</th>
                  <th className="px-5 py-3.5 text-right">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/50">
                {tableRows.map((row) => (
                  <tr
                    key={row.id}
                    className="transition-colors hover:bg-muted/40"
                  >
                    <td className="px-5 py-3.5 font-mono text-xs text-muted-foreground">
                      {row.id}
                    </td>
                    <td className="px-5 py-3.5 font-medium">{row.customer}</td>
                    <td className="px-5 py-3.5 text-right font-medium tabular-nums">
                      {row.amount}
                    </td>
                    <td className="px-5 py-3.5 text-right">
                      <span
                        className={cn(
                          "inline-flex rounded-full px-2.5 py-0.5 text-xs font-semibold",
                          orderStatusClass(row.status)
                        )}
                      >
                        {row.status}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </SurfaceCard>
      </div>
    </div>
  )
}
