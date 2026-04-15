export const TRENDING_SOURCE_TYPES = [
  "magazine",
  "tiktok",
  "blog",
  "retail",
  "youtube",
  "social",
  "trade_show",
  "podcast",
  "other",
] as const

export type TrendingSourceType = (typeof TRENDING_SOURCE_TYPES)[number]

export type TrendingToySource = {
  type: TrendingSourceType
  /** e.g. "Holiday gift guides", "#sensorytoys TikTok", "The Toy Book" */
  detail: string
  /** Country or region where this signal is strongest (e.g. "United States", "UK", "India", "Global"). */
  country?: string
}

export type TrendingToyItem = {
  name: string
  brand?: string
  whyTrending: string
  /** Composite buzz 0–100 */
  trendScore: number
  /** Epistemic confidence 0–100 */
  confidence: number
  sources: TrendingToySource[]
  /** Set server-side from sample catalog (DummyJSON) when a match exists. */
  thumbnailUrl?: string
}

export type TrendingToysResult = {
  items: TrendingToyItem[]
  /** How the list was produced (honesty about limits). */
  methodology: string
  /** Honest note on recency / verification. */
  dataFreshnessNote: string
}

function isSourceType(x: string): x is TrendingSourceType {
  return (TRENDING_SOURCE_TYPES as readonly string[]).includes(x)
}

function normalizeItem(raw: Record<string, unknown>): TrendingToyItem | null {
  const name = typeof raw.name === "string" ? raw.name.trim() : ""
  if (!name || name.length > 180) return null

  const brand =
    typeof raw.brand === "string" && raw.brand.trim()
      ? raw.brand.trim().slice(0, 80)
      : undefined

  const whyTrending =
    typeof raw.whyTrending === "string"
      ? raw.whyTrending.trim().slice(0, 520)
      : ""
  if (!whyTrending) return null

  const trendScore = Math.round(
    Math.max(0, Math.min(100, Number(raw.trendScore) || 0))
  )
  const confidence = Math.round(
    Math.max(0, Math.min(100, Number(raw.confidence) || 0))
  )

  const sourcesIn = Array.isArray(raw.sources) ? raw.sources : []
  const sources: TrendingToySource[] = []
  for (const s of sourcesIn) {
    if (!s || typeof s !== "object") continue
    const o = s as Record<string, unknown>
    const t = typeof o.type === "string" ? o.type.trim() : ""
    const detail =
      typeof o.detail === "string" ? o.detail.trim().slice(0, 160) : ""
    if (!detail || !isSourceType(t)) continue
    const countryRaw = typeof o.country === "string" ? o.country.trim() : ""
    const country = countryRaw ? countryRaw.slice(0, 56) : undefined
    sources.push({ type: t, detail, ...(country ? { country } : {}) })
    if (sources.length >= 6) break
  }
  if (sources.length === 0) {
    sources.push({
      type: "other",
      detail: "General market buzz (add explicit sources when known)",
    })
  }

  return {
    name,
    brand,
    whyTrending,
    trendScore,
    confidence,
    sources,
  }
}

/** Parse and clamp model JSON; returns null if unusable. */
export function parseTrendingToysJson(text: string): TrendingToysResult | null {
  const cleaned = text.replace(/```json\n?|\n?```/g, "").trim()
  let parsed: unknown
  try {
    parsed = JSON.parse(cleaned)
  } catch {
    return null
  }
  if (!parsed || typeof parsed !== "object") return null
  const root = parsed as Record<string, unknown>
  const itemsIn = Array.isArray(root.items) ? root.items : []
  const items: TrendingToyItem[] = []
  for (const row of itemsIn) {
    if (!row || typeof row !== "object") continue
    const n = normalizeItem(row as Record<string, unknown>)
    if (n) items.push(n)
    if (items.length >= 10) break
  }
  if (items.length < 3) return null

  const methodology =
    typeof root.methodology === "string"
      ? root.methodology.trim().slice(0, 900)
      : "AI synthesis of public toy-trend signals."
  const dataFreshnessNote =
    typeof root.dataFreshnessNote === "string"
      ? root.dataFreshnessNote.trim().slice(0, 500)
      : ""

  return {
    items,
    methodology,
    dataFreshnessNote,
  }
}

export function trendingToysSystemPrompt(todayIso: string): string {
  return `You are an expert toy-industry trend researcher. Today's date is ${todayIso} (use this for recency).

Your job: produce a ranked list of toys/collectibles/play products that are genuinely trending or heavily discussed in REAL-WORLD channels: toy trade magazines and gift guides, TikTok toy/parenting hashtags and viral clips, blogs and Substacks, major retailer bestseller/spotlight lists, YouTube toy review channels, Instagram/TikTok creator buzz, and toy fair / trade coverage when relevant.

Rules for MAXIMUM accuracy:
- Prefer items you can justify with the source types above. Every item MUST include 2–6 "sources" entries with specific detail AND a "country" per source when possible: where that signal is strongest (e.g. "United States", "United Kingdom", "India", "Japan", "EU", or "Global").
- Example details: "Walmart Top Toys list", "#squishmallows TikTok", "The Toy Insider gift guide", "parenting blogs — sensory toy roundups".
- If you are uncertain about recency, LOWER "confidence" and say so in dataFreshnessNote.
- Do NOT invent fake URLs or fake article titles. You may name real publications or platforms when accurate; otherwise describe the channel generically.
- "trendScore" = composite buzz / momentum (0–100). "confidence" = how sure you are given training data and ambiguity (0–100).
- Cover diverse categories (e.g. plush, STEM, licensed, outdoor, collectible) when supported.

Respond with ONLY valid JSON (no markdown) in exactly this shape:
{
  "items": [
    {
      "name": "string",
      "brand": "string or omit",
      "whyTrending": "1-3 sentences",
      "trendScore": 0-100,
      "confidence": 0-100,
      "sources": [
        { "type": "magazine"|"tiktok"|"blog"|"retail"|"youtube"|"social"|"trade_show"|"podcast"|"other", "detail": "short specific string", "country": "country or region name" }
      ]
    }
  ],
  "methodology": "1-3 sentences on how you weighted signals",
  "dataFreshnessNote": "honest note on limits and time horizon"
}

Return 8–10 items in "items", sorted by trendScore descending.`
}
