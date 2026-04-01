"use client"

import * as React from "react"
import Link from "next/link"
import {
  RiArrowRightLine,
  RiDownloadLine,
  RiInboxLine,
  RiLoader4Line,
  RiRefreshLine,
  RiStackLine,
  RiSurveyLine,
  RiTruckLine,
} from "@remixicon/react"

import { PageHeader } from "@/components/page-header"
import { SurfaceCard } from "@/components/surface-card"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"

type ZoneRow = {
  id: string
  name: string
  fill: number
  sku: number
  aisles: string
  openTasks: number
}

const INITIAL_ZONES: ZoneRow[] = [
  {
    id: "a",
    name: "A — Fast movers",
    fill: 78,
    sku: 412,
    aisles: "A1–A4",
    openTasks: 5,
  },
  {
    id: "b",
    name: "B — Bulk storage",
    fill: 54,
    sku: 1_028,
    aisles: "B1–B8",
    openTasks: 12,
  },
  {
    id: "c",
    name: "C — Cold chain",
    fill: 91,
    sku: 86,
    aisles: "C1–C2",
    openTasks: 3,
  },
]

function clamp(n: number, min: number, max: number) {
  return Math.min(max, Math.max(min, n))
}

export function WarehouseDashboard() {
  const [pallets, setPallets] = React.useState(3_842)
  const [receiving, setReceiving] = React.useState(214)
  const [poOpen, setPoOpen] = React.useState(14)
  const [dockPct, setDockPct] = React.useState(68)
  const [zones, setZones] = React.useState<ZoneRow[]>(INITIAL_ZONES)
  const [refreshing, setRefreshing] = React.useState(false)
  const [banner, setBanner] = React.useState<string | null>(null)

  const showBanner = (msg: string) => {
    setBanner(msg)
    window.setTimeout(() => setBanner(null), 3200)
  }

  const refreshMetrics = async () => {
    setRefreshing(true)
    await new Promise((r) => setTimeout(r, 600))
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
    setRefreshing(false)
    showBanner("Floor metrics refreshed (demo).")
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
    showBanner("Dock window broadcast queued (demo). Notify team in Odoo next.")
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
    showBanner("Cycle count task logged for zone (demo).")
  }

  return (
    <div className="flex flex-1 flex-col gap-6 px-4 py-6 pb-14 md:gap-8 md:px-6 md:py-8">
      {banner && (
        <div
          className="rounded-xl border border-primary/25 bg-primary/10 px-4 py-2 text-center text-sm font-medium text-primary"
          role="status"
        >
          {banner}
        </div>
      )}

      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <PageHeader
          title="Warehouse"
          description="Capacity, dock activity, and zone utilization—refresh for a live-style pulse, export zones, and jump to inventory or signals."
          className="lg:max-w-2xl"
        />
        <div className="flex flex-wrap gap-2 lg:shrink-0">
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
            Refresh metrics
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

      <section
        className="relative overflow-hidden rounded-3xl border border-border/70 bg-card/90 p-5 shadow-lg shadow-primary/[0.06] ring-1 ring-black/[0.04] dark:ring-white/[0.06] md:p-6"
        aria-label="Quick links"
      >
        <div
          className="pointer-events-none absolute -right-16 -top-16 size-48 rounded-full bg-primary/10 blur-3xl"
          aria-hidden
        />
        <p className="relative text-xs font-semibold text-muted-foreground">
          Floor shortcuts
        </p>
        <div className="relative mt-3 flex flex-wrap gap-2">
          <Button asChild variant="outline" size="sm">
            <Link href="/signals">Receiving &amp; PO signals</Link>
          </Button>
          <Button asChild variant="outline" size="sm">
            <Link href="/trends">Throughput trends</Link>
          </Button>
          <Button type="button" variant="ghost" size="sm" onClick={scheduleDockPush}>
            <RiTruckLine className="size-3.5" aria-hidden />
            Dock broadcast
          </Button>
        </div>
      </section>

      <div className="grid gap-4 md:grid-cols-3">
        <Link
          href="/inventory"
          className="group block rounded-2xl outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
        >
          <SurfaceCard
            elevated
            className="h-full p-6 transition-all duration-200 hover:-translate-y-0.5 hover:border-primary/25 hover:shadow-lg hover:shadow-primary/10"
          >
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <span className="flex size-11 items-center justify-center rounded-xl bg-primary/14 text-primary shadow-sm ring-1 ring-primary/20 transition-transform group-hover:scale-105">
                  <RiStackLine className="size-5" aria-hidden />
                </span>
                <div>
                  <p className="text-sm font-medium text-muted-foreground">
                    Total pallets
                  </p>
                  <p className="mt-0.5 text-3xl font-semibold tabular-nums tracking-tight">
                    {pallets.toLocaleString()}
                  </p>
                </div>
              </div>
              <RiArrowRightLine className="size-4 text-primary opacity-0 transition-opacity group-hover:opacity-100" />
            </div>
            <p className="mt-4 text-xs leading-relaxed text-muted-foreground">
              Across 12 active aisles · click for variant-level stock
            </p>
          </SurfaceCard>
        </Link>

        <Link
          href="/signals"
          className="group block rounded-2xl outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
        >
          <SurfaceCard
            elevated
            className="h-full p-6 transition-all duration-200 hover:-translate-y-0.5 hover:border-primary/25 hover:shadow-lg hover:shadow-primary/10"
          >
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <span className="flex size-11 items-center justify-center rounded-xl bg-primary/14 text-primary shadow-sm ring-1 ring-primary/20 transition-transform group-hover:scale-105">
                  <RiInboxLine className="size-5" aria-hidden />
                </span>
                <div>
                  <p className="text-sm font-medium text-muted-foreground">
                    Receiving today
                  </p>
                  <p className="mt-0.5 text-3xl font-semibold tabular-nums tracking-tight">
                    {receiving}
                  </p>
                </div>
              </div>
              <RiArrowRightLine className="size-4 text-primary opacity-0 transition-opacity group-hover:opacity-100" />
            </div>
            <p className="mt-4 text-xs leading-relaxed text-muted-foreground">
              {poOpen} purchase orders in progress · open signals queue
            </p>
          </SurfaceCard>
        </Link>

        <SurfaceCard elevated className="p-6">
          <div className="flex items-start justify-between gap-2">
            <div>
              <p className="text-sm font-medium text-muted-foreground">
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
                setDockPct((n) => clamp(n + Math.round((Math.random() - 0.5) * 10), 50, 90))
              }
              aria-label="Shuffle dock sample"
            >
              <RiRefreshLine className="size-4" />
            </Button>
          </div>
          <div className="mt-4 h-3 overflow-hidden rounded-full bg-muted/80 ring-1 ring-inset ring-border/50">
            <div
              className="h-full rounded-full bg-linear-to-r from-primary/60 via-primary to-primary/90 shadow-md shadow-primary/25 transition-[width] duration-500"
              style={{ width: `${dockPct}%` }}
            />
          </div>
          <p className="mt-3 text-xs leading-relaxed text-muted-foreground">
            Peaks between 10am–2pm local · use Dock broadcast to ping the floor
          </p>
        </SurfaceCard>
      </div>

      <SurfaceCard elevated className="overflow-hidden p-0">
        <div className="flex flex-col gap-3 border-b border-border/60 bg-linear-to-r from-muted/45 via-muted/25 to-transparent px-6 py-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="text-base font-semibold tracking-tight">
              Zone utilization
            </h2>
            <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
              Estimated fill by storage class — actions are demo-only until Odoo
              sync is wired.
            </p>
          </div>
        </div>
        <ul className="divide-y divide-border/50">
          {zones.map((z) => (
            <li
              key={z.id}
              className="flex flex-col gap-4 px-6 py-5 transition-colors hover:bg-muted/25 md:flex-row md:items-center md:justify-between md:gap-6"
            >
              <div className="min-w-0 flex-1 space-y-3">
                <div className="flex flex-wrap items-baseline justify-between gap-2">
                  <span className="font-semibold">{z.name}</span>
                  <span className="tabular-nums text-xs font-semibold text-muted-foreground">
                    {z.fill}% · {z.sku.toLocaleString()} SKUs · {z.aisles}
                  </span>
                </div>
                <div className="h-3 overflow-hidden rounded-full bg-muted/70 ring-1 ring-inset ring-border/45">
                  <div
                    className={cn(
                      "h-full rounded-full bg-linear-to-r shadow-md transition-all duration-500",
                      z.fill >= 85
                        ? "from-amber-500/80 to-amber-600 shadow-amber-500/20"
                        : "from-primary/55 via-primary to-primary/90 shadow-primary/20"
                    )}
                    style={{ width: `${z.fill}%` }}
                  />
                </div>
                <p className="text-[11px] text-muted-foreground">
                  {z.openTasks} open warehouse tasks (picks / replen / count)
                </p>
              </div>
              <div className="flex shrink-0 flex-wrap gap-2 md:flex-col md:items-stretch">
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
                  <Link href="/inventory">View SKUs</Link>
                </Button>
              </div>
            </li>
          ))}
        </ul>
      </SurfaceCard>
    </div>
  )
}
