import type { InventoryVariant } from "@/lib/inventory-types"
import type { ParsedPoLine } from "@/lib/parse-purchase-order-xlsx"
import { evaluateStockForLines, type SalesOrderLine, type StockLineResult } from "@/lib/stock-confirmation"

export type PoMatchMethod = "sku" | "name_exact" | "name_fuzzy" | "none"

export type PoStockReportRow = {
  rowIndex: number
  itemNumber: string
  description: string
  qty: number
  unitPrice: number | null
  resolvedSku: string | null
  matchMethod: PoMatchMethod
  catalogProductName: string | null
  /** Total units requested on the PO for this SKU (all lines combined). */
  skuAggregateQty: number
  sellable: number
  onHand: number
  reserved: number
  lineOk: boolean
  note: string
}

function norm(s: string): string {
  return s.trim().toLowerCase().replace(/\s+/g, " ")
}

function tokenize(s: string): string[] {
  return norm(s)
    .split(/[\s\-_,./+]+/)
    .filter((t) => t.length > 2)
}

export function resolvePoLineToCatalog(
  variants: InventoryVariant[],
  itemNumber: string,
  description: string
): { sku: string | null; method: PoMatchMethod; productName: string | null } {
  const item = norm(itemNumber).replace(/[^\w\-./]/g, "")
  const desc = norm(description)

  if (item) {
    const bySku = variants.find((v) => norm(v.sku).replace(/\s/g, "") === item.replace(/\s/g, ""))
    if (bySku) return { sku: bySku.sku, method: "sku", productName: bySku.productName }
    const bySkuLoose = variants.find((v) => norm(v.sku) === item || v.sku.toLowerCase() === item.toLowerCase())
    if (bySkuLoose) return { sku: bySkuLoose.sku, method: "sku", productName: bySkuLoose.productName }
  }

  if (desc) {
    const exact = variants.find((v) => norm(v.productName) === desc)
    if (exact) return { sku: exact.sku, method: "name_exact", productName: exact.productName }

    for (const v of variants) {
      const pn = norm(v.productName)
      if (!pn) continue
      if (desc.includes(pn) || pn.includes(desc)) {
        return { sku: v.sku, method: "name_fuzzy", productName: v.productName }
      }
    }

    const descTok = tokenize(description)
    let best: { sku: string; productName: string; score: number } | null = null
    for (const v of variants) {
      const pnTok = tokenize(v.productName)
      if (!pnTok.length || !descTok.length) continue
      let score = 0
      for (const t of descTok) {
        if (pnTok.some((p) => p === t || p.includes(t) || t.includes(p))) score++
      }
      if (score > 0 && (!best || score > best.score)) {
        best = { sku: v.sku, productName: v.productName, score }
      }
    }
    if (best && best.score >= 1) {
      return { sku: best.sku, method: "name_fuzzy", productName: best.productName }
    }
  }

  return { sku: null, method: "none", productName: null }
}

export function buildPoStockReport(variants: InventoryVariant[], parsed: ParsedPoLine[]): PoStockReportRow[] {
  const resolved = parsed.map((line) => {
    const r = resolvePoLineToCatalog(variants, line.itemNumber, line.description)
    return { line, ...r }
  })

  const aggregateBySku = new Map<string, number>()
  for (const { line, sku } of resolved) {
    if (!sku) continue
    aggregateBySku.set(sku, (aggregateBySku.get(sku) ?? 0) + line.qty)
  }

  const salesLines: SalesOrderLine[] = [...aggregateBySku.entries()].map(([sku, qty]) => ({ sku, qty }))
  const stockBySku = new Map<string, StockLineResult>()
  if (salesLines.length) {
    const results = evaluateStockForLines(variants, salesLines)
    for (const res of results) {
      stockBySku.set(res.sku, res)
    }
  }

  return resolved.map(({ line, sku, method, productName }) => {
    const agg = sku ? (aggregateBySku.get(sku) ?? line.qty) : line.qty
    const stock = sku ? stockBySku.get(sku) : undefined

    if (!sku) {
      return {
        rowIndex: line.rowIndex,
        itemNumber: line.itemNumber,
        description: line.description,
        qty: line.qty,
        unitPrice: line.unitPrice,
        resolvedSku: null,
        matchMethod: "none" as const,
        catalogProductName: null,
        skuAggregateQty: line.qty,
        sellable: 0,
        onHand: 0,
        reserved: 0,
        lineOk: false,
        note: "No catalog match — check ITEM # against SKU or align DESCRIPTION with product name.",
      }
    }

    const base = stock ?? {
      sku,
      productName: productName ?? "(unknown)",
      requested: agg,
      available: 0,
      onHand: 0,
      reserved: 0,
      ok: false,
      note: "SKU not in current catalog.",
    }

    const lineOk = base.ok
    const note =
      method === "sku"
        ? base.note
        : method === "name_exact"
          ? base.note
          : `${base.note} (matched from description — verify SKU.)`

    return {
      rowIndex: line.rowIndex,
      itemNumber: line.itemNumber,
      description: line.description,
      qty: line.qty,
      unitPrice: line.unitPrice,
      resolvedSku: sku,
      matchMethod: method,
      catalogProductName: productName,
      skuAggregateQty: agg,
      sellable: base.available,
      onHand: base.onHand,
      reserved: base.reserved,
      lineOk,
      note,
    }
  })
}

export function poReportToSalesOrderLines(rows: PoStockReportRow[]): SalesOrderLine[] {
  const m = new Map<string, number>()
  for (const r of rows) {
    if (!r.resolvedSku) continue
    m.set(r.resolvedSku, r.skuAggregateQty)
  }
  return [...m.entries()].map(([sku, qty]) => ({ sku, qty }))
}

export function formatPoStockReportText(params: {
  fileName: string
  sourceLabel: string
  rows: PoStockReportRow[]
}): string {
  const matched = params.rows.filter((r) => r.resolvedSku)
  const allOk = params.rows.length > 0 && params.rows.every((r) => r.lineOk)
  const head = [
    "Purchase order — stock confirmation",
    `File: ${params.fileName}`,
    `Generated: ${new Date().toLocaleString()}`,
    `Catalog: ${params.sourceLabel}`,
    "",
    allOk
      ? "RESULT: OK — sellable stock covers every matched line (by SKU total on the PO)."
      : "RESULT: CHECK — unmatched lines and/or insufficient sellable stock.",
    "",
    `Lines: ${params.rows.length} (${matched.length} matched to catalog)`,
    "",
  ]

  const body = params.rows.map((r) => {
    const status = r.lineOk ? "OK" : "SHORT / UNMATCHED"
    const match =
      r.matchMethod === "none"
        ? "no match"
        : `${r.resolvedSku} (${r.matchMethod.replaceAll("_", " ")})`
    return [
      `- [${status}] Row ${r.rowIndex}: ${r.description}`,
      `  ITEM #: ${r.itemNumber || "—"} | Qty: ${r.qty}${r.unitPrice != null ? ` | Unit ${r.unitPrice}` : ""}`,
      `  Match: ${match}`,
      r.resolvedSku
        ? `  SKU total on PO: ${r.skuAggregateQty} | Sellable: ${r.sellable} (OH ${r.onHand}, reserved ${r.reserved})`
        : "",
      `  ${r.note}`,
    ]
      .filter(Boolean)
      .join("\n")
  })

  return [...head, ...body].join("\n")
}
