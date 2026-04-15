import type { ExternalProductHit } from "@/lib/external-product-search"

/** Categories in DummyJSON that are almost never toy matches. */
const NON_TOY_CATEGORY =
  /grocery|groceries|food|vegetable|fruit|meat|dairy|produce|kitchen|spice|snack|beverages|beverage|coffee|tea|organic|pantry|frozen|bakery|seafood|deli|liquor|home[-\s]?decor|cleaning|beauty|health|pharmacy|laptops|smartphones|tablets|mobile|phones|gadgets|electronics|laptop|ipad/i

/** Obvious non-toy product titles (catalog noise — includes produce/grocery noise). */
const NON_TOY_TITLE =
  /\b(potato|potatoes|russet|tomato|onion|carrot|lettuce|apple|banana|beef|chicken|pork|milk|cheese|yogurt|bread|rice|pasta|oil|vinegar|spice|spices|herbs|snack|drink|soda|juice|water\s+bottle|detergent|shampoo|vegetable|vegetables|produce|grocery|organic\s+food)\b/i

/** Tablets / phones / laptops — wrong for toy trends even when search overlaps. */
const ELECTRONICS_TITLE =
  /\b(ipad|iphone|tablet|macbook|laptop|smartphone|galaxy\s*tab|surface\s*pro|pixel\s*tab|kindle\s*fire)\b/i

function shouldRejectCategory(category: string): boolean {
  return NON_TOY_CATEGORY.test(category)
}

function shouldRejectTitle(title: string): boolean {
  return NON_TOY_TITLE.test(title) || ELECTRONICS_TITLE.test(title)
}

const SCORE_STOP = new Set([
  "the",
  "a",
  "an",
  "and",
  "or",
  "for",
  "with",
  "toy",
  "toys",
  "set",
  "new",
  "from",
  "our",
  "your",
  "all",
  "mini",
  "kids",
])

/**
 * Word overlap between AI trend label and catalog row (title, category, brand).
 */
export function scoreProductTitleMatch(
  trendName: string,
  product: ExternalProductHit
): number {
  const needle = trendName.toLowerCase()
  const hay = `${product.title} ${product.category} ${product.brand ?? ""}`.toLowerCase()
  const words = needle
    .split(/\W+/)
    .filter((w) => w.length > 2 && !SCORE_STOP.has(w))
  let score = 0
  for (const w of words) {
    if (hay.includes(w)) score += 1
  }
  const brand = product.brand?.trim().toLowerCase()
  if (brand && brand.length >= 2 && needle.includes(brand)) score += 2
  return score
}

/** Multi-word trends need ≥2 overlapping tokens or we get junk (e.g. “star” → potatoes). */
function minScoreForTrendName(trendName: string): number {
  const words = trendName
    .toLowerCase()
    .split(/\W+/)
    .filter((w) => w.length > 2 && !SCORE_STOP.has(w))
  return words.length <= 1 ? 1 : 2
}

/**
 * Pick a catalog thumbnail only when it plausibly matches the trend name.
 * Avoids showing unrelated first-hit images (e.g. groceries for a toy name).
 */
export function pickBestThumbnailFromExternalHits(
  trendName: string,
  hits: ExternalProductHit[]
): string | null {
  const trimmed = trendName.trim()
  if (trimmed.length < 2 || !hits.length) return null

  const minScore = minScoreForTrendName(trimmed)
  let best: { url: string; score: number } | null = null
  for (const p of hits) {
    const u = p.thumbnailUrl?.trim()
    if (!u) continue
    if (shouldRejectCategory(p.category)) continue
    if (shouldRejectTitle(p.title)) continue
    const score = scoreProductTitleMatch(trimmed, p)
    if (score < minScore) continue
    if (!best || score > best.score) best = { url: u, score }
  }

  return best?.url ?? null
}
