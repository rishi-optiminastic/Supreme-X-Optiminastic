/** Fill retailer-uploaded order templates (Excel placeholders, PDF AcroForm text fields). */

export type FillOrderLine = {
  sku: string
  productName: string
  qty: number
  unitPrice: number
  discountPct: number
  vatPct: number
}

export type OrderTemplateFillInput = {
  retailerName: string
  orderRef: string
  orderDateIso: string
  deliveryDateIso: string
  retailerCode: string
  deliverTo: string
  paymentTerms: string
  currency: string
  notes: string
  lines: FillOrderLine[]
  totals: { qtyTotal: number; gross: number; discounted: number; vat: number; net: number }
}

function round2(n: number) {
  return Math.round(n * 100) / 100
}

function formatDateDisplay(iso: string): string {
  if (!iso || iso.length < 10) return iso
  const [y, m, d] = iso.slice(0, 10).split("-")
  return y && m && d ? `${d}/${m}/${y}` : iso
}

function lineValue(l: FillOrderLine) {
  return round2(l.qty * l.unitPrice * (1 - l.discountPct / 100))
}

function buildLineItemsBlock(input: OrderTemplateFillInput): string {
  return input.lines
    .map((l, i) => {
      const v = lineValue(l)
      return `${i + 1}. ${l.productName} (${l.sku}) — Qty ${l.qty}, Rate ${input.currency} ${l.unitPrice.toFixed(2)}, Disc ${l.discountPct}%, VAT ${l.vatPct}%, Line ${v.toFixed(2)}`
    })
    .join("\n")
}

/** Tokens must include braces, e.g. {{ORDER_REF}} */
export function buildExcelPlaceholderMap(input: OrderTemplateFillInput): Record<string, string> {
  const lineBlock = buildLineItemsBlock(input)
  const m: Record<string, string> = {
    "{{ORDER_REF}}": input.orderRef,
    "{{ORDER_DATE}}": formatDateDisplay(input.orderDateIso),
    "{{DELIVERY_DATE}}": formatDateDisplay(input.deliveryDateIso),
    "{{RETAILER_NAME}}": input.retailerName,
    "{{RETAILER_CODE}}": input.retailerCode,
    "{{DELIVER_TO}}": input.deliverTo,
    "{{CURRENCY}}": input.currency,
    "{{PAYMENT_TERMS}}": input.paymentTerms,
    "{{NOTES}}": input.notes,
    "{{NET_TOTAL}}": input.totals.net.toFixed(2),
    "{{GROSS_TOTAL}}": input.totals.gross.toFixed(2),
    "{{AFTER_DISCOUNT_TOTAL}}": input.totals.discounted.toFixed(2),
    "{{VAT_TOTAL}}": input.totals.vat.toFixed(2),
    "{{QTY_TOTAL}}": String(input.totals.qtyTotal),
    "{{LINE_ITEMS}}": lineBlock,
  }
  for (let i = 0; i < 50; i++) {
    const line = input.lines[i]
    const n = i + 1
    m[`{{LINE_${n}_SKU}}`] = line?.sku ?? ""
    m[`{{LINE_${n}_NAME}}`] = line?.productName ?? ""
    m[`{{LINE_${n}_QTY}}`] = line ? String(line.qty) : ""
    m[`{{LINE_${n}_RATE}}`] = line ? line.unitPrice.toFixed(2) : ""
    m[`{{LINE_${n}_DISC}}`] = line ? String(line.discountPct) : ""
    m[`{{LINE_${n}_VAT}}`] = line ? String(line.vatPct) : ""
    m[`{{LINE_${n}_VALUE}}`] = line ? lineValue(line).toFixed(2) : ""
  }
  return m
}

function normalizePdfFieldName(name: string): string {
  return name.trim().toLowerCase().replace(/[\s.]+/g, "_")
}

/** Map normalized PDF field name → value (many aliases). */
function buildPdfValueLookup(input: OrderTemplateFillInput): Map<string, string> {
  const lineBlock = buildLineItemsBlock(input)
  const m = new Map<string, string>()
  const add = (aliases: string[], v: string) => {
    for (const a of aliases) m.set(normalizePdfFieldName(a), v)
  }
  add(["order_ref", "orderref", "order_no", "order_number", "po_number", "reference", "ord_ref"], input.orderRef)
  add(["order_date", "orderdate", "date"], formatDateDisplay(input.orderDateIso))
  add(["delivery_date", "deliverydate", "requested_delivery", "ship_date"], formatDateDisplay(input.deliveryDateIso))
  add(["retailer_name", "retailer", "customer_name", "customer", "store_name", "buyer"], input.retailerName)
  add(["retailer_code", "customer_code", "account_code", "vendor_code"], input.retailerCode)
  add(["deliver_to", "delivery_address", "ship_to", "address"], input.deliverTo)
  add(["currency", "curr"], input.currency)
  add(["payment_terms", "payment", "terms"], input.paymentTerms)
  add(["notes", "remarks", "comments"], input.notes)
  add(["net_total", "net", "total", "grand_total", "amount_due"], input.totals.net.toFixed(2))
  add(["gross_total", "subtotal", "before_discount"], input.totals.gross.toFixed(2))
  add(["after_discount_total", "discounted_total"], input.totals.discounted.toFixed(2))
  add(["vat_total", "tax_total", "vat"], input.totals.vat.toFixed(2))
  add(["qty_total", "total_qty", "quantity_total"], String(input.totals.qtyTotal))
  add(["line_items", "lines", "order_lines", "products", "details"], lineBlock)
  for (let i = 0; i < 30; i++) {
    const line = input.lines[i]
    const n = i + 1
    if (!line) continue
    add([`line_${n}_sku`, `sku_${n}`, `item_${n}_sku`], line.sku)
    add([`line_${n}_name`, `product_${n}`, `item_${n}_desc`, `description_${n}`], line.productName)
    add([`line_${n}_qty`, `qty_${n}`, `quantity_${n}`], String(line.qty))
    add([`line_${n}_rate`, `rate_${n}`, `price_${n}`], line.unitPrice.toFixed(2))
    add([`line_${n}_value`, `line_${n}_total`, `value_${n}`], lineValue(line).toFixed(2))
  }
  return m
}

export type FilledTemplateOk = {
  ok: true
  data: Uint8Array
  /** Suggested download file name */
  fileName: string
  mimeType: string
  /** Excel cells whose text contained at least one replaced token */
  replacedCells?: number
  /** Shown when spreadsheet had zero placeholder hits */
  warning?: string
}

export type FilledTemplateErr = { ok: false; error: string }

export type FilledTemplateResult = FilledTemplateOk | FilledTemplateErr

function outputBaseName(originalFileName: string): string {
  const base = originalFileName.replace(/\.[^./\\]+$/i, "")
  return `${base}-filled`
}

export async function fillUploadedOrderTemplate(
  buffer: ArrayBuffer,
  originalFileName: string,
  mimeType: string,
  input: OrderTemplateFillInput
): Promise<FilledTemplateResult> {
  const lower = originalFileName.toLowerCase()
  const isPdf = lower.endsWith(".pdf") || mimeType.includes("pdf")
  const isCsv = lower.endsWith(".csv") || mimeType.includes("csv")
  const isExcel =
    /\.(xlsx|xls|xlsm|xlsb)$/i.test(lower) ||
    mimeType.includes("spreadsheet") ||
    mimeType.includes("excel") ||
    (mimeType.includes("officedocument") && mimeType.includes("sheet"))

  if (isPdf) return fillPdfTemplate(buffer, originalFileName, input)
  if (isCsv || isExcel) return fillSpreadsheetTemplate(buffer, originalFileName, mimeType, isCsv, input)

  return {
    ok: false,
    error:
      "This file type cannot be auto-filled here. Use .xlsx / .xls / .csv with {{placeholders}} in cells, or a PDF with fillable text fields.",
  }
}

async function fillSpreadsheetTemplate(
  buffer: ArrayBuffer,
  originalFileName: string,
  _mimeType: string,
  isCsv: boolean,
  input: OrderTemplateFillInput
): Promise<FilledTemplateResult> {
  const lower = originalFileName.toLowerCase()
  const useExcelJs =
    !isCsv && (lower.endsWith(".xlsx") || lower.endsWith(".xlsm") || lower.endsWith(".xlsb"))

  if (useExcelJs) {
    try {
      return await fillSpreadsheetExcelJsPreserve(buffer, originalFileName, input)
    } catch {
      /* fall through to SheetJS — may lose formatting */
    }
  }

  return fillSpreadsheetSheetJs(buffer, originalFileName, isCsv, input)
}

/** SheetJS path: strips most Excel styling on .xlsx write — used for CSV, legacy xls, or ExcelJS fallback. */
async function fillSpreadsheetSheetJs(
  buffer: ArrayBuffer,
  originalFileName: string,
  isCsv: boolean,
  input: OrderTemplateFillInput
): Promise<FilledTemplateResult> {
  const XLSX = await import("xlsx")
  const wb = XLSX.read(buffer, { type: "array", cellDates: true, raw: false })
  const repl = buildExcelPlaceholderMap(input)
  let replacedCells = 0

  for (const sheetName of wb.SheetNames) {
    const sheet = wb.Sheets[sheetName]
    if (!sheet["!ref"]) continue
    const range = XLSX.utils.decode_range(sheet["!ref"])
    for (let R = range.s.r; R <= range.e.r; R++) {
      for (let C = range.s.c; C <= range.e.c; C++) {
        const addr = XLSX.utils.encode_cell({ r: R, c: C })
        const cell = sheet[addr]
        if (!cell) continue
        const raw = cell.w != null ? String(cell.w) : cell.v != null ? String(cell.v) : ""
        if (!raw.includes("{{")) continue
        let next = raw
        for (const [token, value] of Object.entries(repl)) {
          if (next.includes(token)) next = next.split(token).join(value)
        }
        if (next !== raw) {
          replacedCells++
          cell.v = next
          cell.t = "s"
          delete cell.w
          delete (cell as { z?: string }).z
        }
      }
    }
  }

  if (replacedCells === 0 && wb.SheetNames.length > 0) {
    replacedCells = fillFirstSheetByHeader(wb.Sheets[wb.SheetNames[0]!], XLSX, input)
  }

  const base = outputBaseName(originalFileName)
  let warning: string | undefined
  if (replacedCells === 0) {
    warning =
      "No {{placeholders}} were found in the workbook — the file was saved unchanged. Add tokens like {{ORDER_REF}} or {{LINE_ITEMS}} to your template."
  }
  if (!isCsv && !originalFileName.toLowerCase().endsWith(".csv")) {
    warning = [warning, "Note: this copy was saved with limited formatting. Prefer .xlsx upload for full template design."]
      .filter(Boolean)
      .join(" ")
  }

  if (isCsv) {
    const ws = wb.Sheets[wb.SheetNames[0]!]
    if (!ws) return { ok: false, error: "Could not read CSV sheet." }
    const csv = XLSX.utils.sheet_to_csv(ws)
    const enc = new TextEncoder()
    return {
      ok: true,
      data: enc.encode(csv),
      fileName: `${base}.csv`,
      mimeType: "text/csv;charset=utf-8",
      replacedCells,
      warning,
    }
  }

  const outBuf = XLSX.write(wb, { bookType: "xlsx", type: "array" }) as Uint8Array
  return {
    ok: true,
    data: outBuf,
    fileName: `${base}.xlsx`,
    mimeType: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    replacedCells,
    warning,
  }
}

function excelCellDisplayText(cell: import("exceljs").Cell): string {
  const v = cell.value
  if (v == null || v === "") return ""
  if (typeof v === "string") return v
  if (typeof v === "number" || typeof v === "boolean") return String(v)
  if (v instanceof Date) return v.toISOString().slice(0, 10)
  if (typeof v === "object" && v !== null && "richText" in v) {
    const rt = (v as { richText: { text: string }[] }).richText
    return Array.isArray(rt) ? rt.map((x) => x.text).join("") : ""
  }
  if (typeof v === "object" && v !== null && "formula" in v) {
    const res = (v as { result?: unknown }).result
    return res != null ? String(res) : ""
  }
  return String(v)
}

async function fillSpreadsheetExcelJsPreserve(
  buffer: ArrayBuffer,
  originalFileName: string,
  input: OrderTemplateFillInput
): Promise<FilledTemplateResult> {
  const ExcelJS = (await import("exceljs")).default
  const wb = new ExcelJS.Workbook()
  await wb.xlsx.load(buffer)

  const repl = buildExcelPlaceholderMap(input)
  let replacedCells = 0

  wb.eachSheet((ws) => {
    if (ws.name.startsWith("©")) return
    ws.eachRow({ includeEmpty: false }, (row) => {
      row.eachCell({ includeEmpty: false }, (cell) => {
        const raw = excelCellDisplayText(cell)
        if (!raw.includes("{{")) return
        let next = raw
        for (const [token, value] of Object.entries(repl)) {
          if (next.includes(token)) next = next.split(token).join(value)
        }
        if (next !== raw) {
          cell.value = next
          replacedCells++
        }
      })
    })
  })

  if (replacedCells === 0) {
    wb.eachSheet((ws) => {
      if (ws.name.startsWith("©")) return
      replacedCells += injectVertexOrderFormExcelJs(ws, input)
    })
  }

  if (replacedCells === 0) {
    const first = wb.worksheets[0]
    if (first) replacedCells += fillWorksheetByHeaderExcelJs(first, input)
  }

  const base = outputBaseName(originalFileName)
  let warning: string | undefined
  if (replacedCells === 0) {
    warning =
      "No placeholders or known layout matched — nothing was written. Add {{ORDER_REF}} etc. or use a supported order form layout."
  }

  const out = await wb.xlsx.writeBuffer()
  const data = out instanceof Uint8Array ? out : new Uint8Array(out)
  return {
    ok: true,
    data,
    fileName: `${base}.xlsx`,
    mimeType: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    replacedCells,
    warning,
  }
}

function injectVertexOrderFormExcelJs(ws: import("exceljs").Worksheet, input: OrderTemplateFillInput): number {
  let n = 0
  const put = (addr: string, v: string | number | Date) => {
    ws.getCell(addr).value = v
    n++
  }

  const e2 = normalizeHeader(excelCellDisplayText(ws.getCell("E2")))
  const a18 = normalizeHeader(excelCellDisplayText(ws.getCell("A18")))
  const b18 = normalizeHeader(excelCellDisplayText(ws.getCell("B18")))
  const basic =
    e2.includes("work order") && e2.includes("#") && a18 === "qty" && b18.includes("description")

  const a20 = normalizeHeader(excelCellDisplayText(ws.getCell("A20")))
  const a30 = normalizeHeader(excelCellDisplayText(ws.getCell("A30")))
  const d30 = normalizeHeader(excelCellDisplayText(ws.getCell("D30")))
  const advanced = a20.includes("service") && a20.includes("labor") && a30.includes("parts") && d30 === "qty"

  if (!basic && !advanced) return 0

  const [y, mo, d] = input.orderDateIso.slice(0, 10).split("-").map(Number)
  const orderDate = y && mo && d ? new Date(y, mo - 1, d) : new Date()

  const jobLines = [
    `Delivery: ${formatDateDisplay(input.deliveryDateIso)}`,
    input.deliverTo.trim() || "As per retailer agreement",
    `Currency: ${input.currency.trim() || "AED"}`,
    `Payment: ${input.paymentTerms.trim() || "90 days from document date"}`,
    input.notes.trim() ? `Notes: ${input.notes.trim()}` : null,
  ].filter(Boolean) as string[]
  if (basic && input.lines.length > 10) {
    jobLines.push(`(Table shows first 10 of ${input.lines.length} line items.)`)
  }
  if (advanced && input.lines.length > 5) {
    jobLines.push(`(Parts table shows first 5 of ${input.lines.length} lines.)`)
  }

  put("E3", input.orderRef)
  put("E6", orderDate)
  put("B9", input.retailerName)
  put("C9", input.retailerCode.trim() || "—")
  put("C12", jobLines.join("\n"))

  const vatDec =
    input.lines.length > 0 ? input.lines.reduce((s, l) => s + l.vatPct, 0) / input.lines.length / 100 : 0

  if (basic) {
    for (let i = 0; i < 10; i++) {
      const r = 19 + i
      const line = input.lines[i]
      if (line) {
        const unit = round2(line.unitPrice * (1 - line.discountPct / 100))
        put(`A${r}`, line.qty)
        put(`B${r}`, `${line.productName} (${line.sku})`)
        put(`D${r}`, line.vatPct > 0 ? "x" : "")
        put(`E${r}`, unit)
      } else {
        put(`A${r}`, 0)
        put(`B${r}`, "")
        put(`D${r}`, "")
        put(`E${r}`, 0)
      }
    }
    put("F31", vatDec)
  }

  if (advanced) {
    for (let r = 21; r <= 24; r++) {
      put(`A${r}`, "")
      put(`D${r}`, 0)
      put(`E${r}`, 0)
    }
    for (let i = 0; i < 5; i++) {
      const r = 31 + i
      const line = input.lines[i]
      if (line) {
        const unit = round2(line.unitPrice * (1 - line.discountPct / 100))
        put(`A${r}`, `${line.productName} (${line.sku})`)
        put(`D${r}`, line.qty)
        put(`E${r}`, unit)
      } else {
        put(`A${r}`, "")
        put(`D${r}`, 0)
        put(`E${r}`, 0)
      }
    }
    put("F27", 0)
    put("F37", vatDec)
  }

  return n
}

function fillWorksheetByHeaderExcelJs(ws: import("exceljs").Worksheet, input: OrderTemplateFillInput): number {
  let touched = 0
  const read = (r: number, c: number) => normalizeHeader(excelCellDisplayText(ws.getCell(r, c)))
  const write = (r: number, c: number, v: string | number | Date) => {
    ws.getCell(r, c).value = v
    touched++
  }

  const lastRow = Math.min(ws.actualRowCount || 80, 120)
  const lastCol = 40

  for (let r = 1; r <= Math.min(lastRow, 40); r++) {
    for (let c = 1; c <= 20; c++) {
      const t = read(r, c)
      if (!t) continue
      if (t.includes("work order") && t.includes("#")) {
        write(r + 1, c, input.orderRef)
        continue
      }
      if (t === "date") {
        const [y, mo, d] = input.orderDateIso.slice(0, 10).split("-").map(Number)
        if (y && mo && d) write(r + 1, c, new Date(y, mo - 1, d))
        continue
      }
      if (t === "customer name") {
        write(r, c + 1, input.retailerName)
        continue
      }
      if (t.includes("customer id")) {
        write(r + 1, c, input.retailerCode.trim() || "—")
        continue
      }
      if (t.includes("job details")) {
        write(
          r + 1,
          c,
          [`Delivery: ${formatDateDisplay(input.deliveryDateIso)}`, input.deliverTo, input.notes].filter(Boolean).join("\n")
        )
      }
    }
  }

  let headerRow = -1
  let qtyCol = -1
  let descCol = -1
  let priceCol = -1
  let skuCol = -1

  for (let r = 1; r <= Math.min(lastRow, 80); r++) {
    let q = -1,
      d = -1,
      p = -1,
      s = -1
    for (let c = 1; c <= lastCol; c++) {
      const t = read(r, c)
      if (!t) continue
      if (q < 0 && (t === "qty" || t.includes("quantity"))) q = c
      if (d < 0 && (t.includes("description") || t.includes("product name") || t === "item")) d = c
      if (p < 0 && (t.includes("unit price") || t === "price" || t.includes("unit cost"))) p = c
      if (
        s < 0 &&
        (t.includes("vendor article") || t.includes("article code") || t === "sku" || t.includes("item number"))
      ) {
        s = c
      }
    }
    if (q >= 0 && d >= 0 && p >= 0 && s >= 0) {
      headerRow = r
      qtyCol = q
      descCol = d
      priceCol = p
      skuCol = s
      break
    }
    if (q >= 0 && d >= 0 && p >= 0) {
      headerRow = r
      qtyCol = q
      descCol = d
      priceCol = p
      skuCol = -1
      break
    }
  }

  if (headerRow < 0) return touched

  const maxRows = Math.min(input.lines.length, 25)
  for (let i = 0; i < maxRows; i++) {
    const row = headerRow + 1 + i
    const l = input.lines[i]!
    if (skuCol >= 0) write(row, skuCol, l.sku)
    write(row, qtyCol, l.qty)
    write(row, descCol, `${l.productName} (${l.sku})`)
    write(row, priceCol, round2(l.unitPrice * (1 - l.discountPct / 100)))
  }

  return touched
}

function normalizeHeader(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, " ").replace(/\s+/g, " ").trim()
}

function fillFirstSheetByHeader(sheet: any, XLSX: any, input: OrderTemplateFillInput): number {
  if (!sheet?.["!ref"]) return 0
  const range = XLSX.utils.decode_range(sheet["!ref"])
  const read = (r: number, c: number): string => {
    const addr = XLSX.utils.encode_cell({ r, c })
    const cell = sheet[addr]
    if (!cell) return ""
    if (cell.w != null) return String(cell.w)
    if (cell.v != null) return String(cell.v)
    return ""
  }
  const write = (r: number, c: number, v: string | number) => {
    const addr = XLSX.utils.encode_cell({ r, c })
    const prev = sheet[addr] ?? {}
    sheet[addr] = { ...prev, v, t: typeof v === "number" ? "n" : "s" }
  }

  let touched = 0

  // Fill common header fields near labels in first sheet.
  for (let r = range.s.r; r <= Math.min(range.e.r, 40); r++) {
    for (let c = range.s.c; c <= Math.min(range.e.c, 20); c++) {
      const t = normalizeHeader(read(r, c))
      if (!t) continue
      if (t.includes("work order #") || t === "order ref" || t === "reference") {
        write(r + 1, c, input.orderRef)
        touched++
      } else if (t === "date" || t.includes("order date")) {
        write(r + 1, c, formatDateDisplay(input.orderDateIso))
        touched++
      } else if (t.includes("customer name") || t.includes("requested by") || t === "customer") {
        write(r + 1, c, input.retailerName)
        touched++
      } else if (t.includes("customer id") || t.includes("retailer code")) {
        write(r + 1, c, input.retailerCode || "—")
        touched++
      } else if (t.includes("job details") || t === "notes") {
        write(
          r + 1,
          c,
          [`Delivery: ${formatDateDisplay(input.deliveryDateIso)}`, input.deliverTo, input.notes].filter(Boolean).join("\n")
        )
        touched++
      }
    }
  }

  // Detect first table row with qty/description/price-like headers.
  let headerRow = -1
  let qtyCol = -1
  let descCol = -1
  let priceCol = -1
  for (let r = range.s.r; r <= Math.min(range.e.r, 80); r++) {
    let q = -1, d = -1, p = -1
    for (let c = range.s.c; c <= Math.min(range.e.c, 40); c++) {
      const t = normalizeHeader(read(r, c))
      if (!t) continue
      if (q < 0 && (t === "qty" || t.includes("quantity"))) q = c
      if (d < 0 && (t.includes("description") || t.includes("product name") || t === "item")) d = c
      if (p < 0 && (t.includes("unit price") || t === "price" || t.includes("cost"))) p = c
    }
    if (q >= 0 && d >= 0 && p >= 0) {
      headerRow = r
      qtyCol = q
      descCol = d
      priceCol = p
      break
    }
  }
  if (headerRow < 0) return touched

  const maxRows = Math.min(input.lines.length, 25)
  for (let i = 0; i < maxRows; i++) {
    const row = headerRow + 1 + i
    const l = input.lines[i]!
    write(row, qtyCol, l.qty)
    write(row, descCol, `${l.productName} (${l.sku})`)
    write(row, priceCol, round2(l.unitPrice * (1 - l.discountPct / 100)))
    touched += 3
  }
  return touched
}

async function fillPdfTemplate(
  buffer: ArrayBuffer,
  originalFileName: string,
  input: OrderTemplateFillInput
): Promise<FilledTemplateResult> {
  const { PDFDocument, PDFTextField } = await import("pdf-lib")
  let pdfDoc: Awaited<ReturnType<typeof PDFDocument.load>>
  try {
    pdfDoc = await PDFDocument.load(buffer, { ignoreEncryption: true })
  } catch {
    return { ok: false, error: "Could not read this PDF. It may be encrypted or damaged." }
  }

  let form
  try {
    form = pdfDoc.getForm()
  } catch {
    return {
      ok: false,
      error:
        "This PDF has no fillable form. Add AcroForm text fields (e.g. order_ref, retailer_name, line_items) or use an Excel template with {{ORDER_REF}} style placeholders.",
    }
  }

  const lookup = buildPdfValueLookup(input)
  const fields = form.getFields()
  let filled = 0

  for (const field of fields) {
    if (!(field instanceof PDFTextField)) continue
    const name = field.getName()
    const norm = normalizePdfFieldName(name)
    const val = lookup.get(norm)
    if (val === undefined) continue
    try {
      field.setText(val)
      filled++
    } catch {
      try {
        field.setText(val.slice(0, 4000))
        filled++
      } catch {
        /* skip field */
      }
    }
  }

  if (filled === 0) {
    return {
      ok: false,
      error:
        `No matching fields found (this PDF has ${fields.length} form field(s)). Rename text fields to match e.g. order_ref, retailer_name, line_items — or use Excel with {{PLACEHOLDERS}}.`,
    }
  }

  try {
    form.flatten()
  } catch {
    /* some PDFs fail flatten; still save */
  }

  const data = await pdfDoc.save()
  const base = outputBaseName(originalFileName)
  return {
    ok: true,
    data,
    fileName: `${base}.pdf`,
    mimeType: "application/pdf",
  }
}

export function triggerBlobDownload(data: Uint8Array, fileName: string, mimeType: string) {
  const blob = new Blob([data as BlobPart], { type: mimeType })
  const url = URL.createObjectURL(blob)
  const a = document.createElement("a")
  a.href = url
  a.download = fileName
  a.click()
  URL.revokeObjectURL(url)
}
