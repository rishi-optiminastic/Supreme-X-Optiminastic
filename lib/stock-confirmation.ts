import type { InventoryVariant } from "@/lib/inventory-types"

export type SalesOrderLine = {
  sku: string
  qty: number
}

export type StockLineResult = {
  sku: string
  productName: string
  requested: number
  /** Sellable = on hand minus reserved */
  available: number
  onHand: number
  reserved: number
  ok: boolean
  note: string
}

export function evaluateStockForLines(
  variants: InventoryVariant[],
  lines: SalesOrderLine[]
): StockLineResult[] {
  const bySku = new Map(variants.map((v) => [v.sku, v]))
  return lines.map((line) => {
    const v = bySku.get(line.sku)
    if (!v) {
      return {
        sku: line.sku,
        productName: "(unknown SKU)",
        requested: line.qty,
        available: 0,
        onHand: 0,
        reserved: 0,
        ok: false,
        note: "SKU not in current catalog.",
      }
    }
    const sellable = Math.max(0, v.onHand - v.reserved)
    const ok = sellable >= line.qty
    return {
      sku: v.sku,
      productName: v.productName,
      requested: line.qty,
      available: sellable,
      onHand: v.onHand,
      reserved: v.reserved,
      ok,
      note: ok
        ? "Enough stock to cover this line (sellable on hand)."
        : `Short by ${line.qty - sellable} units (sellable on hand).`,
    }
  })
}

export function formatStockConfirmationReport(params: {
  title: string
  sourceLabel: string
  lines: SalesOrderLine[]
  results: StockLineResult[]
}): string {
  const allOk = params.results.length > 0 && params.results.every((r) => r.ok)
  const head = [
    params.title,
    `Generated: ${new Date().toLocaleString()}`,
    `Catalog: ${params.sourceLabel}`,
    "",
    allOk ? "RESULT: OK — sellable stock covers all lines." : "RESULT: CHECK — one or more lines are short.",
    "",
    "Lines:",
  ]
  const body = params.results.map((r) => {
    const status = r.ok ? "OK" : "SHORT"
    return [
      `- [${status}] ${r.sku} — ${r.productName}`,
      `  Requested: ${r.requested} | Sellable: ${r.available} (on hand ${r.onHand}, reserved ${r.reserved})`,
      `  ${r.note}`,
    ].join("\n")
  })
  return [...head, ...body].join("\n")
}
