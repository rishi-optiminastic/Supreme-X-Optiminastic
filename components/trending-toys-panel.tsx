"use client"

import * as React from "react"
import {
  RiBarChartGroupedLine,
  RiExternalLinkLine,
  RiGift2Line,
  RiGlobalLine,
  RiRefreshLine,
  RiSearchLine,
} from "@remixicon/react"

import { Panel } from "@/components/panel"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { TrendingSourceBrandMark } from "@/components/trending-toys-brand-icons"
import {
  sortTrendingSourceTypes,
  trendingSourceShortLabel,
} from "@/components/trending-toys-shared"
import { countryLabelToIso2 } from "@/lib/country-region-flags"
import type { ExternalProductHit } from "@/lib/external-product-search"
import { googleImageSearchUrl, googleShoppingUrl } from "@/lib/toy-external-links"
import { pickBestThumbnailFromExternalHits } from "@/lib/thumbnail-relevance"
import { cn } from "@/lib/utils"

type TrendingToySourceRow = {
  type: string
  detail: string
  country?: string
}

type AiTrendingToysPayload = {
  ok: boolean
  items: {
    name: string
    brand?: string
    whyTrending: string
    trendScore: number
    confidence: number
    thumbnailUrl?: string
    sources: TrendingToySourceRow[]
  }[]
  methodology?: string
  dataFreshnessNote?: string
  modelUsed?: string
  cachedAt?: string
  cacheTtlSeconds?: number
  servedFrom?: "daily_cache" | "fresh" | "error" | "none"
  error?: string
}

function uniqueCountriesFromSources(sources: TrendingToySourceRow[]): string[] {
  const u = new Set<string>()
  for (const s of sources) {
    const c = s.country?.trim()
    if (c) u.add(c)
  }
  return [...u].sort((a, b) => a.localeCompare(b))
}

function allCountriesFromItems(
  items: AiTrendingToysPayload["items"]
): string[] {
  const u = new Set<string>()
  for (const it of items) {
    for (const s of it.sources) {
      const c = s.country?.trim()
      if (c) u.add(c)
    }
  }
  return [...u].sort((a, b) => a.localeCompare(b))
}

const ALL_REGIONS = "__all__"

function itemMatchesCountryFilter(
  item: AiTrendingToysPayload["items"][number],
  filter: string
): boolean {
  if (filter === ALL_REGIONS) return true
  const f = filter.trim().toLowerCase()
  for (const s of item.sources) {
    const c = s.country?.trim().toLowerCase()
    if (c && c === f) return true
  }
  return false
}

function itemMatchesSearchQuery(
  item: AiTrendingToysPayload["items"][number],
  query: string
): boolean {
  const q = query.trim().toLowerCase()
  if (!q) return true
  const parts = [
    item.name,
    item.brand ?? "",
    item.whyTrending,
    ...item.sources.map((s) => `${s.detail} ${s.country ?? ""}`),
  ]
  return parts.some((p) => p.toLowerCase().includes(q))
}

function RegionChip({ label }: { label: string }) {
  const code = countryLabelToIso2(label)
  if (!code) {
    return (
      <span className="inline-flex items-center gap-1 rounded-md border border-border bg-muted/50 px-2 py-0.5 text-[11px] font-medium text-foreground">
        <RiGlobalLine className="size-3.5 shrink-0 text-muted-foreground" aria-hidden />
        {label}
      </span>
    )
  }
  return (
    <span className="inline-flex items-center gap-1.5 rounded-md border border-border bg-background px-2 py-0.5 text-[11px] font-medium text-foreground">
      <img
        src={`https://flagcdn.com/w40/${code}.png`}
        srcSet={`https://flagcdn.com/w80/${code}.png 2x`}
        alt=""
        width={20}
        height={14}
        className="h-3.5 w-auto rounded-sm border border-border/60 object-cover"
      />
      {label}
    </span>
  )
}

function RegionInline({ label }: { label: string }) {
  const code = countryLabelToIso2(label)
  if (!code) {
    return (
      <span className="inline-flex items-center gap-1">
        <RiGlobalLine className="size-3 shrink-0 text-muted-foreground" aria-hidden />
        {label}
      </span>
    )
  }
  return (
    <span className="inline-flex items-center gap-1">
      <img
        src={`https://flagcdn.com/w40/${code}.png`}
        srcSet={`https://flagcdn.com/w80/${code}.png 2x`}
        alt=""
        width={18}
        height={12}
        className="h-3 w-auto rounded-sm border border-border/50 object-cover"
      />
      {label}
    </span>
  )
}

export function TrendingToysPanel() {
  const [data, setData] = React.useState<AiTrendingToysPayload | null>(null)
  const [loading, setLoading] = React.useState(true)
  const [error, setError] = React.useState<string | null>(null)
  /** Client-only catalog match; never trust cached API `thumbnailUrl` (can be stale/wrong). */
  const [resolvedThumbnails, setResolvedThumbnails] = React.useState<
    Record<number, string | null | undefined>
  >({})
  const [countryFilter, setCountryFilter] = React.useState(ALL_REGIONS)
  const [searchQuery, setSearchQuery] = React.useState("")

  const countryOptions = React.useMemo(() => {
    if (!data?.ok || !data.items?.length) return []
    return allCountriesFromItems(data.items)
  }, [data])

  const filteredRows = React.useMemo(() => {
    if (!data?.ok || !data.items?.length) return []
    return data.items
      .map((item, originalIndex) => ({ item, originalIndex }))
      .filter(
        ({ item }) =>
          itemMatchesCountryFilter(item, countryFilter) &&
          itemMatchesSearchQuery(item, searchQuery)
      )
  }, [data, countryFilter, searchQuery])

  const load = React.useCallback(async (forceRefresh = false) => {
    setLoading(true)
    setError(null)
    try {
      const r = await fetch("/api/ai/trending-toys", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ forceRefresh }),
      })
      const j = (await r.json()) as AiTrendingToysPayload
      if (!j.ok) {
        setData(null)
        setError(j.error ?? "Could not load trends")
        return
      }
      setData(j)
    } catch (e) {
      setData(null)
      setError(e instanceof Error ? e.message : "Request failed")
    } finally {
      setLoading(false)
    }
  }, [])

  React.useEffect(() => {
    void load()
  }, [load])

  React.useEffect(() => {
    if (!data?.ok || !data.items?.length) {
      setResolvedThumbnails({})
      return
    }
    const ac = new AbortController()
    const items = data.items
    setResolvedThumbnails({})
    ;(async () => {
      const next: Record<number, string | null> = {}
      await Promise.all(
        items.map(async (item, idx) => {
          const q = item.name.trim()
          if (q.length < 2) {
            next[idx] = null
            return
          }
          try {
            const r = await fetch(
              `/api/products/search?q=${encodeURIComponent(q.slice(0, 48))}`,
              { signal: ac.signal }
            )
            const j = (await r.json()) as { products?: ExternalProductHit[] }
            next[idx] = pickBestThumbnailFromExternalHits(q, j.products ?? [])
          } catch {
            next[idx] = null
          }
        })
      )
      if (!ac.signal.aborted) setResolvedThumbnails(next)
    })()
    return () => ac.abort()
  }, [data])

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight md:text-3xl">
          Global toy trends
        </h1>
        <p className="mt-1 max-w-xl text-sm text-muted-foreground">
          AI-ranked picks · photos when the catalog matches · list refreshes daily
        </p>
      </div>

      <Panel className="border border-border bg-card p-0 shadow-sm">
        <div className="border-b border-border px-4 py-3">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <RiGlobalLine className="size-4 shrink-0" aria-hidden />
              {data?.ok && data.cachedAt ? (
                <span className="text-xs">
                  Updated{" "}
                  <time dateTime={data.cachedAt}>
                    {new Date(data.cachedAt).toLocaleDateString(undefined, {
                      month: "short",
                      day: "numeric",
                    })}
                  </time>
                  {data.servedFrom === "daily_cache" ? " · cached 24h" : null}
                </span>
              ) : (
                <span className="text-xs">Trending toys</span>
              )}
            </div>
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="shrink-0 gap-1.5"
              disabled={loading}
              onClick={() => void load(true)}
              title="Refresh list"
            >
              <RiRefreshLine
                className={cn("size-4", loading && "animate-spin")}
                aria-hidden
              />
              {loading ? "…" : "Refresh"}
            </Button>
          </div>
        </div>

        {!loading && data?.ok && data.items?.length ? (
          <div className="border-b border-border px-4 py-3">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
              <div className="relative min-w-0 flex-1">
                <RiSearchLine
                  className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
                  aria-hidden
                />
                <Input
                  type="search"
                  placeholder="Search toys, brands, sources…"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="h-9 pl-9"
                  aria-label="Search trends"
                />
              </div>
              <div className="flex w-full flex-col gap-1 sm:w-48">
                <label htmlFor="trend-country" className="sr-only">
                  Region
                </label>
                <select
                  id="trend-country"
                  value={countryFilter}
                  onChange={(e) => setCountryFilter(e.target.value)}
                  className={cn(
                    "h-9 w-full rounded-lg border border-input bg-background px-3 text-sm outline-none",
                    "focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50",
                    "disabled:cursor-not-allowed disabled:opacity-50 dark:bg-input/30"
                  )}
                >
                  <option value={ALL_REGIONS}>All regions</option>
                  {countryOptions.map((c) => (
                    <option key={c} value={c}>
                      {c}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </div>
        ) : null}

        <div className="relative space-y-4 p-4">
          {loading ? (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {Array.from({ length: 6 }).map((_, i) => (
                <div
                  key={i}
                  className="overflow-hidden rounded-xl border border-border bg-card shadow-sm"
                >
                  <div className="aspect-3/4 animate-pulse bg-muted/60" />
                  <div className="space-y-2 p-3">
                    <div className="h-3 w-[75%] animate-pulse rounded bg-muted/70" />
                    <div className="h-2 w-full animate-pulse rounded bg-muted/50" />
                    <div className="flex gap-1 pt-1">
                      <div className="h-6 w-14 animate-pulse rounded-full bg-muted/60" />
                      <div className="h-6 w-14 animate-pulse rounded-full bg-muted/60" />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : error ? (
            <div
              className="rounded-xl border border-amber-500/35 bg-amber-500/8 px-4 py-3 text-sm text-amber-950 dark:border-amber-500/25 dark:bg-amber-500/10 dark:text-amber-50/95"
              role="status"
            >
              <p className="font-medium">Trending list unavailable</p>
              <p className="mt-1 text-[13px] leading-relaxed opacity-90">{error}</p>
            </div>
          ) : data?.items?.length ? (
            <>
              {(data.methodology || data.dataFreshnessNote || data.modelUsed) && (
                <details className="rounded-lg border border-border bg-muted/20 px-3 py-2 text-[11px] text-muted-foreground">
                  <summary className="cursor-pointer list-none font-medium text-foreground marker:content-none [&::-webkit-details-marker]:hidden">
                    <span className="inline-flex items-center gap-2">
                      <RiBarChartGroupedLine className="size-3.5" aria-hidden />
                      How this list is built
                    </span>
                  </summary>
                  <div className="mt-2 space-y-1 border-t border-border/60 pt-2">
                    {data.methodology ? <p>{data.methodology}</p> : null}
                    {data.dataFreshnessNote ? <p>{data.dataFreshnessNote}</p> : null}
                    {data.modelUsed ? (
                      <p className="font-mono text-[10px] opacity-90">{data.modelUsed}</p>
                    ) : null}
                  </div>
                </details>
              )}
              {!filteredRows.length ? (
                <p className="py-8 text-center text-sm text-muted-foreground">
                  No trends match your filters.
                </p>
              ) : (
                <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                  {filteredRows.map(({ item, originalIndex }) => {
                    const resolved = resolvedThumbnails[originalIndex]
                    const imgUrl =
                      typeof resolved === "string" && resolved.length > 0
                        ? resolved
                        : undefined
                    const channelTypes = sortTrendingSourceTypes(
                      item.sources.map((s) => s.type)
                    )
                    const regionTags = uniqueCountriesFromSources(item.sources)
                    const shopUrl = googleShoppingUrl(item.name, item.brand)
                    const photosUrl = googleImageSearchUrl(item.name, item.brand)
                    return (
                      <div
                        key={`${item.name}-${originalIndex}`}
                        className="group/card flex flex-col overflow-hidden rounded-xl border border-border bg-card shadow-sm transition-shadow hover:shadow-md"
                      >
                        <div className="relative aspect-3/4 w-full overflow-hidden bg-muted">
                          {imgUrl ? (
                            <img
                              src={imgUrl}
                              alt=""
                              className="size-full object-cover"
                              loading="lazy"
                            />
                          ) : resolved === undefined ? (
                            <div className="flex size-full animate-pulse items-center justify-center bg-muted/80">
                              <span className="sr-only">Loading image</span>
                            </div>
                          ) : (
                            <div className="flex size-full flex-col items-center justify-center gap-3 p-4 text-center">
                              <RiGift2Line
                                className="size-9 text-muted-foreground/35"
                                aria-hidden
                              />
                              <div className="flex w-full max-w-[220px] flex-col gap-2">
                                <a
                                  href={shopUrl}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="inline-flex items-center justify-center gap-1.5 rounded-lg border border-border bg-background px-3 py-2 text-xs font-medium text-foreground transition-colors hover:bg-muted/50"
                                >
                                  <RiExternalLinkLine
                                    className="size-3.5 shrink-0"
                                    aria-hidden
                                  />
                                  Shop &amp; prices
                                </a>
                                <a
                                  href={photosUrl}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="inline-flex items-center justify-center gap-1.5 rounded-lg border border-transparent px-2 py-1 text-xs text-primary underline-offset-4 hover:underline"
                                >
                                  <RiExternalLinkLine
                                    className="size-3.5 shrink-0"
                                    aria-hidden
                                  />
                                  Image search
                                </a>
                              </div>
                            </div>
                          )}
                        </div>

                        <div className="flex items-center justify-between gap-2 border-b border-border bg-muted/30 px-3 py-2 text-xs">
                          <span className="font-semibold tabular-nums text-muted-foreground">
                            #{originalIndex + 1}
                          </span>
                          <span className="font-semibold tabular-nums text-foreground">
                            {item.trendScore}{" "}
                            <span className="font-normal text-muted-foreground">
                              buzz
                            </span>
                          </span>
                          <span className="text-[10px] text-muted-foreground">
                            {item.confidence}%
                          </span>
                        </div>

                        <div className="flex min-h-0 flex-1 flex-col gap-2.5 p-3">
                          {channelTypes.length > 0 ? (
                            <div className="flex flex-wrap gap-1">
                              {channelTypes.slice(0, 5).map((t) => (
                                <span
                                  key={t}
                                  className="inline-flex items-center gap-1 rounded-md border border-border bg-muted/30 px-2 py-0.5 text-[10px] font-medium text-foreground"
                                  title={trendingSourceShortLabel(t)}
                                >
                                  <TrendingSourceBrandMark type={t} />
                                  {trendingSourceShortLabel(t)}
                                </span>
                              ))}
                            </div>
                          ) : null}
                          {regionTags.length > 0 ? (
                            <div className="flex flex-wrap items-center gap-1.5">
                              <span className="text-[10px] text-muted-foreground">
                                Region
                              </span>
                              {regionTags.map((c) => (
                                <RegionChip key={c} label={c} />
                              ))}
                            </div>
                          ) : null}
                          <div>
                            <p className="line-clamp-2 text-sm font-semibold leading-snug">
                              {item.name}
                            </p>
                            {item.brand ? (
                              <p className="mt-0.5 text-xs text-muted-foreground">
                                {item.brand}
                              </p>
                            ) : null}
                          </div>
                          <p className="line-clamp-2 text-[11px] leading-relaxed text-muted-foreground">
                            {item.whyTrending}
                          </p>
                          <div className="flex min-h-0 flex-col gap-1.5 border-t border-border pt-2">
                            <div className="flex flex-wrap gap-1.5">
                              {item.sources.map((s, si) => (
                                <span
                                  key={si}
                                  title={`${s.detail}${s.country ? ` · ${s.country}` : ""}`}
                                  className="inline-flex max-w-full flex-col gap-0.5 rounded-md border border-border bg-muted/25 px-2 py-1.5 text-[10px] sm:max-w-[calc(100%-0.25rem)]"
                                >
                                  <span className="inline-flex items-center gap-1.5 font-medium text-foreground">
                                    <TrendingSourceBrandMark type={s.type} />
                                    {trendingSourceShortLabel(s.type)}
                                  </span>
                                  {s.country ? (
                                    <span className="pl-6 text-[9px] text-muted-foreground">
                                      <RegionInline label={s.country} />
                                    </span>
                                  ) : null}
                                  <span className="pl-6 text-[9px] leading-snug text-muted-foreground">
                                    {s.detail}
                                  </span>
                                </span>
                              ))}
                            </div>
                          </div>
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}
            </>
          ) : (
            <p className="text-sm text-muted-foreground">No items returned.</p>
          )}
        </div>
      </Panel>
    </div>
  )
}
