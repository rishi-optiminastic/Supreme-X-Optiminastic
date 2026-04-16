"use client"

import * as React from "react"
import {
  RiBarChartGroupedLine,
  RiExternalLinkLine,
  RiGift2Line,
  RiGlobalLine,
  RiLightbulbLine,
  RiLineChartLine,
  RiLinksLine,
  RiRefreshLine,
  RiSearchLine,
  RiSignalTowerLine,
} from "@remixicon/react"

import { Panel } from "@/components/panel"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { TrendingSourceBrandMark } from "@/components/trending-toys-brand-icons"
import {
  sortTrendingSourceTypes,
  trendingSourceChipClass,
  trendingSourceShortLabel,
  TrendingSourceGlyphLight,
} from "@/components/trending-toys-shared"
import { countryLabelToIso2 } from "@/lib/country-region-flags"
import type { ExternalProductHit } from "@/lib/external-product-search"
import {
  googleImageSearchUrl,
  googleShoppingUrl,
} from "@/lib/toy-external-links"
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
const PINNED_GLOBAL_TREND_NAMES = [
  "clickeez collectible character keyboard keys",
]
const PINNED_GLOBAL_FALLBACK_ITEMS: AiTrendingToysPayload["items"] = [
  {
    name: "Clickeez Collectible Character Keyboard Keys",
    brand: "Clickeez",
    whyTrending:
      "Creator clips and desk setup posts are driving collectible keyboard toy buzz. Gift and blind-box style repeat purchases are lifting interest across fan communities. Trade and hobby coverage calls out this line as a breakout novelty accessory.",
    trendScore: 97,
    confidence: 78,
    sources: [
      {
        type: "magazine",
        detail: "Collectibles and novelty desk-toy watchlists mention the line",
        country: "United States",
      },
      {
        type: "trade_show",
        detail: "Retail buyer chatter highlights impulse gift potential",
        country: "United States",
      },
    ],
  },
]

function normalizeTrendName(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim()
}

function pinnedTrendPriority(name: string): number {
  const n = normalizeTrendName(name)
  for (let i = 0; i < PINNED_GLOBAL_TREND_NAMES.length; i++) {
    const p = PINNED_GLOBAL_TREND_NAMES[i]
    if (n === p || n.includes(p) || p.includes(n)) return i
  }
  return Number.POSITIVE_INFINITY
}

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

/** Split AI “why trending” copy into short factor lines for the card. */
function whyTrendingFactors(text: string, max = 4): string[] {
  const raw = text.trim()
  if (!raw) return []
  const bySentence = raw
    .split(/\.\s+/)
    .map((s) => s.trim().replace(/\.\s*$/, ""))
    .filter((s) => s.length > 12)
  if (bySentence.length > 1) return bySentence.slice(0, max)
  const bySemi = raw
    .split(/\s*;\s+/)
    .map((s) => s.trim())
    .filter((s) => s.length > 8)
  if (bySemi.length > 1) return bySemi.slice(0, max)
  return [raw]
}

/**
 * Catalog hit first when ready; while client search runs, show server thumbnail if any.
 */
function heroImageUrl(
  item: { thumbnailUrl?: string },
  originalIndex: number,
  resolved: string | null | undefined
): { src: string | undefined; resolving: boolean } {
  const server = item.thumbnailUrl?.trim() || undefined
  if (resolved === undefined) {
    return { src: server, resolving: true }
  }
  if (typeof resolved === "string" && resolved.length > 0) {
    return { src: resolved, resolving: false }
  }
  return { src: server, resolving: false }
}

function buzzBarClass(score: number) {
  if (score >= 72) return "from-violet-500 to-fuchsia-500"
  if (score >= 55) return "from-primary to-violet-500"
  if (score >= 42) return "from-amber-500 to-orange-500"
  return "from-slate-400 to-slate-500 dark:from-slate-500 dark:to-slate-600"
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

function RegionInline({ label }: { label: string }) {
  const code = countryLabelToIso2(label)
  if (!code) {
    return (
      <span className="inline-flex items-center gap-1">
        <RiGlobalLine
          className="size-3 shrink-0 text-muted-foreground"
          aria-hidden
        />
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

type TrendItem = AiTrendingToysPayload["items"][number]

function TrendingToyCard({
  item,
  originalIndex,
  displayRank,
  resolvedThumb,
}: {
  item: TrendItem
  originalIndex: number
  displayRank: number
  resolvedThumb: string | null | undefined
}) {
  const [imgBroken, setImgBroken] = React.useState(false)
  const { src: imgSrc, resolving } = heroImageUrl(
    item,
    originalIndex,
    resolvedThumb
  )
  React.useEffect(() => {
    setImgBroken(false)
  }, [imgSrc])

  const channelTypes = sortTrendingSourceTypes(item.sources.map((s) => s.type))
  const regionTags = uniqueCountriesFromSources(item.sources)
  const shopUrl = googleShoppingUrl(item.name, item.brand)
  const photosUrl = googleImageSearchUrl(item.name, item.brand)
  const factors = whyTrendingFactors(item.whyTrending)
  const distinctChannels = new Set(item.sources.map((s) => s.type)).size

  const showImage = Boolean(imgSrc && !imgBroken)
  const showSkeleton = resolving && !imgSrc

  return (
    <article
      className={cn(
        "group/card flex flex-col overflow-hidden rounded-2xl",
        "border border-border/80 bg-card shadow-sm ring-1 ring-black/4 dark:ring-white/6",
        "transition-[box-shadow_transform] duration-300 hover:-translate-y-0.5 hover:shadow-lg"
      )}
    >
      <div className="relative aspect-5/4 w-full overflow-hidden bg-linear-to-b from-muted/80 to-muted">
        {showSkeleton ? (
          <div
            className="absolute inset-0 animate-pulse bg-muted"
            aria-hidden
          />
        ) : null}

        {showImage ? (
          <>
            <img
              src={imgSrc}
              alt={item.name}
              className="size-full object-cover transition-transform duration-500 group-hover/card:scale-[1.03]"
              loading="lazy"
              onError={() => setImgBroken(true)}
            />
            <div
              className="pointer-events-none absolute inset-0 bg-linear-to-t from-black/55 via-black/10 to-transparent"
              aria-hidden
            />
          </>
        ) : !showSkeleton ? (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-linear-to-b from-muted to-muted/50 p-5 text-center">
            <RiGift2Line
              className="size-10 text-muted-foreground/40"
              aria-hidden
            />
            <p className="max-w-[200px] text-[11px] leading-relaxed text-muted-foreground">
              No catalog photo yet. Open shopping or image search to find one.
            </p>
            <div className="flex gap-2 w-full justify-center">
            <Button size={"xs"}>
            <a
                href={shopUrl}
                target="_blank"
                rel="noopener noreferrer"
                className={cn(
                    "inline-flex flex-1 items-center justify-center gap-1.5 rounded-xl  py-2.5 text-xs font-semibold",
                )}
                >
                <RiExternalLinkLine className="size-3.5 shrink-0" aria-hidden />
                Shop &amp; prices
              </a>
            </Button>
            <Button size={"xs"}>
            <a
                href={photosUrl}
                target="_blank"
                rel="noopener noreferrer"
                className={cn(
                  "inline-flex flex-1 items-center justify-center gap-1.5 rounded-xl  py-2.5 text-xs font-semibold",
                )}
              >
                <RiSearchLine className="size-3.5 shrink-0" aria-hidden />
                Image search
              </a>
            </Button>
            </div>
          </div>
        ) : null}

        <div className="absolute top-2 right-2 left-2 flex flex-wrap items-start justify-between gap-2">
          <span className="rounded-full bg-black/45 px-2 py-0.5 text-[10px] font-semibold text-white tabular-nums backdrop-blur-sm">
            #{displayRank}
          </span>
          <div className="flex flex-wrap justify-end gap-1">
            {channelTypes.slice(0, 3).map((t) => (
              <span
                key={t}
                className={cn(
                  "inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-medium shadow-sm backdrop-blur-md",
                  showImage
                    ? "border-white/25 bg-black/35 text-white"
                    : cn(
                        "border-border/60 bg-background/90",
                        trendingSourceChipClass(t)
                      )
                )}
                title={trendingSourceShortLabel(t)}
              >
                <TrendingSourceBrandMark type={t} />
                {trendingSourceShortLabel(t)}
              </span>
            ))}
          </div>
        </div>

        <div className="absolute right-0 bottom-0 left-0 p-3 pt-8">
          <div
            className={cn(
              "flex items-center justify-between gap-2 rounded-xl px-2.5 py-2",
              showImage
                ? "bg-black/40 text-white backdrop-blur-md"
                : "border border-border/60 bg-background/85 backdrop-blur-sm"
            )}
          >
            <div className="flex min-w-0 items-center gap-2">
              <RiLineChartLine
                className={cn(
                  "size-4 shrink-0",
                  showImage ? "text-fuchsia-200" : "text-primary"
                )}
                aria-hidden
              />
              <div className="min-w-0">
                <p
                  className={cn(
                    "text-[10px] font-medium tracking-wide uppercase",
                    showImage ? "text-white/75" : "text-muted-foreground"
                  )}
                >
                  Trend score
                </p>
                <p className="truncate text-lg leading-none font-bold tabular-nums">
                  {item.trendScore}
                  <span className="text-xs font-normal opacity-80">/100</span>
                </p>
              </div>
            </div>
            <div className="text-right">
              <p
                className={cn(
                  "text-[10px] font-medium tracking-wide uppercase",
                  showImage ? "text-white/75" : "text-muted-foreground"
                )}
              >
                Confidence
              </p>
              <p className="text-sm font-semibold tabular-nums">
                {item.confidence}%
              </p>
            </div>
          </div>
        </div>
      </div>
      

      <div className="flex min-h-0 flex-1 flex-col gap-3 p-4">
        <div>
          {item.brand ? (
            <p className="text-[11px] font-medium tracking-wide text-muted-foreground uppercase">
              {item.brand}
            </p>
          ) : null}
          <h2 className="mt-0.5 line-clamp-2 text-base leading-snug font-semibold tracking-tight text-foreground">
            {item.name}
          </h2>
        </div>
        <details className="group rounded-xl border border-dashed border-border/70 bg-background/50 text-[11px]">
          <summary className="flex cursor-pointer list-none items-center justify-between gap-2 px-3 py-2.5 font-medium text-foreground [&::-webkit-details-marker]:hidden">
            <span className="inline-flex items-center gap-1.5">
              <RiLinksLine
                className="size-3.5 text-muted-foreground"
                aria-hidden
              />
              Sources
              <span className="rounded-md bg-muted px-1.5 py-0.5 text-[10px] text-muted-foreground tabular-nums">
                {item.sources.length}
              </span>
            </span>
            <span className="text-[10px] text-muted-foreground">
              <span className="group-open:hidden">Show</span>
              <span className="hidden group-open:inline">Hide</span>
            </span>
          </summary>
          <ul className="max-h-48 space-y-1.5 overflow-y-auto border-t border-border/50 px-3 py-2">
            {item.sources.map((s, si) => (
              <li
                key={si}
                className="flex gap-2 rounded-lg bg-muted/30 px-2 py-1.5"
                title={`${s.detail}${s.country ? ` · ${s.country}` : ""}`}
              >
                <TrendingSourceGlyphLight type={s.type} />
                <div className="min-w-0 flex-1">
                  <p className="font-medium text-foreground">
                    {trendingSourceShortLabel(s.type)}
                    {s.country ? (
                      <span className="ml-1.5 font-normal text-muted-foreground">
                        · <RegionInline label={s.country} />
                      </span>
                    ) : null}
                  </p>
                  <p className="line-clamp-2 text-[10px] leading-snug text-muted-foreground">
                    {s.detail}
                  </p>
                </div>
              </li>
            ))}
          </ul>
        </details>

        <div className="rounded-xl border border-border/60 bg-muted/25 p-3">
          <div className="mb-2 flex items-center gap-2">
            <RiSignalTowerLine className="size-3.5 text-primary" aria-hidden />
            <span className="text-[10px] font-semibold tracking-wide text-muted-foreground uppercase">
              Signals &amp; factors
            </span>
          </div>
          <div className="mb-3 h-2 overflow-hidden rounded-full bg-muted">
            <div
              className={cn(
                "h-full rounded-full bg-linear-to-r transition-all",
                buzzBarClass(item.trendScore)
              )}
              style={{ width: `${Math.min(100, item.trendScore)}%` }}
            />
          </div>
          <ul className="space-y-2">
            <li className="flex gap-2 text-[11px] leading-snug text-muted-foreground">
              <RiLightbulbLine
                className="mt-0.5 size-3.5 shrink-0 text-amber-500 dark:text-amber-400"
                aria-hidden
              />
              <span>
                <span className="font-medium text-foreground">
                  Cross-channel:{" "}
                </span>
                {channelTypes.length === 0
                  ? "See citations below for where buzz showed up."
                  : `${distinctChannels} distinct source${
                      distinctChannels === 1 ? "" : "s"
                    } (${channelTypes
                      .slice(0, 4)
                      .map(trendingSourceShortLabel)
                      .join(", ")}${channelTypes.length > 4 ? "…" : ""}).`}
              </span>
            </li>
            {regionTags.length > 0 ? (
              <li className="flex gap-2 text-[11px] leading-snug text-muted-foreground">
                <RiGlobalLine
                  className="mt-0.5 size-3.5 shrink-0 text-sky-500 dark:text-sky-400"
                  aria-hidden
                />
                <span>
                  <span className="font-medium text-foreground">Regions: </span>
                  {regionTags.join(", ")}.
                </span>
              </li>
            ) : null}
            {factors.map((f, i) => (
              <li
                key={i}
                className="flex gap-2 border-t border-border/40 pt-2 text-[11px] leading-relaxed text-muted-foreground first:border-t-0 first:pt-0"
              >
                <span
                  className="mt-1.5 size-1.5 shrink-0 rounded-full bg-primary/70"
                  aria-hidden
                />
                <span>{f}</span>
              </li>
            ))}
          </ul>
        </div>

       
      </div>
    </article>
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
    const sortedRows = data.items
      .map((item, originalIndex) => ({ item, originalIndex }))
      .filter(
        ({ item }) =>
          itemMatchesCountryFilter(item, countryFilter) &&
          itemMatchesSearchQuery(item, searchQuery)
      )
      .sort((a, b) => {
        const ap = pinnedTrendPriority(a.item.name)
        const bp = pinnedTrendPriority(b.item.name)
        if (ap !== bp) return ap - bp
        return a.originalIndex - b.originalIndex
      })

    const hasPinnedInResults = sortedRows.some(
      ({ item }) => pinnedTrendPriority(item.name) !== Number.POSITIVE_INFINITY
    )
    if (hasPinnedInResults) return sortedRows

    const fallbackRows = PINNED_GLOBAL_FALLBACK_ITEMS.map((item, i) => ({
      item,
      originalIndex: -(i + 1),
    }))
      .filter(
        ({ item }) =>
          itemMatchesCountryFilter(item, countryFilter) &&
          itemMatchesSearchQuery(item, searchQuery)
      )
      .sort((a, b) => pinnedTrendPriority(a.item.name) - pinnedTrendPriority(b.item.name))

    return [...fallbackRows, ...sortedRows]
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
          AI-ranked picks · photos when the catalog matches · list refreshes
          daily
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
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center ">
              <div className="relative min-w-0 flex-1">
                <RiSearchLine
                  className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground"
                  aria-hidden
                />
                <Input
                  type="search"
                  placeholder="Search toys, brands, sources…"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="h-9 pl-9 w-[300px]"
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
                  className="overflow-hidden rounded-2xl border border-border bg-card shadow-sm"
                >
                  <div className="aspect-5/4 animate-pulse bg-muted/60" />
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
              <p className="mt-1 text-[13px] leading-relaxed opacity-90">
                {error}
              </p>
            </div>
          ) : data?.items?.length ? (
            <>
              {(data.methodology ||
                data.dataFreshnessNote ||
                data.modelUsed) && (
                <details className="rounded-lg border border-border bg-muted/20 px-3 py-2 text-[11px] text-muted-foreground">
                  <summary className="cursor-pointer list-none font-medium text-foreground marker:content-none [&::-webkit-details-marker]:hidden">
                    <span className="inline-flex items-center gap-2">
                      <RiBarChartGroupedLine className="size-3.5" aria-hidden />
                      How this list is built
                    </span>
                  </summary>
                  <div className="mt-2 space-y-1 border-t border-border/60 pt-2">
                    {data.methodology ? <p>{data.methodology}</p> : null}
                    {data.dataFreshnessNote ? (
                      <p>{data.dataFreshnessNote}</p>
                    ) : null}
                    {data.modelUsed ? (
                      <p className="font-mono text-[10px] opacity-90">
                        {data.modelUsed}
                      </p>
                    ) : null}
                  </div>
                </details>
              )}
              {!filteredRows.length ? (
                <p className="py-8 text-center text-sm text-muted-foreground">
                  No trends match your filters.
                </p>
              ) : (
                <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
                  {filteredRows.map(({ item, originalIndex }, visibleIdx) => (
                    <TrendingToyCard
                      key={`${item.name}-${originalIndex}`}
                      item={item}
                      originalIndex={originalIndex}
                      displayRank={visibleIdx + 1}
                      resolvedThumb={
                        originalIndex < 0 ? null : resolvedThumbnails[originalIndex]
                      }
                    />
                  ))}
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
