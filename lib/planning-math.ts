import type { InventoryVariant } from "@/lib/inventory-types"

/** Estimated units per week from on-hand ÷ weeks of cover. */
export function weeklyDemand(v: InventoryVariant): number {
  const w = Math.max(v.weeksCover, 0.25)
  return v.onHand / w
}

function round1(n: number) {
  return Math.round(n * 10) / 10
}

function hash01(str: string, i: number): number {
  let h = 0
  for (const c of str + String(i)) h = (h * 31 + c.charCodeAt(0)) | 0
  return (Math.abs(h) % 1000) / 1000
}

export type ForecastPoint = {
  label: string
  /** Past weeks (estimated from current cover). */
  value: number | null
  /** Future weeks only. */
  forecast: number | null
  low: number | null
  high: number | null
}

/** Simple forward curve: noisy past, then mild growth from trend score. */
export function buildWeeklyForecast(variant: InventoryVariant): ForecastPoint[] {
  const base = weeklyDemand(variant)
  const nPast = 10
  const nFut = 8
  const growth =
    variant.trendScore >= 75 ? 1.004 : variant.trendScore <= 40 ? 0.996 : 1.001

  const rows: ForecastPoint[] = []
  let last = Math.max(0.5, base * 0.9)
  for (let i = 0; i < nPast; i++) {
    const noise = (hash01(variant.sku, i) - 0.5) * 0.14 * base
    last = Math.max(0.5, base * (0.82 + i * 0.02) + noise)
    rows.push({
      label: `${-(nPast - i)}`,
      value: round1(last),
      forecast: null,
      low: null,
      high: null,
    })
  }
  let f = Math.max(0.5, last)
  for (let j = 1; j <= nFut; j++) {
    f *= growth
    const band = Math.max(0.3, f * 0.1)
    rows.push({
      label: `+${j}`,
      value: null,
      forecast: round1(f),
      low: round1(f - band),
      high: round1(f + band),
    })
  }
  return rows
}

export type ReorderRow = {
  id: string
  sku: string
  productName: string
  onHand: number
  inbound: number
  weeksCover: number
  weeklyDemand: number
  suggestQty: number
  urgency: "high" | "medium" | "ok"
}

/** Numbers behind one SKU’s suggested order (for tooltips / explainers). */
export function reorderBreakdown(
  v: InventoryVariant,
  leadTimeWeeks = 2,
  safetyWeeks = 1,
  targetWeeks = 4
) {
  const w = weeklyDemand(v)
  const demandWeeks = targetWeeks + leadTimeWeeks + safetyWeeks
  const targetUnits = w * demandWeeks
  const available = v.onHand + v.inbound
  const suggestQty = Math.max(0, Math.ceil(targetUnits - available))
  return {
    demandWeeks,
    weeklyDemand: round1(w),
    targetUnits: Math.round(targetUnits * 10) / 10,
    available,
    suggestQty,
  }
}

export function reorderRows(
  variants: InventoryVariant[],
  leadTimeWeeks = 2,
  safetyWeeks = 1,
  targetWeeks = 4
): ReorderRow[] {
  const demandWeeks = targetWeeks + leadTimeWeeks + safetyWeeks
  return variants.map((v) => {
    const w = weeklyDemand(v)
    const targetUnits = w * demandWeeks
    const available = v.onHand + v.inbound
    const suggestQty = Math.max(0, Math.ceil(targetUnits - available))
    let urgency: ReorderRow["urgency"] = "ok"
    if (v.weeksCover < 1.25) urgency = "high"
    else if (v.weeksCover < 2.5) urgency = "medium"
    return {
      id: v.id,
      sku: v.sku,
      productName: v.productName,
      onHand: v.onHand,
      inbound: v.inbound,
      weeksCover: round1(v.weeksCover),
      weeklyDemand: round1(w),
      suggestQty,
      urgency,
    }
  })
}

export type ScenarioSkuRow = {
  sku: string
  productName: string
  weeksCoverNow: number
  weeksCoverAdjusted: number
  tight: boolean
}

/** demandPct: e.g. 20 = +20% weekly demand. extraLeadDays extends time you wait for stock. */
export function scenarioRows(
  variants: InventoryVariant[],
  demandPct: number,
  extraLeadDays: number
): { rows: ScenarioSkuRow[]; tightCount: number; totalOnHand: number } {
  const mult = 1 + demandPct / 100
  const extraWeeks = extraLeadDays / 7
  let tightCount = 0
  let totalOnHand = 0
  const rows: ScenarioSkuRow[] = variants.map((v) => {
    totalOnHand += v.onHand
    const w = weeklyDemand(v)
    const adjW = Math.max(0.01, w * mult)
    const adjCover = v.onHand / adjW
    const tight = adjCover < 1 + extraWeeks
    if (tight) tightCount++
    return {
      sku: v.sku,
      productName: v.productName,
      weeksCoverNow: round1(v.weeksCover),
      weeksCoverAdjusted: round1(adjCover),
      tight,
    }
  })
  rows.sort((a, b) => a.weeksCoverAdjusted - b.weeksCoverAdjusted)
  return { rows, tightCount, totalOnHand }
}
