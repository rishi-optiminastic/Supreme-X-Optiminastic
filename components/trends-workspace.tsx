"use client"

import * as React from "react"
import {
  RiAddLine,
  RiDeleteBinLine,
  RiFlashlightLine,
  RiGlobalLine,
  RiLoader4Line,
  RiPulseLine,
} from "@remixicon/react"

import { DataSourceBanner } from "@/components/data-source-banner"
import { ProductThumbnail } from "@/components/product-thumbnail"
import { useAppData, type TrendSourceKind } from "@/components/app-data-context"
import { PageHeader } from "@/components/page-header"
import { SurfaceCard } from "@/components/surface-card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { useAiInsight } from "@/hooks/use-ai-insight"
import { useVariantsWithOdoo } from "@/hooks/use-variants-with-odoo"
import { blendPrediction, computeSeries } from "@/lib/trend-series"

const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun"] as const
const inbound = [120, 132, 128, 145, 151, 158] as const
const outbound = [118, 125, 130, 142, 149, 156] as const

const KIND_OPTIONS: { value: TrendSourceKind; label: string }[] = [
  { value: "market", label: "Market" },
  { value: "pricing", label: "Pricing" },
  { value: "news", label: "News" },
  { value: "internal", label: "System" },
]

function SeriesBars({
  label,
  values,
  colorVar,
}: {
  label: string
  values: number[]
  colorVar: string
}) {
  const max = Math.max(...values, 1)
  return (
    <div>
      <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
        {label}
      </p>
      <div className="flex h-36 items-end gap-1.5 sm:gap-2">
        {values.map((val, i) => (
          <div
            key={months[i]}
            className="flex flex-1 flex-col items-center gap-2"
          >
            <div
              className="w-full max-w-6 rounded-t-md shadow-sm transition-all"
              style={{
                height: `${(val / max) * 100}%`,
                minHeight: "6px",
                background: colorVar,
              }}
              title={`${months[i]}: ${val}`}
            />
            <span className="text-[10px] font-bold text-muted-foreground">
              {months[i]}
            </span>
          </div>
        ))}
      </div>
    </div>
  )
}

export function TrendsWorkspace() {
  const {
    trendSources,
    trendEvents,
    lastForecastAt,
    predictionSummary,
    addTrendSource,
    removeTrendSource,
    toggleTrendSource,
    runCompositeForecast,
    purchaseSignals,
  } = useAppData()

  const {
    variants: mergedVariants,
    source: dataSource,
    odooLoading,
    odooError,
    refetchOdoo,
  } = useVariantsWithOdoo()

  const insight = useAiInsight()

  const marketSeries = React.useMemo(
    () => computeSeries(mergedVariants, trendSources, "market"),
    [mergedVariants, trendSources]
  )
  const systemSeries = React.useMemo(
    () => computeSeries(mergedVariants, trendSources, "system"),
    [mergedVariants, trendSources]
  )
  const predictionBlend = React.useMemo(
    () => blendPrediction(marketSeries, systemSeries),
    [marketSeries, systemSeries]
  )

  const onAiTrends = () => {
    const low = mergedVariants.filter((v) => v.weeksCover < 1.5).length
    void insight.run("trends", {
      dataSource,
      variantCount: mergedVariants.length,
      lowCoverCount: low,
      totalOnHand: mergedVariants.reduce((a, v) => a + v.onHand, 0),
      openSignals: purchaseSignals.filter((s) => !s.sentToTrends).length,
      trendSourceCount: trendSources.filter((s) => s.enabled).length,
      sampleSkus: mergedVariants.slice(0, 12).map((v) => v.sku),
    })
  }

  const [sourceName, setSourceName] = React.useState("")
  const [sourceKind, setSourceKind] = React.useState<TrendSourceKind>("market")
  const [sourceDetail, setSourceDetail] = React.useState("")

  const maxFlow = Math.max(...inbound, ...outbound, 1)

  const variantTrendRows = React.useMemo(
    () =>
      [...mergedVariants]
        .sort((a, b) => b.trendScore - a.trendScore)
        .slice(0, 6),
    [mergedVariants]
  )

  const onAddSource = () => {
    addTrendSource(sourceName, sourceKind, sourceDetail.trim() || undefined)
    setSourceName("")
    setSourceDetail("")
  }

  return (
    <div className="flex flex-1 flex-col gap-8 px-4 py-6 pb-12 md:gap-10 md:px-6 md:py-8">
      <DataSourceBanner
        source={dataSource}
        loading={odooLoading}
        error={odooError}
        onRefresh={refetchOdoo}
      />

      <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <PageHeader
          title="Trends & prediction"
          description="Market vs system signals, composite forecast, and configurable trend sources. Purchase signals sent from the Signals page appear in the activity feed."
          className="lg:max-w-2xl"
        />
        <div className="flex flex-wrap gap-2 self-start lg:self-auto">
          <Button
            type="button"
            variant="outline"
            className="gap-2"
            disabled={insight.loading}
            onClick={onAiTrends}
          >
            {insight.loading ? (
              <RiLoader4Line className="size-4 animate-spin" aria-hidden />
            ) : (
              <RiFlashlightLine className="size-4" aria-hidden />
            )}
            AI trend brief
          </Button>
          <Button
            type="button"
            className="gap-2"
            onClick={() => runCompositeForecast()}
          >
            <RiFlashlightLine className="size-4" aria-hidden />
            Run composite forecast
          </Button>
        </div>
      </div>

      {(insight.data?.summary || insight.data?.error) && (
        <SurfaceCard className="border-primary/15 p-5 ring-1 ring-primary/10">
          <h3 className="text-sm font-semibold">OpenRouter insight</h3>
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

      <div className="grid gap-4 lg:grid-cols-3">
        <SurfaceCard className="p-5">
          <div className="mb-2 flex items-center gap-2">
            <RiGlobalLine className="size-4 text-primary" aria-hidden />
            <h2 className="text-sm font-semibold tracking-tight">
              Market trend
            </h2>
          </div>
          <p className="mb-4 text-xs leading-relaxed text-muted-foreground">
            External / demand-style index (weighted by variant trend scores).
          </p>
          <SeriesBars
            label="Index (6 mo)"
            values={marketSeries}
            colorVar="var(--chart-2)"
          />
        </SurfaceCard>
        <SurfaceCard className="p-5">
          <div className="mb-2 flex items-center gap-2">
            <RiPulseLine className="size-4 text-primary" aria-hidden />
            <h2 className="text-sm font-semibold tracking-tight">
              System trend
            </h2>
          </div>
          <p className="mb-4 text-xs leading-relaxed text-muted-foreground">
            From Odoo moves + enabled internal sources (simulated series).
          </p>
          <SeriesBars
            label="Index (6 mo)"
            values={systemSeries}
            colorVar="var(--chart-3)"
          />
        </SurfaceCard>
        <SurfaceCard className="border-primary/20 p-5 ring-1 ring-primary/15">
          <h2 className="text-sm font-semibold tracking-tight">Prediction</h2>
          <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
            Blend: 45% market + 55% system. Updates when you run forecast.
          </p>
          <SeriesBars
            label="Composite"
            values={predictionBlend}
            colorVar="var(--primary)"
          />
          <div className="mt-4 rounded-lg border border-border/60 bg-muted/30 p-3 text-xs leading-relaxed text-muted-foreground">
            {predictionSummary}
          </div>
          {dataSource === "odoo" && (
            <p className="mt-2 text-[10px] text-muted-foreground">
              Charts use your Odoo variant mix; the text summary reflects the
              last forecast run (saved workspace state).
            </p>
          )}
          {lastForecastAt && (
            <p className="mt-2 text-[10px] text-muted-foreground">
              Last run: {new Date(lastForecastAt).toLocaleString()}
            </p>
          )}
        </SurfaceCard>
      </div>

      <div className="grid gap-4 lg:grid-cols-5">
        <SurfaceCard className="p-0 overflow-hidden lg:col-span-2">
          <div className="border-b border-border/60 bg-muted/20 px-5 py-4">
            <h2 className="text-base font-semibold tracking-tight">
              Trend sources
            </h2>
            <p className="mt-1 text-xs text-muted-foreground">
              Toggle feeds that influence the system trend. Add your own labels
              (stored locally).
            </p>
          </div>
          <ul className="divide-y divide-border/50">
            {trendSources.map((s) => (
              <li
                key={s.id}
                className="flex flex-wrap items-center justify-between gap-3 px-5 py-3"
              >
                <div className="min-w-0 flex-1">
                  <p className="font-medium">{s.name}</p>
                  <p className="text-xs text-muted-foreground">
                    {s.kind}
                    {s.detail ? ` · ${s.detail}` : ""}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <Button
                    type="button"
                    size="xs"
                    variant={s.enabled ? "default" : "outline"}
                    onClick={() => toggleTrendSource(s.id)}
                  >
                    {s.enabled ? "On" : "Off"}
                  </Button>
                  <Button
                    type="button"
                    size="icon-xs"
                    variant="ghost"
                    className="text-muted-foreground hover:text-destructive"
                    onClick={() => removeTrendSource(s.id)}
                    aria-label={`Remove ${s.name}`}
                  >
                    <RiDeleteBinLine className="size-3.5" />
                  </Button>
                </div>
              </li>
            ))}
          </ul>
          <div className="space-y-3 border-t border-border/60 bg-muted/15 p-5">
            <p className="text-xs font-semibold text-foreground">Add source</p>
            <Input
              placeholder="Source name"
              value={sourceName}
              onChange={(e) => setSourceName(e.target.value)}
            />
            <Input
              placeholder="Optional note"
              value={sourceDetail}
              onChange={(e) => setSourceDetail(e.target.value)}
            />
            <div className="flex flex-wrap gap-2">
              {KIND_OPTIONS.map((k) => (
                <Button
                  key={k.value}
                  type="button"
                  size="xs"
                  variant={sourceKind === k.value ? "secondary" : "outline"}
                  onClick={() => setSourceKind(k.value)}
                >
                  {k.label}
                </Button>
              ))}
            </div>
            <Button
              type="button"
              size="sm"
              className="gap-1.5"
              onClick={onAddSource}
              disabled={!sourceName.trim()}
            >
              <RiAddLine className="size-3.5" aria-hidden />
              Add trend source
            </Button>
          </div>
        </SurfaceCard>

        <SurfaceCard className="p-0 overflow-hidden lg:col-span-3">
          <div className="border-b border-border/60 bg-muted/20 px-5 py-4">
            <h2 className="text-base font-semibold tracking-tight">
              Activity &amp; variant trend
            </h2>
            <p className="mt-1 text-xs text-muted-foreground">
              Recent forecast runs and signals pushed to trends.
            </p>
          </div>
          <div className="grid gap-0 md:grid-cols-2">
            <div className="border-b border-border/50 p-5 md:border-b-0 md:border-r">
              <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Feed
              </p>
              {trendEvents.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  No events yet. Run a forecast or send a signal from Signals.
                </p>
              ) : (
                <ul className="space-y-3 text-sm">
                  {trendEvents.slice(0, 8).map((e) => (
                    <li key={e.id} className="flex flex-col gap-0.5">
                      <span className="font-medium leading-snug">{e.label}</span>
                      <span className="text-xs text-muted-foreground">
                        {new Date(e.at).toLocaleString()} · {e.kind}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
            <div className="p-5">
              <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Top variants by trend
              </p>
              <ul className="space-y-2 text-sm">
                {variantTrendRows.map((v) => (
                  <li
                    key={v.id}
                    className="flex items-center justify-between gap-2 rounded-lg bg-muted/30 px-2 py-1.5"
                  >
                    <span className="flex min-w-0 flex-1 items-center gap-2.5 truncate">
                      <ProductThumbnail variant={v} size="sm" />
                      <span className="min-w-0 truncate">
                        <span className="font-mono text-xs text-muted-foreground">
                          {v.sku}
                        </span>{" "}
                        <span className="text-muted-foreground">
                          {v.attributes}
                        </span>
                      </span>
                    </span>
                    <span className="shrink-0 font-mono text-xs font-semibold text-primary">
                      {v.trendScore}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </SurfaceCard>
      </div>

      <SurfaceCard className="p-0 overflow-hidden">
        <div className="border-b border-border/60 bg-muted/20 px-6 py-4">
          <h2 className="text-base font-semibold tracking-tight">
            Flow comparison
          </h2>
          <p className="mt-1 text-xs text-muted-foreground">
            Inbound vs outbound units (thousands), trailing six months.
          </p>
        </div>
        <div className="p-6">
          <div className="mb-6 flex flex-wrap items-center gap-3">
            <span className="inline-flex items-center gap-2 rounded-full border border-border/70 bg-background/80 px-3 py-1.5 text-xs font-semibold shadow-sm">
              <span
                className="size-2 rounded-full bg-primary shadow-sm ring-1 ring-primary/30"
                aria-hidden
              />
              Inbound
            </span>
            <span className="inline-flex items-center gap-2 rounded-full border border-border/70 bg-background/80 px-3 py-1.5 text-xs font-semibold shadow-sm">
              <span
                className="size-2 rounded-full shadow-sm ring-1 ring-black/10"
                style={{ background: "var(--chart-3)" }}
                aria-hidden
              />
              Outbound
            </span>
          </div>
          <div className="rounded-xl bg-muted/35 p-5 ring-1 ring-inset ring-border/45">
            <div className="flex h-56 items-end gap-1.5 sm:gap-3">
              {months.map((m, i) => (
                <div
                  key={m}
                  className="flex flex-1 flex-col items-center justify-end gap-2"
                >
                  <div className="flex h-full w-full max-w-14 items-end justify-center gap-1 sm:gap-1.5">
                    <div
                      className="w-full max-w-[0.65rem] rounded-t-md bg-primary shadow-md shadow-primary/15 sm:max-w-3"
                      style={{
                        height: `${(inbound[i]! / maxFlow) * 100}%`,
                        minHeight: "8px",
                      }}
                      title={`Inbound ${inbound[i]}`}
                    />
                    <div
                      className="w-full max-w-[0.65rem] rounded-t-md opacity-95 shadow-md sm:max-w-3"
                      style={{
                        height: `${(outbound[i]! / maxFlow) * 100}%`,
                        minHeight: "8px",
                        background: "var(--chart-3)",
                      }}
                      title={`Outbound ${outbound[i]}`}
                    />
                  </div>
                  <span className="text-[10px] font-bold uppercase tracking-wide text-muted-foreground sm:text-[11px]">
                    {m}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </SurfaceCard>
    </div>
  )
}
