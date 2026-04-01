/**
 * Demo product photos via Unsplash (hotlinking allowed per Unsplash guidelines).
 * Picks a stable image from `seed` (e.g. SKU + id) so rows stay consistent.
 */
const DEMO_IMAGES = [
  "https://images.unsplash.com/photo-1586023492125-27b2c045efd7?w=128&h=128&fit=crop&auto=format&q=80",
  "https://images.unsplash.com/photo-1506439773649-6e0eb8cfb237?w=128&h=128&fit=crop&auto=format&q=80",
  "https://images.unsplash.com/photo-1592078615290-033ee584e267?w=128&h=128&fit=crop&auto=format&q=80",
  "https://images.unsplash.com/photo-1524758631624-e2822e304c36?w=128&h=128&fit=crop&auto=format&q=80",
  "https://images.unsplash.com/photo-1518455027359-f3fc543ef0d1?w=128&h=128&fit=crop&auto=format&q=80",
  "https://images.unsplash.com/photo-1497366216548-37526070297c?w=128&h=128&fit=crop&auto=format&q=80",
  "https://images.unsplash.com/photo-1523275335684-37898b6baf30?w=128&h=128&fit=crop&auto=format&q=80",
  "https://images.unsplash.com/photo-1526170375885-4d8ecf77b99f?w=128&h=128&fit=crop&auto=format&q=80",
] as const

function hashSeed(seed: string): number {
  let h = 0
  for (let i = 0; i < seed.length; i++) {
    h = (Math.imul(31, h) + seed.charCodeAt(i)) | 0
  }
  return Math.abs(h)
}

export function demoProductImageUrl(seed: string): string {
  const idx = hashSeed(seed) % DEMO_IMAGES.length
  return DEMO_IMAGES[idx]!
}
