import {
  normalizeDummyJsonProduct,
  type DummyJsonProductRow,
  type ExternalProductHit,
} from "@/lib/external-product-search"

export const dynamic = "force-dynamic"

type DummySearchResponse = {
  products?: DummyJsonProductRow[]
  total?: number
}

/**
 * GET ?q=  — search a public sample product catalog (DummyJSON).
 * No API key; useful for “any product” discovery + trend analysis in the UI.
 */
export async function GET(req: Request) {
  const { searchParams } = new URL(req.url)
  const q = (searchParams.get("q") ?? "").trim()
  if (q.length < 2) {
    return Response.json({ products: [] as ExternalProductHit[], source: "dummyjson" })
  }

  try {
    const url = new URL("https://dummyjson.com/products/search")
    url.searchParams.set("q", q)
    url.searchParams.set("limit", "12")
    const res = await fetch(url.toString(), {
      headers: { Accept: "application/json" },
      cache: "no-store",
    })
    if (!res.ok) {
      return Response.json({ products: [], source: "dummyjson", error: "upstream" })
    }
    const data = (await res.json()) as DummySearchResponse
    const products = (data.products ?? [])
      .map((p) => normalizeDummyJsonProduct(p))
      .filter((x): x is ExternalProductHit => x != null)
    return Response.json({ products, source: "dummyjson" as const, total: data.total })
  } catch {
    return Response.json({ products: [], source: "dummyjson", error: "fetch_failed" })
  }
}
