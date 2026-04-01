"use client"

import * as React from "react"
import Link from "next/link"
import {
  Bar,
  BarChart,
  CartesianGrid,
  XAxis,
  YAxis,
} from "recharts"
import {
  RiArrowRightLine,
  RiCheckboxCircleFill,
  RiDownloadLine,
  RiFlashlightLine,
  RiInboxLine,
  RiLoader4Line,
  RiPulseLine,
  RiRefreshLine,
  RiStackLine,
  RiSurveyLine,
  RiTimeLine,
  RiTruckLine,
} from "@remixicon/react"

import { DataSourceBanner } from "@/components/data-source-banner"
import { PageHeader } from "@/components/page-header"
import { SurfaceCard } from "@/components/surface-card"
import { Button } from "@/components/ui/button"
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from "@/components/ui/chart"
import { useVariantsWithOdoo } from "@/hooks/use-variants-with-odoo"
import { cn } from "@/lib/utils"

type ZoneRow = {
  id: string
  name: string
  fill: number
  sku: number
  aisles: string
  openTasks: number
  tag: string
}

const INITIAL_ZONES: ZoneRow[] = [
  {
    id: "a",
    name: "Zone A — Fast movers",
    fill: 78,
    sku: 412,
    aisles: "A1–A4",
    openTasks: 5,
    tag: "Pick-optimized",
  },
  {
    id: "b",
    name: "Zone B — Bulk storage",
    fill: 54,
    sku: 1_028,
    aisles: "B1–B8",
    openTasks: 12,
    tag: "Pallet racking",
  },
  {
    id: "c",
    name: "Zone C — Cold chain",
    fill: 91,
    sku: 86,
    aisles: "C1–C2",
    openTasks: 3,
    tag: "Temp controlled",
  },
]

const WEEKLY_FLOW = [
  { day: "Mon", inbound: 142, outbound: 128 },
  { day: "Tue", inbound: 168, outbound: 151 },
  { day: "Wed", inbound: 155, outbound: 162 },
  { day: "Thu", inbound: 191, outbound: 174 },
  { day: "Fri", inbound: 178, outbound: 185 },
  { day: "Sat", inbound: 96, outbound: 88 },
  { day: "Sun", inbound: 72, outbound: 64 },
] as const

const flowChartConfig = {
  inbound: {
    label: "Inbound",
    color: "var(--primary)",
  },
  outbound: {
    label: "Outbound",
    color: "var(--chart-3)",
  },
} satisfies ChartConfig

type DockBay = { id: string; label: string; pct: number; status: string }

const INITIAL_DOCK_BAYS: DockBay[] = [
  { id: "d1", label: "Bay 1", pct: 82, status: "Loading" },
  { id: "d2", label: "Bay 2", pct: 45, status: "Available" },
  { id: "d3", label: "Bay 3", pct: 100, status: "At capacity" },
  { id: "d4", label: "Bay 4", pct: 64, status: "Unloading" },
]

type ActivityItem = {
  id: string
  at: string
  title: string
  detail: string
  tone: "default" | "success" | "warning"
}

const ACTIVITY_SEED: ActivityItem[] = [
  {
    id: "1",
    at: "08:12",
    title: "ASN confirmed",
    detail: "PO-4481 · 42 pallets expected dock side B",
    tone: "success",
  },
  {
    id: "2",
    at: "09:40",
    title: "Wave release",
    detail: "Wave W-19 · 318 lines across Zones A & B",
    tone: "default",
  },
  {
    id: "3",
    at: "10:05",
    title: "Cycle count variance",
    detail: "Aisle A3 · SKU ACC-221 adjusted +6 units",
    tone: "warning",
  },
  {
    id: "4",
    at: "11:22",
    title: "Outbound manifest",
    detail: "Truck T-14 sealed · 26 orders / 1.1k units",
    tone: "success",
  },
  {
    id: "5",
    at: "12:48",
    title: "Replenishment task",
    detail: "Zone B → forward pick · 14 tasks auto-created",
    tone: "default",
  },
]

function clamp(n: number, min: number, max: number) {
  return Math.min(max, Math.max(min, n))
}

function zoneHealth(fill: number): {
  label: string
  bar: string
  ring: string
} {
  if (fill >= 88)
    return {
      label: "Near capacity",
      bar: "from-amber-500/85 to-amber-600",
      ring: "text-amber-500",
    }
  if (fill >= 72)
    return {
      label: "Healthy load",
      bar: "from-primary/50 via-primary to-primary/95",
      ring: "text-primary",
    }
  return {
    label: "Headroom",
    bar: "from-emerald-500/70 to-emerald-600",
    ring: "text-emerald-600 dark:text-emerald-400",
  }
}

function useLiveClock() {
  const [now, setNow] = React.useState(() => new Date())
  React.useEffect(() => {
    const t = window.setInterval(() => setNow(new Date()), 1000)
    return () => window.clearInterval(t)
  }, [])
  return now
}

export function WarehouseDashboard() {
  const {
    variants: catalogVariants,
    source: dataSource,
    odooLoading,
    odooError,
    refetchOdoo,
  } = useVariantsWithOdoo()

  const [pallets, setPallets] = React.useState(3_842)
  const [receiving, setReceiving] = React.useState(214)
  const [poOpen, setPoOpen] = React.useState(14)
  const [dockPct, setDockPct] = React.useState(68)
  const [pickAccuracy] = React.useState(98.6)
  const [zones, setZones] = React.useState<ZoneRow[]>(INITIAL_ZONES)
  const [dockBays, setDockBays] = React.useState<DockBay[]>(INITIAL_DOCK_BAYS)
  const [refreshing, setRefreshing] = React.useState(false)
  const [banner, setBanner] = React.useState<string | null>(null)

  const clock = useLiveClock()
  const catalogUnits = catalogVariants.reduce((a, v) => a + v.onHand, 0)
  const isLiveCatalog = dataSource === "odoo"

  const showBanner = (msg: string) => {
    setBanner(msg)
    window.setTimeout(() => setBanner(null), 3200)
  }

  const refreshMetrics = async () => {
    setRefreshing(true)
    await new Promise((r) => setTimeout(r, 650))
    setPallets((n) => clamp(n + Math.round((Math.random() - 0.4) * 40), 3700, 4100))
    setReceiving((n) => clamp(n + Math.round((Math.random() - 0.35) * 30), 180, 260))
    setPoOpen((n) => clamp(n + Math.round((Math.random() - 0.5) * 4), 8, 22))
    setDockPct((n) => clamp(Math.round(n + (Math.random() - 0.5) * 8), 55, 82))
    setZones((zs) =>
      zs.map((z) => ({
        ...z,
        fill: clamp(
          Math.round(z.fill + (Math.random() - 0.5) * 4),
          40,
          95
        ),
        openTasks: clamp(
          z.openTasks + Math.round((Math.random() - 0.6) * 2),
          0,
          24
        ),
      }))
    )
    setDockBays((bays) =>
      bays.map((b) => ({
        ...b,
        pct: clamp(Math.round(b.pct + (Math.random() - 0.5) * 12), 20, 100),
      }))
    )
    setRefreshing(false)
    showBanner("Floor metrics refreshed (demo simulation).")
  }

  const exportZonesCsv = () => {
    const rows = [
      ["zone", "fill_pct", "skus", "aisles", "open_tasks"],
      ...zones.map((z) => [
        z.name,
        String(z.fill),
        String(z.sku),
        z.aisles,
        String(z.openTasks),
      ]),
    ]
    const blob = new Blob([rows.map((r) => r.join(",")).join("\n")], {
      type: "text/csv;charset=utf-8",
    })
    const a = document.createElement("a")
    a.href = URL.createObjectURL(blob)
    a.download = `warehouse-zones-${new Date().toISOString().slice(0, 10)}.csv`
    a.click()
    URL.revokeObjectURL(a.href)
    showBanner("Zone export downloaded.")
  }

  const scheduleDockPush = () => {
    showBanner("Dock window broadcast queued (demo). Coordinate in Odoo or your WMS.")
  }

  const runCycleCount = (zoneId: string) => {
    setZones((zs) =>
      zs.map((z) =>
        z.id === zoneId
          ? {
              ...z,
              openTasks: Math.max(0, z.openTasks - 1),
              fill: clamp(z.fill + Math.round((Math.random() - 0.5) * 3), 35, 96),
            }
          : z
      )
    )
    showBanner("Cycle count logged for zone (demo).")
  }

  return (
    <div className="flex flex-1 flex-col gap-5 px-4 py-5 pb-14 md:gap-6 md:px-6 md:py-6">
      {banner && (
        <div
          className="animate-in fade-in slide-in-from-top-1 rounded-xl border border-primary/30 bg-primary/10 px-4 py-2.5 text-center text-sm font-medium text-primary shadow-sm duration-200"
          role="status"
        >
          {banner}
        </div>
      )}

      <section
        className="relative overflow-hidden rounded-2xl border border-border/70 bg-card/95 p-5 shadow-md shadow-primary/[0.06] ring-1 ring-black/[0.04] md:p-6 dark:bg-card/90 dark:ring-white/[0.06]"
        aria-labelledby="wh-heading"
      >
        <div
          className="pointer-events-none absolute -right-20 -top-28 size-[24rem] rounded-full bg-primary/[0.11] blur-3xl dark:bg-primary/18"
          aria-hidden
        />
        <div
          className="pointer-events-none absolute bottom-0 left-1/3 size-56 rounded-full bg-emerald-500/[0.06] blur-2xl"
          aria-hidden
        />

        <div className="relative flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
          <PageHeader
            id="wh-heading"
            eyebrow="Floor control"
            title="Warehouse operations"
            description="A single pane for capacity, dock pressure, and zone health—built for executive walkthroughs. Demo metrics pulse on refresh; inventory links to your live or demo catalog."
            className="lg:max-w-2xl"
          />
          <div className="flex flex-col items-start gap-3 sm:items-end">
            <div className="flex flex-wrap items-center justify-end gap-2">
              <span
                className="inline-flex items-center gap-2 rounded-full border border-border/70 bg-background/80 px-3 py-1.5 text-xs font-semibold shadow-sm backdrop-blur-sm"
                title="Local facility time"
              >
                <RiTimeLine className="size-3.5 text-primary" aria-hidden />
                <span className="font-mono tabular-nums text-foreground">
                  {clock.toLocaleTimeString(undefined, {
                    hour: "2-digit",
                    minute: "2-digit",
                    second: "2-digit",
                  })}
                </span>
              </span>
              <span className="inline-flex items-center gap-1.5 rounded-full border border-primary/25 bg-primary/10 px-3 py-1 text-[11px] font-semibold uppercase tracking-wide text-primary">
                <span
                  className="relative flex size-2"
                  aria-hidden
                >
                  <span className="absolute inline-flex size-full animate-ping rounded-full bg-primary/50 opacity-60" />
                  <span className="relative inline-flex size-2 rounded-full bg-primary" />
                </span>
                Floor live
              </span>
            </div>
            <div className="flex flex-wrap justify-end gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="gap-1.5 shadow-sm"
                disabled={refreshing}
                onClick={() => void refreshMetrics()}
              >
                {refreshing ? (
                  <RiLoader4Line className="size-3.5 animate-spin" aria-hidden />
                ) : (
                  <RiRefreshLine className="size-3.5" aria-hidden />
                )}
                Refresh floor
              </Button>
              <Button
                type="button"
                variant="secondary"
                size="sm"
                className="gap-1.5 shadow-sm"
                onClick={exportZonesCsv}
              >
                <RiDownloadLine className="size-3.5" aria-hidden />
                Export zones
              </Button>
              <Button type="button" size="sm" className="gap-1.5 shadow-md" asChild>
                <Link href="/inventory">
                  Open inventory
                  <RiArrowRightLine className="size-3.5 opacity-90" aria-hidden />
                </Link>
              </Button>
            </div>
          </div>
        </div>
      </section>

      <DataSourceBanner
        source={dataSource}
        loading={odooLoading}
        error={odooError}
        onRefresh={refetchOdoo}
      />

      {isLiveCatalog && (
        <SurfaceCard
          elevated
          className="border-emerald-500/20 bg-linear-to-br from-emerald-500/[0.07] via-card to-card p-4 ring-1 ring-emerald-500/15"
        >
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div className="flex items-start gap-3">
              <span className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-emerald-500/15 text-emerald-700 shadow-sm ring-1 ring-emerald-500/25 dark:text-emerald-400">
                <RiStackLine className="size-5" aria-hidden />
              </span>
              <div>
                <p className="text-sm font-semibold text-foreground">
                  Catalog linked from Odoo
                </p>
                <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
                  {catalogVariants.length.toLocaleString()} stockable variants ·{" "}
                  {catalogUnits.toLocaleString()} units on hand (same feed as
                  Inventory). Use this page for floor narrative; Inventory for
                  SKU-level detail.
                </p>
              </div>
            </div>
            <Button size="sm" variant="outline" className="shrink-0 gap-1" asChild>
              <Link href="/inventory">
                View SKUs
                <RiArrowRightLine className="size-3.5" aria-hidden />
              </Link>
            </Button>
          </div>
        </SurfaceCard>
      )}

      <section
        className="relative overflow-hidden rounded-xl border border-border/60 bg-muted/20 p-4 ring-1 ring-border/40 md:p-5"
        aria-label="Shortcuts"
      >
        <div className="flex flex-wrap items-center gap-3">
          <RiFlashlightLine className="size-4 text-primary" aria-hidden />
          <p className="text-sm font-semibold text-foreground">Quick paths</p>
        </div>
        <p className="mt-1 max-w-3xl text-xs leading-relaxed text-muted-foreground">
          Tie this view to your story: receiving and PO follow-up on Signals,
          demand and forecast on Trends, stock truth on Inventory.
        </p>
        <div className="mt-4 flex flex-wrap gap-2">
          <Button asChild variant="default" size="sm" className="shadow-sm">
            <Link href="/signals">
              Receiving &amp; PO signals
              <RiArrowRightLine className="size-3.5 opacity-90" aria-hidden />
            </Link>
          </Button>
          <Button asChild variant="outline" size="sm">
            <Link href="/trends">Throughput &amp; trends</Link>
          </Button>
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="gap-1.5"
            onClick={scheduleDockPush}
          >
            <RiTruckLine className="size-3.5" aria-hidden />
            Dock broadcast (demo)
          </Button>
        </div>
      </section>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Link
          href="/inventory"
          className="group block rounded-2xl outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
        >
          <SurfaceCard
            elevated
            className="relative h-full overflow-hidden p-4 transition-all duration-200 hover:-translate-y-0.5 hover:border-primary/30 hover:shadow-md hover:shadow-primary/12"
          >
            <div
              className="pointer-events-none absolute inset-x-0 top-0 h-px bg-linear-to-r from-transparent via-primary/40 to-transparent opacity-0 transition-opacity group-hover:opacity-100"
              aria-hidden
            />
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <span className="flex size-12 items-center justify-center rounded-2xl bg-primary/14 text-primary shadow-sm ring-1 ring-primary/20 transition-transform duration-200 group-hover:scale-105">
                  <RiStackLine className="size-[1.35rem]" aria-hidden />
                </span>
                <div>
                  <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                    Total pallets
                  </p>
                  <p className="mt-0.5 text-3xl font-semibold tabular-nums tracking-tight">
                    {pallets.toLocaleString()}
                  </p>
                </div>
              </div>
              <RiArrowRightLine className="size-4 shrink-0 text-primary opacity-0 transition-opacity group-hover:opacity-100" />
            </div>
            <p className="mt-4 text-xs leading-relaxed text-muted-foreground">
              12 active aisles · forward + reserve mix
            </p>
          </SurfaceCard>
        </Link>

        <Link
          href="/signals"
          className="group block rounded-2xl outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
        >
          <SurfaceCard
            elevated
            className="relative h-full overflow-hidden p-4 transition-all duration-200 hover:-translate-y-0.5 hover:border-primary/30 hover:shadow-md hover:shadow-primary/12"
          >
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <span className="flex size-12 items-center justify-center rounded-2xl bg-primary/14 text-primary shadow-sm ring-1 ring-primary/20 transition-transform duration-200 group-hover:scale-105">
                  <RiInboxLine className="size-[1.35rem]" aria-hidden />
                </span>
                <div>
                  <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                    Receiving today
                  </p>
                  <p className="mt-0.5 text-3xl font-semibold tabular-nums tracking-tight">
                    {receiving}
                  </p>
                </div>
              </div>
              <RiArrowRightLine className="size-4 shrink-0 text-primary opacity-0 transition-opacity group-hover:opacity-100" />
            </div>
            <p className="mt-4 text-xs leading-relaxed text-muted-foreground">
              <span className="font-semibold text-foreground">{poOpen}</span> POs
              in flight · align with Signals queue
            </p>
          </SurfaceCard>
        </Link>

        <SurfaceCard elevated className="p-4">
          <div className="flex items-start justify-between gap-2">
            <div>
              <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                Dock utilization
              </p>
              <p className="mt-1 text-3xl font-semibold tabular-nums tracking-tight">
                {dockPct}%
              </p>
            </div>
            <Button
              type="button"
              variant="ghost"
              size="icon-sm"
              className="shrink-0 text-muted-foreground"
              onClick={() =>
                setDockPct((n) =>
                  clamp(n + Math.round((Math.random() - 0.5) * 10), 50, 90)
                )
              }
              aria-label="Adjust dock sample"
            >
              <RiRefreshLine className="size-4" />
            </Button>
          </div>
          <div className="mt-4 h-3 overflow-hidden rounded-full bg-muted/90 ring-1 ring-inset ring-border/50">
            <div
              className="h-full rounded-full bg-linear-to-r from-primary/55 via-primary to-primary/90 shadow-md shadow-primary/30 transition-[width] duration-500 ease-out"
              style={{ width: `${dockPct}%` }}
            />
          </div>
          <p className="mt-3 text-xs leading-relaxed text-muted-foreground">
            Typical peak 10am–2pm · broadcast to align dock windows
          </p>
        </SurfaceCard>

        <SurfaceCard elevated className="p-4">
          <div className="flex items-start gap-3">
            <span className="flex size-12 shrink-0 items-center justify-center rounded-2xl bg-emerald-500/12 text-emerald-700 ring-1 ring-emerald-500/20 dark:text-emerald-400">
              <RiCheckboxCircleFill className="size-6" aria-hidden />
            </span>
            <div>
              <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                Pick accuracy (7d)
              </p>
              <p className="mt-1 text-3xl font-semibold tabular-nums tracking-tight">
                {pickAccuracy}%
              </p>
              <p className="mt-3 text-xs leading-relaxed text-muted-foreground">
                First-pass pick rate · demo benchmark for client Q&amp;A
              </p>
            </div>
          </div>
        </SurfaceCard>
      </div>

      <div className="grid gap-4 lg:grid-cols-5">
        <SurfaceCard
          elevated
          className="overflow-hidden p-0 lg:col-span-3"
        >
          <div className="border-b border-border/60 bg-linear-to-r from-muted/50 via-muted/25 to-transparent px-4 py-3">
            <div className="flex flex-wrap items-end justify-between gap-3">
              <div>
                <h2 className="text-base font-semibold tracking-tight">
                  Inbound vs outbound
                </h2>
                <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
                  Seven-day movement index (illustrative) — pairs with Trends
                  for narrative depth.
                </p>
              </div>
              <span className="inline-flex items-center gap-1.5 rounded-full bg-background/90 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground ring-1 ring-border/60">
                <RiPulseLine className="size-3 text-primary" aria-hidden />
                Demo series
              </span>
            </div>
          </div>
          <div className="p-3 sm:p-4">
            <ChartContainer
              config={flowChartConfig}
              className="aspect-auto h-[min(280px,38vh)] min-h-[220px] w-full"
              initialDimension={{ width: 520, height: 260 }}
            >
              <BarChart
                accessibilityLayer
                data={[...WEEKLY_FLOW]}
                margin={{ left: 4, right: 8, top: 12, bottom: 0 }}
              >
                <CartesianGrid vertical={false} strokeDasharray="3 3" />
                <XAxis
                  dataKey="day"
                  tickLine={false}
                  axisLine={false}
                  tickMargin={10}
                />
                <YAxis
                  tickLine={false}
                  axisLine={false}
                  width={36}
                  tickMargin={8}
                />
                <ChartTooltip content={<ChartTooltipContent />} />
                <Bar
                  dataKey="inbound"
                  fill="var(--color-inbound)"
                  radius={[4, 4, 0, 0]}
                  maxBarSize={28}
                />
                <Bar
                  dataKey="outbound"
                  fill="var(--color-outbound)"
                  radius={[4, 4, 0, 0]}
                  maxBarSize={28}
                />
              </BarChart>
            </ChartContainer>
          </div>
        </SurfaceCard>

        <SurfaceCard elevated className="p-0 lg:col-span-2">
          <div className="border-b border-border/60 bg-linear-to-r from-muted/45 to-transparent px-4 py-3">
            <h2 className="text-base font-semibold tracking-tight">
              Dock bays
            </h2>
            <p className="mt-1 text-xs text-muted-foreground">
              Live-style occupancy (demo). Tap shuffle on dock card to remix.
            </p>
          </div>
          <ul className="divide-y divide-border/50 p-2">
            {dockBays.map((b) => (
              <li key={b.id} className="px-3 py-3.5">
                <div className="mb-2 flex items-center justify-between gap-2">
                  <span className="text-sm font-semibold">{b.label}</span>
                  <span
                    className={cn(
                      "text-[11px] font-semibold",
                      b.pct >= 95
                        ? "text-amber-700 dark:text-amber-400"
                        : "text-muted-foreground"
                    )}
                  >
                    {b.status}
                  </span>
                </div>
                <div className="h-2 overflow-hidden rounded-full bg-muted/80 ring-1 ring-inset ring-border/40">
                  <div
                    className={cn(
                      "h-full rounded-full transition-all duration-500",
                      b.pct >= 95
                        ? "bg-linear-to-r from-amber-500/80 to-amber-600"
                        : "bg-linear-to-r from-primary/50 to-primary/90"
                    )}
                    style={{ width: `${b.pct}%` }}
                  />
                </div>
                <p className="mt-1.5 text-right text-[10px] font-mono tabular-nums text-muted-foreground">
                  {b.pct}% occupied
                </p>
              </li>
            ))}
          </ul>
        </SurfaceCard>
      </div>

      <div>
        <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
          <div>
            <h2 className="text-lg font-semibold tracking-tight">
              Zone utilization
            </h2>
            <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
              Storage-class view with health cues. Actions are demo-only until
              your WMS or Odoo warehouse app is wired.
            </p>
          </div>
        </div>
        <div className="grid gap-4 md:grid-cols-3">
          {zones.map((z) => {
            const h = zoneHealth(z.fill)
            return (
              <SurfaceCard
                key={z.id}
                elevated
                className="relative overflow-hidden p-0"
              >
                <div
                  className={cn(
                    "h-1.5 w-full bg-linear-to-r",
                    z.fill >= 88
                      ? "from-amber-500/90 to-amber-600"
                      : z.fill >= 72
                        ? "from-primary/70 to-primary"
                        : "from-emerald-500/80 to-emerald-600"
                  )}
                  aria-hidden
                />
                <div className="p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-xs font-medium text-muted-foreground">
                        {z.tag}
                      </p>
                      <h3 className="mt-1 font-semibold leading-snug">
                        {z.name}
                      </h3>
                    </div>
                    <div
                      className={cn(
                        "flex size-14 shrink-0 items-center justify-center rounded-2xl bg-muted/50 text-lg font-bold tabular-nums ring-1 ring-border/60",
                        h.ring
                      )}
                      aria-hidden
                    >
                      {z.fill}%
                    </div>
                  </div>
                  <div className="mt-4 h-2.5 overflow-hidden rounded-full bg-muted/80 ring-1 ring-inset ring-border/45">
                    <div
                      className={cn(
                        "h-full rounded-full bg-linear-to-r shadow-md transition-all duration-500",
                        h.bar
                      )}
                      style={{ width: `${z.fill}%` }}
                    />
                  </div>
                  <p className="mt-2 text-[11px] font-medium text-muted-foreground">
                    {h.label} · {z.sku.toLocaleString()} SKUs · {z.aisles}
                  </p>
                  <p className="mt-1 text-[11px] text-muted-foreground">
                    {z.openTasks} open tasks (pick / replen / count)
                  </p>
                  <div className="mt-4 flex flex-wrap gap-2">
                    <Button
                      type="button"
                      size="sm"
                      variant="secondary"
                      className="gap-1.5"
                      onClick={() => runCycleCount(z.id)}
                    >
                      <RiSurveyLine className="size-3.5" aria-hidden />
                      Log cycle count
                    </Button>
                    <Button type="button" size="sm" variant="outline" asChild>
                      <Link href="/inventory">SKUs</Link>
                    </Button>
                  </div>
                </div>
              </SurfaceCard>
            )
          })}
        </div>
      </div>

      <SurfaceCard elevated className="overflow-hidden p-0">
        <div className="border-b border-border/60 bg-linear-to-r from-muted/45 via-muted/20 to-transparent px-4 py-3">
          <h2 className="text-base font-semibold tracking-tight">
            Today on the floor
          </h2>
          <p className="mt-1 text-xs text-muted-foreground">
            Representative activity stream for stakeholder demos — not live ERP
            data.
          </p>
        </div>
        <ul className="divide-y divide-border/50">
          {ACTIVITY_SEED.map((item, i) => (
            <li
              key={item.id}
              className="flex gap-4 px-4 py-3 transition-colors hover:bg-muted/20"
            >
              <span className="flex w-14 shrink-0 flex-col items-center gap-1 border-r border-border/40 pr-4 text-center">
                <span className="font-mono text-xs font-semibold tabular-nums text-primary">
                  {item.at}
                </span>
                {i === 0 && (
                  <span className="text-[9px] font-bold uppercase tracking-wider text-muted-foreground">
                    Now
                  </span>
                )}
              </span>
              <div className="min-w-0 flex-1 pt-0.5">
                <div className="flex flex-wrap items-center gap-2">
                  <p className="font-medium leading-snug">{item.title}</p>
                  {item.tone === "success" && (
                    <span className="rounded-full bg-emerald-500/12 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-emerald-800 dark:text-emerald-300">
                      OK
                    </span>
                  )}
                  {item.tone === "warning" && (
                    <span className="rounded-full bg-amber-500/15 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-amber-900 dark:text-amber-300">
                      Review
                    </span>
                  )}
                </div>
                <p className="mt-1 text-sm leading-relaxed text-muted-foreground">
                  {item.detail}
                </p>
              </div>
            </li>
          ))}
        </ul>
      </SurfaceCard>
    </div>
  )
}
