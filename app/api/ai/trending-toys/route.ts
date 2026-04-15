import {
  computeTrendingToys,
  getCachedTrendingToys,
  type TrendingToysSuccessPayload,
} from "@/lib/trending-toys-server"
import type { TrendingToysResult } from "@/lib/trending-toys-ai"

type Body = { forceRefresh?: boolean }

export async function POST(req: Request) {
  let body: Body = {}
  try {
    body = (await req.json()) as Body
  } catch {
    /* empty body */
  }
  const forceRefresh = Boolean(body.forceRefresh)

  const key = (process.env.OPENROUTER_API_KEY ?? "").trim()
  if (!key) {
    return Response.json(
      {
        ok: false as const,
        error:
          "OPENROUTER_API_KEY is not set. Add it to .env to load AI toy trends.",
        items: [] as TrendingToysResult["items"],
        methodology: "",
        dataFreshnessNote: "",
        modelUsed: "",
        cachedAt: "",
        cacheTtlSeconds: 0,
        servedFrom: "none" as const,
      },
      { status: 503 }
    )
  }

  try {
    let payload: TrendingToysSuccessPayload
    if (forceRefresh) {
      const r = await computeTrendingToys()
      if (!r.ok) {
        return Response.json(
          {
            ok: false as const,
            error: r.error,
            items: [] as TrendingToysResult["items"],
            methodology: "",
            dataFreshnessNote: "",
            modelUsed: "",
            cachedAt: "",
            cacheTtlSeconds: 0,
            servedFrom: "error" as const,
          },
          { status: 502 }
        )
      }
      payload = r
    } else {
      payload = await getCachedTrendingToys()
    }

    return Response.json({
      ...payload,
      servedFrom: forceRefresh ? ("fresh" as const) : ("daily_cache" as const),
    })
  } catch (e) {
    const message = e instanceof Error ? e.message : "Trending toys failed"
    return Response.json(
      {
        ok: false as const,
        error: message,
        items: [] as TrendingToysResult["items"],
        methodology: "",
        dataFreshnessNote: "",
        modelUsed: "",
        cachedAt: "",
        cacheTtlSeconds: 0,
        servedFrom: "error" as const,
      },
      { status: 502 }
    )
  }
}
