/** Escape text for HTML document output (print / save as PDF). */
function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
}

function formatDateDmy(isoDate: string): string {
  const [y, m, d] = isoDate.split("-")
  return d && m && y ? `${d}.${m}.${y}` : isoDate
}

export type PoPrintLine = {
  itemNo: number
  description: string
  sku: string
  qty: number
  unitPrice: number
  discountPct: number
  vatPct: number
  lineValue: number
}

export type PoPrintTotals = {
  qtyTotal: number
  gross: number
  discounted: number
  vat: number
  net: number
}

export type PoPrintMeta = {
  poNo: string
  poDateIso: string
  arrivalDateIso: string
  vendorNo: string
  category: string
  currency: string
  paymentTerms: string
  deliverTo: string
}

/**
 * Single-page HTML styled to mirror `public/PO-4518012178.pdf` layout.
 * Use with window.open + print → “Save as PDF” for a downloadable PO.
 */
export function buildSupremeImpexPoHtml(meta: PoPrintMeta, lines: PoPrintLine[], totals: PoPrintTotals): string {
  const poDate = formatDateDmy(meta.poDateIso)
  const arrival = formatDateDmy(meta.arrivalDateIso)

  const rows = lines
    .map(
      (l) => `
    <tr>
      <td class="c-item">${l.itemNo}</td>
      <td class="c-desc">${escapeHtml(l.description)}<br/><span class="muted">SKU: ${escapeHtml(l.sku)}</span></td>
      <td class="c-num">${l.qty.toFixed(3)} EA</td>
      <td class="c-num">${l.unitPrice.toFixed(2)}</td>
      <td class="c-num">${l.discountPct.toFixed(2)}</td>
      <td class="c-num">${l.vatPct.toFixed(2)}</td>
      <td class="c-num">${l.lineValue.toFixed(2)}</td>
    </tr>`
    )
    .join("")

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8"/>
  <title>Purchase Order ${escapeHtml(meta.poNo)}</title>
  <style>
    * { box-sizing: border-box; }
    body { font-family: Arial, Helvetica, sans-serif; font-size: 10px; color: #111; margin: 16px 20px; }
    .hdr { text-align: center; margin-bottom: 8px; }
    .hdr h1 { font-size: 13px; margin: 0 0 2px; letter-spacing: 0.02em; }
    .hdr .sub { font-size: 9px; line-height: 1.35; }
    .band { border: 1px solid #333; padding: 6px 8px; margin: 10px 0; font-size: 9px; }
    .band strong { display: block; margin-bottom: 4px; font-size: 9px; }
    .grid2 { display: table; width: 100%; }
    .grid2 > div { display: table-cell; width: 50%; vertical-align: top; padding-right: 8px; }
    .kv { margin: 2px 0; }
    table.lines { width: 100%; border-collapse: collapse; margin-top: 6px; font-size: 9px; }
    table.lines th { border-bottom: 1px solid #333; padding: 4px 3px; text-align: left; font-weight: bold; }
    table.lines th.c-num, table.lines td.c-num { text-align: right; }
    table.lines td { border-bottom: 1px solid #ccc; padding: 5px 3px; vertical-align: top; }
    .c-item { width: 6%; }
    .c-desc { width: 38%; }
    .muted { color: #444; font-size: 8px; }
    .totals { margin-top: 12px; border-top: 1px solid #333; padding-top: 8px; font-size: 9px; }
    .totals .row { display: flex; justify-content: flex-end; gap: 24px; margin: 3px 0; }
    .totals .row b { min-width: 120px; text-align: right; }
    .sig { margin-top: 28px; border-top: 1px solid #333; padding-top: 8px; font-size: 9px; }
    @media print { body { margin: 12mm; } }
  </style>
</head>
<body>
  <div class="hdr">
    <h1>SUPREME IMPEX GENERAL TRADING</h1>
    <div class="sub">Dubai<br/>Utd.Arab Emir.<br/>0097165459822 · 0097165459821<br/>supsales@supremedubai.ae<br/>VAT Reg Id :100378717100003</div>
  </div>

  <div class="band">
    <strong>PURCHASE ORDER REFERENCE DELIVERY &amp; PAYMENT TERMS</strong>
    <div class="grid2">
      <div>
        <div class="kv">Vendor Number :${escapeHtml(meta.vendorNo)}</div>
        <div class="kv">Purchase Order No :${escapeHtml(meta.poNo)}</div>
        <div class="kv">Purchase Order Date :${escapeHtml(poDate)}</div>
        <div class="kv">Category :${escapeHtml(meta.category)}</div>
        <div class="kv">Contact Person :</div>
        <div class="kv">Tel No :</div>
        <div class="kv">Email :</div>
        <div class="kv">Valid To :</div>
      </div>
      <div>
        <div class="kv">Deliver to :${escapeHtml(meta.deliverTo)}</div>
        <div class="kv">Destination Arrival :${escapeHtml(arrival)}</div>
        <div class="kv">Freight Terms :</div>
        <div class="kv">Order Acknowledge :</div>
        <div class="kv">Terms Of Payment :${escapeHtml(meta.paymentTerms)}</div>
        <div class="kv">Currency :${escapeHtml(meta.currency)}</div>
      </div>
    </div>
  </div>

  <table class="lines">
    <thead>
      <tr>
        <th class="c-item">Item</th>
        <th>Material/Description</th>
        <th class="c-num">Quantity</th>
        <th class="c-num">Unit Price</th>
        <th class="c-num">Discount %</th>
        <th class="c-num">VAT %</th>
        <th class="c-num">Value</th>
      </tr>
    </thead>
    <tbody>
      ${rows || `<tr><td colspan="7" style="text-align:center;padding:12px;">No lines</td></tr>`}
    </tbody>
  </table>

  <div class="totals">
    <div class="row"><span>Total Qty</span><b>${totals.qtyTotal} EA</b></div>
    <div class="row"><span>Total before Tax &amp; Discount</span><b>${totals.gross.toFixed(2)} ${escapeHtml(meta.currency)}</b></div>
    <div class="row"><span>Total Amount after Discount</span><b>${totals.discounted.toFixed(2)} ${escapeHtml(meta.currency)}</b></div>
    <div class="row"><span>VAT amount</span><b>${totals.vat.toFixed(2)} ${escapeHtml(meta.currency)}</b></div>
    <div class="row"><span>Net Amount</span><b>${totals.net.toFixed(2)} ${escapeHtml(meta.currency)}</b></div>
  </div>

  <div class="sig">Signature / Authorised person<br/><br/>__________________________</div>
</body>
</html>`
}

export type RetailerOrderPrintMeta = {
  orderRef: string
  orderDateIso: string
  deliveryDateIso: string
  retailerName: string
  retailerCode: string
  currency: string
  deliverTo: string
  paymentTerms: string
  notes: string
}

/**
 * Printable HTML for a retailer order creation form (filled on-platform).
 * Layout aligned with the PO-style grid for a consistent Supreme document.
 */
export function buildRetailerOrderFormHtml(
  meta: RetailerOrderPrintMeta,
  lines: PoPrintLine[],
  totals: PoPrintTotals
): string {
  const orderDate = formatDateDmy(meta.orderDateIso)
  const delivery = formatDateDmy(meta.deliveryDateIso)
  const notesBlock = meta.notes.trim()
    ? escapeHtml(meta.notes).replace(/\n/g, "<br/>")
    : "—"

  const rows = lines
    .map(
      (l) => `
    <tr>
      <td class="c-item">${l.itemNo}</td>
      <td class="c-desc">${escapeHtml(l.description)}<br/><span class="muted">SKU: ${escapeHtml(l.sku)}</span></td>
      <td class="c-num">${l.qty.toFixed(3)} EA</td>
      <td class="c-num">${l.unitPrice.toFixed(2)}</td>
      <td class="c-num">${l.discountPct.toFixed(2)}</td>
      <td class="c-num">${l.vatPct.toFixed(2)}</td>
      <td class="c-num">${l.lineValue.toFixed(2)}</td>
    </tr>`
    )
    .join("")

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8"/>
  <title>Order ${escapeHtml(meta.orderRef)} — ${escapeHtml(meta.retailerName)}</title>
  <style>
    * { box-sizing: border-box; }
    body { font-family: Arial, Helvetica, sans-serif; font-size: 10px; color: #111; margin: 16px 20px; }
    .hdr { text-align: center; margin-bottom: 8px; }
    .hdr h1 { font-size: 13px; margin: 0 0 2px; letter-spacing: 0.02em; }
    .hdr .sub { font-size: 9px; line-height: 1.35; }
    .tag { display: inline-block; margin-top: 4px; padding: 2px 8px; border: 1px solid #333; font-size: 9px; font-weight: bold; }
    .band { border: 1px solid #333; padding: 6px 8px; margin: 10px 0; font-size: 9px; }
    .band strong { display: block; margin-bottom: 4px; font-size: 9px; }
    .grid2 { display: table; width: 100%; }
    .grid2 > div { display: table-cell; width: 50%; vertical-align: top; padding-right: 8px; }
    .kv { margin: 2px 0; }
    table.lines { width: 100%; border-collapse: collapse; margin-top: 6px; font-size: 9px; }
    table.lines th { border-bottom: 1px solid #333; padding: 4px 3px; text-align: left; font-weight: bold; }
    table.lines th.c-num, table.lines td.c-num { text-align: right; }
    table.lines td { border-bottom: 1px solid #ccc; padding: 5px 3px; vertical-align: top; }
    .c-item { width: 6%; }
    .c-desc { width: 38%; }
    .muted { color: #444; font-size: 8px; }
    .totals { margin-top: 12px; border-top: 1px solid #333; padding-top: 8px; font-size: 9px; }
    .totals .row { display: flex; justify-content: flex-end; gap: 24px; margin: 3px 0; }
    .totals .row b { min-width: 120px; text-align: right; }
    .sig { margin-top: 28px; border-top: 1px solid #333; padding-top: 8px; font-size: 9px; }
    .notes { margin-top: 10px; font-size: 9px; border: 1px dashed #999; padding: 6px; }
    @media print { body { margin: 12mm; } }
  </style>
</head>
<body>
  <div class="hdr">
    <h1>SUPREME IMPEX GENERAL TRADING</h1>
    <div class="sub">Dubai<br/>Utd.Arab Emir.<br/>0097165459822 · 0097165459821<br/>supsales@supremedubai.ae<br/>VAT Reg Id :100378717100003</div>
    <div class="tag">RETAILER ORDER — ${escapeHtml(meta.retailerName)}</div>
  </div>

  <div class="band">
    <strong>ORDER DETAILS, DELIVERY &amp; PAYMENT</strong>
    <div class="grid2">
      <div>
        <div class="kv">Retailer / Customer :${escapeHtml(meta.retailerName)}</div>
        <div class="kv">Retailer ref / code :${escapeHtml(meta.retailerCode || "—")}</div>
        <div class="kv">Order reference :${escapeHtml(meta.orderRef)}</div>
        <div class="kv">Order date :${escapeHtml(orderDate)}</div>
        <div class="kv">Contact Person :</div>
        <div class="kv">Tel No :</div>
        <div class="kv">Email :</div>
      </div>
      <div>
        <div class="kv">Deliver to :${escapeHtml(meta.deliverTo)}</div>
        <div class="kv">Requested delivery :${escapeHtml(delivery)}</div>
        <div class="kv">Freight Terms :</div>
        <div class="kv">Order acknowledgement :</div>
        <div class="kv">Terms of payment :${escapeHtml(meta.paymentTerms)}</div>
        <div class="kv">Currency :${escapeHtml(meta.currency)}</div>
      </div>
    </div>
  </div>

  <table class="lines">
    <thead>
      <tr>
        <th class="c-item">Item</th>
        <th>Material / Description</th>
        <th class="c-num">Qty</th>
        <th class="c-num">Rate</th>
        <th class="c-num">Discount %</th>
        <th class="c-num">VAT %</th>
        <th class="c-num">Line value</th>
      </tr>
    </thead>
    <tbody>
      ${rows || `<tr><td colspan="7" style="text-align:center;padding:12px;">No lines</td></tr>`}
    </tbody>
  </table>

  <div class="totals">
    <div class="row"><span>Total Qty</span><b>${totals.qtyTotal} EA</b></div>
    <div class="row"><span>Total before tax &amp; discount</span><b>${totals.gross.toFixed(2)} ${escapeHtml(meta.currency)}</b></div>
    <div class="row"><span>Total after discount</span><b>${totals.discounted.toFixed(2)} ${escapeHtml(meta.currency)}</b></div>
    <div class="row"><span>VAT amount</span><b>${totals.vat.toFixed(2)} ${escapeHtml(meta.currency)}</b></div>
    <div class="row"><span>Net amount</span><b>${totals.net.toFixed(2)} ${escapeHtml(meta.currency)}</b></div>
  </div>

  <div class="notes"><strong>Notes</strong><br/>${notesBlock}</div>

  <div class="sig">Retailer authorised signatory<br/><br/>__________________________</div>
</body>
</html>`
}
