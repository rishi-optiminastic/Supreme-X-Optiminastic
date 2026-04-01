"use client"

import * as React from "react"
import {
  RiDownloadLine,
  RiFilter3Line,
  RiRefreshLine,
  RiShoppingCartLine,
} from "@remixicon/react"
import { DataSourceBanner } from "@/components/data-source-banner"
import { useAppData } from "@/components/app-data-context"
import { PageHeader } from "@/components/page-header"
import { SurfaceCard } from "@/components/surface-card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { ProductThumbnail } from "@/components/product-thumbnail"
import { downloadVariantsCsv } from "@/lib/export-variants-csv"
import { useVariantsWithOdoo } from "@/hooks/use-variants-with-odoo"

type Filter = "all" | "low" | "high_trend"

export function InventoryDashboard() {
  const {
    variants,
    source,
    odooLoading,
    odooError,
    refetchOdoo,
  } = useVariantsWithOdoo()
  const {
    refreshStockSnapshot,
    exportVariantsCsv,
    flagReorder,
    simulateVariantSale,
  } = useAppData()

  const isLive = source === "odoo"
  const [filter, setFilter] = React.useState<Filter>("all")
  const [query, setQuery] = React.useState("")

  const filtered = React.useMemo(() => {
    let rows = variants
    if (filter === "low") rows = rows.filter((v) => v.weeksCover < 2)
    if (filter === "high_trend") rows = rows.filter((v) => v.trendScore >= 75)
    const q = query.trim().toLowerCase()
    if (q) {
      rows = rows.filter(
        (v) =>
          v.sku.toLowerCase().includes(q) ||
          v.productName.toLowerCase().includes(q) ||
          v.attributes.toLowerCase().includes(q)
      )
    }
    return rows
  }, [variants, filter, query])
  const onExport = () => {
    if (isLive) {
      downloadVariantsCsv(variants, "odoo-inventory")
    } else {
      exportVariantsCsv()
    }
  }

  const totalOnHand = variants.reduce((a, v) => a + v.onHand, 0)
  const lowCount = variants.filter((v) => v.weeksCover < 1.5).length
  const atRiskUnits = variants
    .filter((v) => v.weeksCover < 1.5)
    .reduce((a, v) => a + v.onHand, 0)

  return (
    <div className="flex flex-1 flex-col gap-5 px-4 py-5 pb-10 md:gap-6 md:px-6 md:py-6">
      {/* <DataSourceBanner
        source={source}
        loading={odooLoading}
        error={odooError}
        onRefresh={refetchOdoo}
      /> */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <PageHeader
          title="Inventory & stock"
          description={
            isLive
              ? "Stock levels from your Odoo products (read-only). Use demo workspace (disconnect Odoo or empty catalog) to simulate sales and signals."
              : "Current stock analysis by variant. Actions update local demo state and sync with Signals & Trends."
          }
          className="sm:max-w-2xl"
        />
        <div className="flex flex-wrap gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="gap-1.5"
            onClick={() => refreshStockSnapshot()}
          >
            <RiRefreshLine className="size-3.5" aria-hidden />
            Refresh snapshot
          </Button>
          <Button
            type="button"
            variant="secondary"
            size="sm"
            className="gap-1.5"
            onClick={onExport}
          >
            <RiDownloadLine className="size-3.5" aria-hidden />
            Export CSV
          </Button>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <SurfaceCard className="p-4">
          <p className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">
            On hand (all variants)
          </p>
          <p className="mt-2 text-3xl font-semibold tabular-nums">
            {totalOnHand.toLocaleString()}
          </p>
          <p className="mt-1 text-xs text-muted-foreground">
            units across SKUs
          </p>
        </SurfaceCard>
        <SurfaceCard className="p-4">
          <p className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">
            Low cover (&lt; 1.5 wk)
          </p>
          <p className="mt-2 text-3xl font-semibold text-amber-700 tabular-nums dark:text-amber-400">
            {lowCount}
          </p>
          <p className="mt-1 text-xs text-muted-foreground">
            {atRiskUnits.toLocaleString()} units at risk
          </p>
        </SurfaceCard>
        <SurfaceCard className="p-4">
          <p className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">
            Analysis focus
          </p>
          <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
          {isLive
              ? "Create purchase signals from the Signals page using this live picture."
              : "Use filters and Flag reorder to push purchase signals. Simulate sales to stress-test cover."}

          </p>
        </SurfaceCard>
      </div>

      <SurfaceCard className="overflow-hidden p-0">
        <div className="flex flex-col gap-3 border-b border-border/60 bg-muted/20 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="text-base font-semibold tracking-tight">
              Variants &amp; trend linkage
            </h2>
            <p className="mt-1 text-xs text-muted-foreground">
              Each row is a sellable variant. Trend score feeds Market/System
              models on the Trends page.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
              <RiFilter3Line className="size-3.5" aria-hidden />
              Filter
            </span>
            {(
              [
                ["all", "All"],
                ["low", "Low cover"],
                ["high_trend", "High trend"],
              ] as const
            ).map(([key, label]) => (
              <Button
                key={key}
                type="button"
                size="xs"
                variant={filter === key ? "default" : "outline"}
                onClick={() => setFilter(key)}
              >
                {label}
              </Button>
            ))}
          </div>
        </div>
        <div className="border-b border-border/50 px-4 py-2.5">
          <Input
            placeholder="Search SKU, product, or variant…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="max-w-md"
          />
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[800px] text-sm">
            <thead>
              <tr className="border-b border-border/60 bg-muted/25 text-left text-xs font-semibold tracking-wide text-muted-foreground uppercase">
                <th className="w-14 px-3 py-3 pl-5">Photo</th>
                <th className="px-4 py-2.5">SKU / Variant</th>
                <th className="px-4 py-2.5 text-right">On hand</th>
                <th className="px-4 py-2.5 text-right">Reserved</th>
                <th className="px-4 py-2.5 text-right">Inbound</th>
                <th className="px-4 py-2.5 text-right">Wk cover</th>
                <th className="px-4 py-2.5 text-right">Trend</th>
                <th className="px-4 py-2.5 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/50">
              {filtered.map((v) => (
                <tr key={v.id} className="hover:bg-muted/30">
                  <td className="px-3 py-3 pl-5 align-middle">
                    <ProductThumbnail variant={v} size="md" />
                  </td>
                  <td className="px-4 py-2.5">
                    <p className="font-mono text-xs text-muted-foreground">
                      {v.sku}
                    </p>
                    <p className="font-medium">{v.productName}</p>
                    <p className="text-xs text-muted-foreground">
                      {v.attributes}
                    </p>
                  </td>
                  <td className="px-4 py-2.5 text-right font-medium tabular-nums">
                    {v.onHand}
                  </td>
                  <td className="px-4 py-2.5 text-right text-muted-foreground tabular-nums">
                    {v.reserved}
                  </td>
                  <td className="px-4 py-2.5 text-right text-muted-foreground tabular-nums">
                    {v.inbound}
                  </td>
                  <td className="px-4 py-2.5 text-right tabular-nums">
                    <span
                      className={
                        v.weeksCover < 1.5
                          ? "font-semibold text-amber-700 dark:text-amber-400"
                          : ""
                      }
                    >
                      {v.weeksCover}
                    </span>
                  </td>
                  <td className="px-4 py-2.5 text-right">
                    <span className="relative inline-flex min-w-10 items-center justify-end rounded-md bg-primary/10 px-2 py-0.5 font-mono text-xs font-semibold text-primary">
                      <span className="absolute top-1/2 left-0 ml-2 h-3 w-1 -translate-y-1/2 rounded-full bg-primary" />
                      <span className="pl-2">{v.trendScore}</span>
                    </span>
                  </td>
                  <td className="px-4 py-2.5 text-right">
                    <div className="flex flex-wrap justify-end gap-1.5">
                      <Button
                        type="button"
                        size="xs"
                        variant="secondary"
                        className="gap-1"
                        onClick={() => flagReorder(v.id)}
                        title={isLive ? "Create purchase signal from Signals page" : "Creates a purchase signal"}
                      >
                        <RiShoppingCartLine className="size-3" aria-hidden />
                        Flag reorder
                      </Button>
                      <Button
                        type="button"
                        size="xs"
                        variant="outline"
                        onClick={() => simulateVariantSale(v.id, 8)}
                        title={isLive ? "Simulate sales from the Inventory page" : "Simulate sales to stress-test cover"}
                      >
                        −8 sale
                      </Button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {filtered.length === 0 && (
          <p className="px-4 py-6 text-center text-sm text-muted-foreground">
            No variants match this filter.
          </p>
        )}
      </SurfaceCard>
    </div>
  )
}
