import { loadRetailerOrderHistory } from "@/lib/po-draft-storage"

export type RetailerHistorySkuStat = {
  sku: string
  productName: string
  /** How many saved drafts included this SKU (at most once per draft). */
  orderCount: number
  totalDraftsConsidered: number
  typicalQty: number
  lastSavedAtIso: string
}

function medianPositiveInts(values: number[]): number {
  if (!values.length) return 1
  const sorted = [...values].map((n) => Math.max(1, Math.floor(n) || 1)).sort((a, b) => a - b)
  const mid = Math.floor(sorted.length / 2)
  return sorted.length % 2 ? sorted[mid]! : Math.round((sorted[mid - 1]! + sorted[mid]!) / 2)
}

/** Roll up saved order drafts for one retailer (newest drafts already sorted in storage). */
export function aggregateRetailerOrderHistory(retailerId: string): RetailerHistorySkuStat[] {
  const entries = loadRetailerOrderHistory(retailerId)
  if (!entries.length) return []

  type Agg = { orderHits: number; qtys: number[]; name: string; last: string }
  const bySku = new Map<string, Agg>()

  for (const e of entries) {
    const seen = new Set<string>()
    for (const l of e.lines) {
      const sku = typeof l.sku === "string" ? l.sku.trim() : ""
      if (!sku || seen.has(sku)) continue
      seen.add(sku)
      const name = typeof l.productName === "string" && l.productName.trim() ? l.productName.trim() : sku
      const qty = Math.max(1, Math.floor(Number(l.qty)) || 1)
      const cur = bySku.get(sku) ?? { orderHits: 0, qtys: [] as number[], name, last: e.savedAtIso }
      cur.orderHits += 1
      cur.qtys.push(qty)
      cur.name = name
      if (String(e.savedAtIso).localeCompare(String(cur.last)) > 0) cur.last = e.savedAtIso
      bySku.set(sku, cur)
    }
  }

  const totalDrafts = entries.length
  const rows: RetailerHistorySkuStat[] = []
  for (const [sku, v] of bySku) {
    rows.push({
      sku,
      productName: v.name,
      orderCount: v.orderHits,
      totalDraftsConsidered: totalDrafts,
      typicalQty: medianPositiveInts(v.qtys),
      lastSavedAtIso: v.last,
    })
  }
  rows.sort((a, b) => b.orderCount - a.orderCount || b.typicalQty - a.typicalQty)
  return rows
}

export function heuristicReasonForStat(s: RetailerHistorySkuStat): string {
  return `This SKU appeared in ${s.orderCount} of ${s.totalDraftsConsidered} saved order(s) for this retailer; typical quantity was ${s.typicalQty}.`
}
