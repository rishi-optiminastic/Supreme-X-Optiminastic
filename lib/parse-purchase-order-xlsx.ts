/**
 * Parse Vertex42-style and similar purchase order spreadsheets.
 * Expects a header row with DESCRIPTION (or similar) and QTY / QUANTITY columns.
 * ITEM # / SKU column is optional but improves catalog matching.
 */

export type ParsedPoLine = {
  /** 1-based sheet row for display */
  rowIndex: number
  itemNumber: string
  description: string
  qty: number
  unitPrice: number | null
}

export type ParsePurchaseOrderResult =
  | { ok: true; sheetName: string; lines: ParsedPoLine[] }
  | { ok: false; error: string }

function normalizeHeaderCell(v: unknown): string {
  if (v == null || v === "") return ""
  return String(v)
    .trim()
    .toLowerCase()
    .replace(/\s+/g, " ")
}

function cellToQty(v: unknown): number | null {
  if (typeof v === "number" && Number.isFinite(v) && v > 0) return Math.max(1, Math.floor(v))
  const s = String(v ?? "")
    .trim()
    .replace(/,/g, "")
  if (!s) return null
  const n = parseFloat(s)
  if (!Number.isFinite(n) || n <= 0) return null
  return Math.max(1, Math.floor(n))
}

function cellToPrice(v: unknown): number | null {
  if (typeof v === "number" && Number.isFinite(v) && v >= 0) return v
  const s = String(v ?? "")
    .trim()
    .replace(/,/g, "")
  if (!s) return null
  const n = parseFloat(s)
  return Number.isFinite(n) && n >= 0 ? n : null
}

function cellToText(v: unknown): string {
  if (v == null || v === "") return ""
  if (v instanceof Date) return v.toISOString().slice(0, 10)
  return String(v).trim()
}

function stripItemBrackets(s: string): string {
  return s.replace(/^\[+/, "").replace(/\]+$/, "").trim()
}

function detectTable(
  matrix: unknown[][]
): {
  headerRow: number
  itemCol: number | null
  descCol: number
  qtyCol: number
  unitPriceCol: number
} | null {
  const maxScan = Math.min(matrix.length, 50)
  for (let r = 0; r < maxScan; r++) {
    const row = matrix[r]
    if (!Array.isArray(row) || row.length === 0) continue
    const cells = row.map((c) => normalizeHeaderCell(c))
    let itemCol = -1
    let descCol = -1
    let qtyCol = -1
    let unitPriceCol = -1

    for (let c = 0; c < cells.length; c++) {
      const t = cells[c]
      if (!t) continue
      if (
        itemCol < 0 &&
        (t === "item #" ||
          t === "item no" ||
          t === "item no." ||
          t === "item number" ||
          (t.includes("item") && (t.includes("#") || t.endsWith(" no"))) ||
          t === "sku" ||
          t.includes("article") ||
          t.includes("part #"))
      ) {
        itemCol = c
      }
      if (
        descCol < 0 &&
        (t === "description" || (t.includes("description") && !t.includes("item #")) || t === "product" || t === "product name")
      ) {
        descCol = c
      }
      if (qtyCol < 0 && (t === "qty" || t === "quantity" || t.startsWith("qty ") || t === "order qty")) {
        qtyCol = c
      }
      if (
        unitPriceCol < 0 &&
        (t.includes("unit price") || t === "unit cost" || (t.includes("price") && !t.includes("total")))
      ) {
        unitPriceCol = c
      }
    }

    if (descCol < 0) {
      for (let c = 0; c < cells.length; c++) {
        const t = cells[c]
        if (t === "description" || (t.includes("description") && c !== itemCol)) {
          descCol = c
          break
        }
      }
    }

    if (qtyCol >= 0 && descCol >= 0) {
      const resolvedItemCol = itemCol >= 0 && itemCol !== descCol ? itemCol : null
      if (unitPriceCol < 0) unitPriceCol = -1
      return { headerRow: r, itemCol: resolvedItemCol, descCol, qtyCol, unitPriceCol }
    }
  }
  return null
}

export async function parsePurchaseOrderXlsx(buffer: ArrayBuffer): Promise<ParsePurchaseOrderResult> {
  try {
    const XLSX = await import("xlsx")
    const wb = XLSX.read(buffer, { type: "array", cellDates: true, raw: false })
    const sheetName = wb.SheetNames[0]
    if (!sheetName) return { ok: false, error: "The workbook has no sheets." }
    const sheet = wb.Sheets[sheetName]
    if (!sheet) return { ok: false, error: "Could not read the first sheet." }

    const matrix = XLSX.utils.sheet_to_json<unknown[]>(sheet, { header: 1, defval: "" }) as unknown[][]
    const table = detectTable(matrix)
    if (!table) {
      return {
        ok: false,
        error:
          "Could not find a PO line table. Use a header row with DESCRIPTION and QTY (and optional ITEM #), like the Vertex42 Purchase Order template.",
      }
    }

    const { headerRow, itemCol, descCol, qtyCol, unitPriceCol } = table
    const lines: ParsedPoLine[] = []
    let emptyStreak = 0

    for (let r = headerRow + 1; r < matrix.length; r++) {
      const row = matrix[r] ?? []
      const desc = cellToText(row[descCol])
      const qty = cellToQty(row[qtyCol])
      const itemRaw = itemCol != null ? cellToText(row[itemCol]) : ""
      const itemNumber = stripItemBrackets(itemRaw)

      if (!desc && !qty) {
        emptyStreak++
        if (emptyStreak >= 4) break
        continue
      }
      emptyStreak = 0

      if (!qty) continue
      if (!desc) continue

      const unitPrice = unitPriceCol >= 0 ? cellToPrice(row[unitPriceCol]) : null
      lines.push({
        rowIndex: r + 1,
        itemNumber,
        description: desc,
        qty,
        unitPrice,
      })
    }

    if (lines.length === 0) {
      return {
        ok: false,
        error: "Found headers but no line rows with both a description and a positive quantity.",
      }
    }

    return { ok: true, sheetName, lines }
  } catch (e) {
    return {
      ok: false,
      error: e instanceof Error ? e.message : "Could not read this Excel file.",
    }
  }
}
