import { unstable_cache } from "next/cache"

import { openRouterChat } from "@/lib/openrouter"
import {
  parseTrendingToysJson,
  trendingToysSystemPrompt,
  type TrendingToyItem,
} from "@/lib/trending-toys-ai"
import { fetchDummyJsonThumbnailForProductName } from "@/lib/trending-toys-dummy-images"

/** Next.js data cache TTL — one day (refreshes at most once per 24h per deployment region). */
export const TRENDING_TOYS_CACHE_SECONDS = 86_400

function todayIso(): string {
  return new Date().toISOString().slice(0, 10)
}

function trendingModelId(): string {
  return (
    process.env.OPENROUTER_TRENDING_MODEL?.trim() ||
    process.env.OPENROUTER_MODEL?.trim() ||
    "openai/gpt-4o-mini"
  )
}

export type TrendingToysSuccessPayload = {
  ok: true
  items: TrendingToyItem[]
  methodology: string
  dataFreshnessNote: string
  modelUsed: string
  cachedAt: string
  cacheTtlSeconds: number
}

export async function computeTrendingToys(): Promise<
  TrendingToysSuccessPayload | { ok: false; error: string }
> {
  const key = (process.env.OPENROUTER_API_KEY ?? "").trim()
  if (!key) {
    return { ok: false, error: "OPENROUTER_API_KEY is not set" }
  }

  const model = trendingModelId()
  const user = `Return the JSON now. Focus on toys and play products that are trending or rising across magazines, TikTok, blogs, retail spotlights, and social buzz as of ${todayIso()}. Prioritize items with cross-channel visibility (mentioned in more than one kind of place).`

  const raw = await openRouterChat(user, trendingToysSystemPrompt(todayIso()), {
    model,
    temperature: 0.22,
    maxTokens: 4500,
  })
  const parsed = parseTrendingToysJson(raw)
  if (!parsed) {
    return {
      ok: false,
      error:
        "Model returned JSON we could not parse. Try again or switch OPENROUTER_TRENDING_MODEL.",
    }
  }

  const items: TrendingToyItem[] = await Promise.all(
    parsed.items.map(async (item) => {
      const thumbnailUrl = await fetchDummyJsonThumbnailForProductName(item.name)
      return thumbnailUrl ? { ...item, thumbnailUrl } : { ...item }
    })
  )

  return {
    ok: true,
    items,
    methodology: parsed.methodology,
    dataFreshnessNote: parsed.dataFreshnessNote,
    modelUsed: model,
    cachedAt: new Date().toISOString(),
    cacheTtlSeconds: TRENDING_TOYS_CACHE_SECONDS,
  }
}

/**
 * Cached AI + thumbnail enrichment. Revalidates every 24h (daily refresh).
 */
export const getCachedTrendingToys = unstable_cache(
  async (): Promise<TrendingToysSuccessPayload> => {
    const r = await computeTrendingToys()
    if (!r.ok) {
      throw new Error(r.error)
    }
    return r
  },
  ["global-toy-trends-ai-v1"],
  { revalidate: TRENDING_TOYS_CACHE_SECONDS }
)
