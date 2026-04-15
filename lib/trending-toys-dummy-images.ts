import {
  normalizeDummyJsonProduct,
  type DummyJsonProductRow,
} from "@/lib/external-product-search"
import { pickBestThumbnailFromExternalHits } from "@/lib/thumbnail-relevance"

type DummySearchResponse = {
  products?: DummyJsonProductRow[]
}

/**
 * Best-effort thumbnail from DummyJSON search for AI trend labels (often not exact SKUs).
 * Tries full name, then first few words.
 */
export async function fetchDummyJsonThumbnailForProductName(
  name: string
): Promise<string | null> {
  const trimmed = name.trim()
  if (trimmed.length < 2) return null

  const queries: string[] = [trimmed.slice(0, 48)]
  const words = trimmed.split(/\s+/).filter(Boolean)
  if (words.length > 2) {
    queries.push(words.slice(0, 3).join(" "))
  }
  if (words.length > 1 && words[0]!.length >= 3) {
    queries.push(words[0]!.slice(0, 48))
  }

  const tried = new Set<string>()
  for (const q of queries) {
    const s = q.trim()
    if (s.length < 2 || tried.has(s)) continue
    tried.add(s)
    try {
      const url = new URL("https://dummyjson.com/products/search")
      url.searchParams.set("q", s)
      url.searchParams.set("limit", "10")
      const res = await fetch(url.toString(), {
        headers: { Accept: "application/json" },
        next: { revalidate: 86_400 },
      })
      if (!res.ok) continue
      const data = (await res.json()) as DummySearchResponse
      const products = (data.products ?? [])
        .map((p) => normalizeDummyJsonProduct(p))
        .filter((x): x is NonNullable<typeof x> => x != null)
      const picked = pickBestThumbnailFromExternalHits(trimmed, products)
      if (picked) return picked
    } catch {
      /* try next query */
    }
  }
  return null
}
