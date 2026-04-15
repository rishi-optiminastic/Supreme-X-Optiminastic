import {
  RiBookReadLine,
  RiBroadcastLine,
  RiHashtag,
  RiMicLine,
  RiPagesLine,
  RiShareLine,
  RiStarLine,
  RiStore2Line,
  RiTv2Line,
} from "@remixicon/react"

import { cn } from "@/lib/utils"

/** Prefer server-resolved catalog thumbnail; fall back to client-side search map. */
export function trendingToyHeroImageUrl(
  item: { thumbnailUrl?: string },
  idx: number,
  clientFallback: Record<number, string>
): string | undefined {
  const u = item.thumbnailUrl?.trim()
  if (u) return u
  const f = clientFallback[idx]?.trim()
  return f || undefined
}

export const TRENDING_SOURCE_ORDER = [
  "tiktok",
  "youtube",
  "social",
  "blog",
  "magazine",
  "retail",
  "trade_show",
  "podcast",
  "other",
] as const

export function sortTrendingSourceTypes(types: string[]): string[] {
  const order: string[] = [...TRENDING_SOURCE_ORDER]
  return [...new Set(types)].sort((a, b) => {
    const ia = order.indexOf(a)
    const ib = order.indexOf(b)
    return (ia === -1 ? 99 : ia) - (ib === -1 ? 99 : ib) || a.localeCompare(b)
  })
}

export function trendingSourceShortLabel(type: string) {
  switch (type) {
    case "tiktok":
      return "TikTok"
    case "youtube":
      return "YouTube"
    case "social":
      return "Social"
    case "blog":
      return "Blog"
    case "magazine":
      return "Magazine"
    case "retail":
      return "Retail"
    case "trade_show":
      return "Trade"
    case "podcast":
      return "Podcast"
    default:
      return type.charAt(0).toUpperCase() + type.slice(1)
  }
}

export function TrendingSourceGlyph({ type }: { type: string }) {
  const c = "size-3.5 shrink-0 drop-shadow-sm"
  switch (type) {
    case "tiktok":
      return <RiBroadcastLine className={cn(c, "text-fuchsia-200")} aria-hidden />
    case "youtube":
      return <RiTv2Line className={cn(c, "text-red-300")} aria-hidden />
    case "social":
      return <RiShareLine className={cn(c, "text-violet-200")} aria-hidden />
    case "blog":
      return <RiBookReadLine className={cn(c, "text-sky-200")} aria-hidden />
    case "magazine":
      return <RiPagesLine className={cn(c, "text-amber-200")} aria-hidden />
    case "retail":
      return <RiStore2Line className={cn(c, "text-emerald-200")} aria-hidden />
    case "trade_show":
      return <RiStarLine className={cn(c, "text-cyan-200")} aria-hidden />
    case "podcast":
      return <RiMicLine className={cn(c, "text-indigo-200")} aria-hidden />
    default:
      return <RiHashtag className={cn(c, "text-white/90")} aria-hidden />
  }
}

export function TrendingSourceGlyphLight({ type }: { type: string }) {
  const c = "size-3.5 shrink-0"
  switch (type) {
    case "tiktok":
      return (
        <RiBroadcastLine className={cn(c, "text-fuchsia-600 dark:text-fuchsia-400")} aria-hidden />
      )
    case "youtube":
      return <RiTv2Line className={cn(c, "text-red-600 dark:text-red-400")} aria-hidden />
    case "social":
      return (
        <RiShareLine className={cn(c, "text-violet-600 dark:text-violet-400")} aria-hidden />
      )
    case "blog":
      return <RiBookReadLine className={cn(c, "text-sky-600 dark:text-sky-400")} aria-hidden />
    case "magazine":
      return <RiPagesLine className={cn(c, "text-amber-700 dark:text-amber-400")} aria-hidden />
    case "retail":
      return (
        <RiStore2Line className={cn(c, "text-emerald-600 dark:text-emerald-400")} aria-hidden />
      )
    case "trade_show":
      return <RiStarLine className={cn(c, "text-cyan-600 dark:text-cyan-400")} aria-hidden />
    case "podcast":
      return (
        <RiMicLine className={cn(c, "text-indigo-600 dark:text-indigo-400")} aria-hidden />
      )
    default:
      return <RiHashtag className={cn(c, "text-muted-foreground")} aria-hidden />
  }
}

export function trendingSourceChipClass(type: string) {
  switch (type) {
    case "tiktok":
      return "border-fuchsia-500/35 bg-fuchsia-500/10"
    case "youtube":
      return "border-red-500/35 bg-red-500/10"
    case "social":
      return "border-violet-500/35 bg-violet-500/10"
    case "blog":
      return "border-sky-500/35 bg-sky-500/10"
    case "magazine":
      return "border-amber-500/35 bg-amber-500/10"
    case "retail":
      return "border-emerald-500/35 bg-emerald-500/10"
    case "trade_show":
      return "border-cyan-500/35 bg-cyan-500/10"
    case "podcast":
      return "border-indigo-500/35 bg-indigo-500/10"
    default:
      return "border-border/60 bg-muted/50"
  }
}
