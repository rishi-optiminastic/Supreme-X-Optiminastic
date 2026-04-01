import { demoProductImageUrl } from "@/lib/demo-product-images"

export type VariantImageFields = {
  imageUrl?: string | null
  sku: string
  id: string
}

/** Prefer explicit URL (Odoo base64 data URL or demo); else deterministic Unsplash. */
export function resolveVariantImageUrl(v: VariantImageFields): string {
  const u = v.imageUrl?.trim()
  if (u) return u
  return demoProductImageUrl(`${v.sku}:${v.id}`)
}
