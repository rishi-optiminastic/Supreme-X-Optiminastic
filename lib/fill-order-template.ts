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

  const base = outputBaseName(originalFileName)
  let warning: string | undefined
  if (replacedCells === 0) {
    warning =
      "No {{placeholders}} were found in the workbook — the file was saved unchanged. Add tokens like {{ORDER_REF}} or {{LINE_ITEMS}} to your template."
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
