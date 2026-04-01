/** Shared trend math for demo + live Odoo-derived inventory */

export type TrendScoreRow = { trendScore: number }

export type SourceToggle = { enabled: boolean }

export function computeSeries(
  variants: TrendScoreRow[],
  sources: SourceToggle[],
  type: "market" | "system"
): number[] {
  const active = sources.filter((s) => s.enabled).length || 1
  const avgTrend =
    variants.length > 0
      ? variants.reduce((a, v) => a + v.trendScore, 0) / variants.length
      : 70
  const base =
    type === "market"
      ? [52, 55, 58, 61, 64, 67].map((n) => n + (avgTrend - 70) * 0.15)
      : [48, 52, 51, 56, 60, 63].map((n) => n + active * 0.8)
  return base.map((n) => Math.round(Math.min(100, Math.max(35, n))))
}

export function blendPrediction(market: number[], system: number[]): number[] {
  return market.map((m, i) =>
    Math.round(m * 0.45 + (system[i] ?? m) * 0.55)
  )
}
