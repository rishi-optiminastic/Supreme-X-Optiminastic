import type { InventoryVariant } from "@/lib/inventory-types"
import {
  defaultExternalSignals,
  demandProbabilityBreakdown,
} from "@/lib/intelligence"

/** Map internal demand model to a “market momentum” % (negative = down, positive = up). */
export function variantMarketSignal(v: InventoryVariant) {
  const breakdown = demandProbabilityBreakdown(v, defaultExternalSignals)
  const prob = breakdown.total
  const momentumPct = Math.round(
    Math.max(-48, Math.min(48, (prob - 52) * 1.05))
  )
  const dataPoints = breakdown.parts.filter((p) => Math.abs(p.points) > 0.5).length
  const confidence = Math.min(90, 52 + dataPoints * 7 + (v.salesQty90d != null ? 8 : 0))
  return {
    momentumPct,
    confidence,
    demandProb: prob,
    bandLow: breakdown.bandLow,
    bandHigh: breakdown.bandHigh,
  }
}

export function findVariantsBySearch(variants: InventoryVariant[], query: string) {
  const s = query.trim().toLowerCase()
  if (!s) return []
  return variants.filter(
    (v) =>
      v.sku.toLowerCase().includes(s) ||
      v.productName.toLowerCase().includes(s) ||
      v.attributes.toLowerCase().includes(s)
  )
}

export type OverallMarketSummary = {
  avgTrend: number
  hotCount: number
  coolCount: number
  neutralCount: number
  momentumPct: number
  confidence: number
  total: number
}

export function overallInventoryMarket(variants: InventoryVariant[]): OverallMarketSummary | null {
  if (!variants.length) return null
  const scores = variants.map((v) => v.trendScore)
  const avg = scores.reduce((a, b) => a + b, 0) / scores.length
  const hotCount = variants.filter((v) => v.trendScore >= 68).length
  const coolCount = variants.filter((v) => v.trendScore < 42).length
  const neutralCount = variants.length - hotCount - coolCount
  const momentumPct = Math.round(Math.max(-40, Math.min(40, (avg - 50) * 1.4)))
  const confidence = Math.min(
    85,
    58 + Math.min(22, Math.floor(variants.length / 2))
  )
  return {
    avgTrend: Math.round(avg * 10) / 10,
    hotCount,
    coolCount,
    neutralCount: Math.max(0, neutralCount),
    momentumPct,
    confidence,
    total: variants.length,
  }
}

/** Placeholder when the search term does not match inventory and AI is unavailable. */
export function heuristicSearchMarket(query: string) {
  const q = query.trim()
  if (!q) {
    return {
      momentumPct: 0,
      confidence: 0,
      summary: "Enter a product name or keyword to see a sample market read.",
    }
  }
  let h = 0
  for (let i = 0; i < q.length; i++) {
    h = (Math.imul(31, h) + q.charCodeAt(i)) | 0
  }
  const u = Math.abs(h) % 100
  const momentumPct = Math.round((u / 99) * 70 - 35)
  const confidence = 42 + (Math.abs(h) % 35)
  return {
    momentumPct,
    confidence,
    summary:
      "Illustrative only — no match in your catalog and no live market feed. Connect external data or pick a product from inventory for a data-backed read.",
  }
}
