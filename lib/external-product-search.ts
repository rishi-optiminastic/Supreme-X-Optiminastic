/** Normalized hit from a public product search API (used for trend lookup, not Odoo). */
export type ExternalProductHit = {
  id: string
  title: string
  brand: string | null
  category: string
  price: number
  thumbnailUrl: string
}

export type DummyJsonProductRow = {
  id?: number
  title?: string
  brand?: string
  category?: string
  price?: number
  thumbnail?: string
}

export function normalizeDummyJsonProduct(raw: DummyJsonProductRow): ExternalProductHit | null {
  if (raw.id == null || typeof raw.title !== "string" || !raw.title.trim()) return null
  const brand = typeof raw.brand === "string" && raw.brand.trim() ? raw.brand.trim() : null
  const category =
    typeof raw.category === "string" && raw.category.trim() ? raw.category.trim() : "general"
  return {
    id: String(raw.id),
    title: raw.title.trim(),
    brand,
    category,
    price: typeof raw.price === "number" && Number.isFinite(raw.price) ? raw.price : 0,
    thumbnailUrl: typeof raw.thumbnail === "string" ? raw.thumbnail : "",
  }
}

export function marketQueryFromExternalHit(hit: ExternalProductHit): string {
  return [hit.title, hit.brand, hit.category].filter(Boolean).join(" · ")
}
