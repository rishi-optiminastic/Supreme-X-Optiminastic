"use client"

import * as React from "react"
import {
  RiCloseLine,
  RiDownloadLine,
  RiPrinterLine,
  RiFileList3Line,
  RiCheckboxCircleLine,
  RiErrorWarningLine,
} from "@remixicon/react"

import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import type { PoStockReportRow } from "@/lib/po-stock-match"

/* ─── types ─── */
export type PoInvoiceDialogProps = {
  open: boolean
  onClose: () => void
  fileName: string | null
  rows: PoStockReportRow[]
  source: "odoo" | "demo"
  analyzedAt: number | null
  /** Default keeps the existing stock-confirmation invoice; proforma uses PI reference and labeling. */
  documentKind?: "stock_confirmation" | "proforma"
}

/* ─── helpers ─── */
function pad2(n: number) {
  return String(n).padStart(2, "0")
}
function formatDate(ts: number | null) {
  if (!ts) return new Date().toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" })
  const d = new Date(ts)
  return `${pad2(d.getDate())} ${d.toLocaleString("en", { month: "short" })} ${d.getFullYear()}`
}
function documentRefNo(ts: number | null, kind: "stock_confirmation" | "proforma") {
  const d = new Date(ts ?? Date.now())
  const prefix = kind === "proforma" ? "PI" : "INV"
  return `${prefix}-${d.getFullYear()}${pad2(d.getMonth() + 1)}${pad2(d.getDate())}-${String(d.getHours()).padStart(2, "0")}${String(d.getMinutes()).padStart(2, "0")}`
}

/* ─── invoice HTML builder ─── */
function buildInvoiceHtml(
  rows: PoStockReportRow[],
  fileName: string | null,
  source: string,
  analyzedAt: number | null,
  documentKind: "stock_confirmation" | "proforma"
): string {
  const date = formatDate(analyzedAt)
  const invNo = documentRefNo(analyzedAt, documentKind)
  const isProforma = documentKind === "proforma"
  const docPageTitle = isProforma ? `Proforma Invoice — ${invNo}` : `PO Stock Confirmation — ${invNo}`
  const headerDocLabel = isProforma ? "Proforma Invoice" : "Stock Confirmation Invoice"
  const okCount = rows.filter((r) => r.lineOk).length
  const issueCount = rows.filter((r) => !r.lineOk).length
  const matchedCount = rows.filter((r) => r.resolvedSku).length
  const matchRate = rows.length > 0 ? Math.round((matchedCount / rows.length) * 100) : 0

  const rowsHtml = rows
    .map((r, i) => {
      const statusColor = r.lineOk ? "#16a34a" : "#dc2626"
      const statusText = r.lineOk ? "OK" : "Issue"
      const bgColor = i % 2 === 0 ? "#ffffff" : "#f8fafc"
      return `
        <tr style="background:${bgColor};">
          <td style="padding:8px 10px;color:#64748b;font-size:11px;text-align:center;">${r.rowIndex}</td>
          <td style="padding:8px 10px;font-family:monospace;font-size:11px;color:#0f172a;">${r.itemNumber || "—"}</td>
          <td style="padding:8px 10px;font-size:12px;color:#0f172a;max-width:200px;">
            <span style="font-weight:600;">${r.description}</span>
            ${r.catalogProductName && r.matchMethod !== "none" ? `<br><span style="color:#94a3b8;font-size:10px;">→ ${r.catalogProductName}</span>` : ""}
          </td>
          <td style="padding:8px 10px;text-align:right;font-weight:700;font-size:13px;color:#0f172a;">${r.qty}</td>
          <td style="padding:8px 10px;font-family:monospace;font-size:11px;color:#334155;">
            ${r.resolvedSku ? `<span style="background:#dbeafe;color:#1d4ed8;padding:2px 6px;border-radius:4px;">${r.resolvedSku}</span>` : `<span style="color:#dc2626;">Unmatched</span>`}
            ${r.matchMethod !== "none" ? `<br><span style="color:#94a3b8;font-size:9px;text-transform:uppercase;letter-spacing:.05em;">${r.matchMethod === "name_exact" ? "name" : r.matchMethod === "name_fuzzy" ? "fuzzy" : "sku"}</span>` : ""}
          </td>
          <td style="padding:8px 10px;text-align:right;color:#64748b;font-size:12px;">${r.skuAggregateQty}</td>
          <td style="padding:8px 10px;text-align:right;font-weight:600;font-size:12px;">${r.resolvedSku ? r.sellable : "—"}</td>
          <td style="padding:8px 10px;text-align:center;">
            <span style="display:inline-block;padding:3px 8px;border-radius:999px;font-size:10px;font-weight:700;background:${r.lineOk ? "#dcfce7" : "#fee2e2"};color:${statusColor};border:1px solid ${r.lineOk ? "#86efac" : "#fca5a5"};">
              ${statusText}
            </span>
          </td>
          <td style="padding:8px 10px;font-size:11px;color:#64748b;max-width:180px;">${r.note || "—"}</td>
        </tr>`
    })
    .join("")

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${docPageTitle}</title>
  <style>
    @import url('https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800&display=swap');
    *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
    html, body { font-family: 'Inter', -apple-system, BlinkMacSystemFont, sans-serif; background: #f1f5f9; color: #0f172a; }
    .page { max-width: 1100px; margin: 0 auto; background: #fff; min-height: 100vh; }

    /* ── Header ── */
    .header { background: linear-gradient(135deg, #0f172a 0%, #1e293b 60%, #0f172a 100%); color: #fff; padding: 36px 48px 32px; position: relative; overflow: hidden; }
    .header::before { content: ''; position: absolute; inset: 0; background: url("data:image/svg+xml,%3Csvg width='60' height='60' viewBox='0 0 60 60' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='none' fill-rule='evenodd'%3E%3Cg fill='%23ffffff' fill-opacity='0.03'%3E%3Cpath d='M36 34v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V0h-2v4h-4v2h4v4h2V6h4V4h-4zM6 34v-4H4v4H0v2h4v4h2v-4h4v-2H6zM6 4V0H4v4H0v2h4v4h2V6h4V4H6z'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E"); }
    .header-inner { position: relative; display: flex; justify-content: space-between; align-items: flex-start; gap: 24px; }
    .brand { display: flex; align-items: center; gap: 14px; }
    .brand-logo { width: 48px; height: 48px; background: linear-gradient(135deg, #3b82f6, #6366f1); border-radius: 12px; display: flex; align-items: center; justify-content: center; font-size: 22px; font-weight: 800; color: #fff; letter-spacing: -1px; box-shadow: 0 4px 16px rgba(99,102,241,.4); }
    .brand-name { font-size: 22px; font-weight: 800; letter-spacing: -0.5px; }
    .brand-sub { font-size: 12px; color: #94a3b8; margin-top: 1px; }
    .inv-meta { text-align: right; }
    .inv-title { font-size: 11px; font-weight: 600; text-transform: uppercase; letter-spacing: .12em; color: #94a3b8; }
    .inv-number { font-size: 26px; font-weight: 800; letter-spacing: -0.5px; margin-top: 4px; color: #fff; }
    .inv-date { font-size: 12px; color: #94a3b8; margin-top: 3px; }

    /* ── Divider strip ── */
    .accent-strip { height: 4px; background: linear-gradient(90deg, #3b82f6, #6366f1, #8b5cf6, #ec4899); }

    /* ── Info bar ── */
    .info-bar { background: #f8fafc; border-bottom: 1px solid #e2e8f0; padding: 20px 48px; display: flex; flex-wrap: wrap; gap: 32px; }
    .info-item label { font-size: 10px; font-weight: 600; text-transform: uppercase; letter-spacing: .1em; color: #94a3b8; display: block; }
    .info-item value { font-size: 13px; font-weight: 600; color: #0f172a; display: block; margin-top: 3px; font-family: monospace; }

    /* ── KPI strip ── */
    .kpi-strip { padding: 18px 48px; display: grid; grid-template-columns: repeat(4, 1fr); gap: 16px; background: #fff; border-bottom: 1px solid #e2e8f0; }
    .kpi-card { background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 12px; padding: 14px 16px; text-align: center; }
    .kpi-label { font-size: 10px; font-weight: 600; text-transform: uppercase; letter-spacing: .1em; color: #94a3b8; }
    .kpi-value { font-size: 28px; font-weight: 800; letter-spacing: -1px; margin-top: 4px; }
    .kpi-ok { color: #16a34a; }
    .kpi-issue { color: #dc2626; }
    .kpi-match { color: #2563eb; }
    .kpi-total { color: #0f172a; }

    /* ── Table heading ── */
    .section-heading { padding: 20px 48px 12px; display: flex; align-items: center; justify-content: space-between; }
    .section-title { font-size: 14px; font-weight: 700; color: #0f172a; }
    .section-sub { font-size: 11px; color: #94a3b8; margin-top: 2px; }
    .badge { display: inline-flex; align-items: center; padding: 4px 10px; border-radius: 999px; font-size: 11px; font-weight: 600; background: #dbeafe; color: #1d4ed8; border: 1px solid #bfdbfe; }

    /* ── Table ── */
    .table-wrap { padding: 0 48px 32px; overflow-x: auto; }
    table { width: 100%; border-collapse: collapse; font-size: 12px; }
    thead tr { background: #0f172a; color: #e2e8f0; }
    thead th { padding: 10px 10px; text-align: left; font-size: 10px; font-weight: 600; text-transform: uppercase; letter-spacing: .08em; white-space: nowrap; }
    thead th:first-child { border-radius: 8px 0 0 8px; }
    thead th:last-child { border-radius: 0 8px 8px 0; }
    tbody tr { border-bottom: 1px solid #f1f5f9; }
    tbody tr:last-child { border-bottom: none; }
    tbody td { vertical-align: top; }

    /* ── Footer ── */
    .footer { background: #f8fafc; border-top: 1px solid #e2e8f0; padding: 20px 48px; display: flex; justify-content: space-between; align-items: center; color: #94a3b8; font-size: 11px; }
    .footer-logo { font-weight: 700; color: #0f172a; font-size: 13px; }
    .footer-note { font-size: 10px; color: #cbd5e1; }

    /* ── Watermark for demo ── */
    .watermark { position: fixed; top: 50%; left: 50%; transform: translate(-50%,-50%) rotate(-35deg); font-size: 80px; font-weight: 900; color: rgba(0,0,0,.04); pointer-events: none; white-space: nowrap; letter-spacing: 4px; z-index: 0; }

    .proforma-notice { margin: 0 48px 16px; padding: 14px 18px; border-radius: 10px; border: 1px solid #c4b5fd; background: linear-gradient(135deg, #f5f3ff 0%, #ede9fe 100%); color: #5b21b6; font-size: 12px; font-weight: 500; line-height: 1.5; }

    @media print {
      html, body { background: #fff; }
      .page { box-shadow: none; }
      .no-print { display: none !important; }
      thead { display: table-header-group; }
      tr { page-break-inside: avoid; }
    }
  </style>
</head>
<body>
  ${source === "demo" ? '<div class="watermark">SAMPLE DATA</div>' : ""}
  <div class="page">
    <div class="header">
      <div class="header-inner">
        <div class="brand">
          <div class="brand-logo">S</div>
          <div>
            <div class="brand-name">Supreme</div>
            <div class="brand-sub">Inventory Intelligence Platform</div>
          </div>
        </div>
        <div class="inv-meta">
          <div class="inv-title">${headerDocLabel}</div>
          <div class="inv-number">${invNo}</div>
          <div class="inv-date">Generated ${date}</div>
        </div>
      </div>
    </div>
    <div class="accent-strip"></div>
    ${isProforma ? `<div class="proforma-notice">This is a <strong>proforma invoice</strong> for quotation and pre-shipment reference only. It is not a tax invoice and does not constitute a demand for payment unless agreed in writing.</div>` : ""}

    <div class="info-bar">
      <div class="info-item">
        <label>Source File</label>
        <value>${fileName ?? "Manual check"}</value>
      </div>
      <div class="info-item">
        <label>Catalog</label>
        <value>${source === "odoo" ? "Live · Odoo" : "Sample / Demo"}</value>
      </div>
      <div class="info-item">
        <label>Analysis Date</label>
        <value>${date}</value>
      </div>
      <div class="info-item">
        <label>${isProforma ? "Proforma ref." : "Invoice No."}</label>
        <value>${invNo}</value>
      </div>
    </div>

    <div class="kpi-strip">
      <div class="kpi-card">
        <div class="kpi-label">Total Lines</div>
        <div class="kpi-value kpi-total">${rows.length}</div>
      </div>
      <div class="kpi-card">
        <div class="kpi-label">Match Rate</div>
        <div class="kpi-value kpi-match">${matchRate}%</div>
      </div>
      <div class="kpi-card">
        <div class="kpi-label">Lines OK</div>
        <div class="kpi-value kpi-ok">${okCount}</div>
      </div>
      <div class="kpi-card">
        <div class="kpi-label">Need Attention</div>
        <div class="kpi-value kpi-issue">${issueCount}</div>
      </div>
    </div>

    <div class="section-heading">
      <div>
        <div class="section-title">Line-by-Line Breakdown</div>
        <div class="section-sub">Each PO line matched against the current catalog sellable stock</div>
      </div>
      <span class="badge">${rows.length} lines</span>
    </div>

    <div class="table-wrap">
      <table>
        <thead>
          <tr>
            <th style="text-align:center;">#</th>
            <th>Item No.</th>
            <th>Description</th>
            <th style="text-align:right;">Qty</th>
            <th>Matched SKU</th>
            <th style="text-align:right;">SKU Σ</th>
            <th style="text-align:right;">Sellable</th>
            <th style="text-align:center;">Status</th>
            <th>Note</th>
          </tr>
        </thead>
        <tbody>
          ${rowsHtml}
        </tbody>
      </table>
    </div>

    <div class="footer">
      <div>
        <div class="footer-logo">Supreme AI</div>
        <div class="footer-note">Inventory Intelligence Platform · Confidential</div>
      </div>
      <div style="text-align:right;">
        <div>${invNo}</div>
        <div class="footer-note">Generated ${date} · ${rows.length} line${rows.length === 1 ? "" : "s"}</div>
      </div>
    </div>
  </div>
</body>
</html>`
}

/* ─── component ─── */
export function PoInvoiceDialog({
  open,
  onClose,
  fileName,
  rows,
  source,
  analyzedAt,
  documentKind = "stock_confirmation",
}: PoInvoiceDialogProps) {
  const previewRef = React.useRef<HTMLIFrameElement>(null)
  const [ready, setReady] = React.useState(false)

  const html = React.useMemo(
    () => buildInvoiceHtml(rows, fileName, source, analyzedAt, documentKind),
    [rows, fileName, source, analyzedAt, documentKind]
  )

  // Write HTML into iframe whenever it opens/changes
  React.useEffect(() => {
    if (!open) {
      setReady(false)
      return
    }
    const iframe = previewRef.current
    if (!iframe) return
    const doc = iframe.contentDocument ?? iframe.contentWindow?.document
    if (!doc) return
    doc.open()
    doc.write(html)
    doc.close()
    setReady(true)
  }, [open, html])

  const handlePrint = () => {
    const iframe = previewRef.current
    iframe?.contentWindow?.print()
  }

  const handleDownload = () => {
    const blob = new Blob([html], { type: "text/html;charset=utf-8" })
    const url = URL.createObjectURL(blob)
    const a = document.createElement("a")
    a.href = url
    const base = fileName?.replace(/\.[^.]+$/, "") ?? "po"
    const slug = documentKind === "proforma" ? "proforma" : "invoice"
    a.download = `${base}-${slug}-${documentRefNo(analyzedAt, documentKind)}.html`
    a.click()
    URL.revokeObjectURL(url)
  }

  if (!open) return null

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm"
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div className="flex h-[92vh] w-full max-w-6xl flex-col overflow-hidden rounded-2xl border border-border/60 bg-card shadow-2xl ring-1 ring-white/5">
        {/* Dialog header */}
        <div className="flex shrink-0 items-center justify-between border-b border-border/50 bg-muted/30 px-5 py-3.5">
          <div className="flex items-center gap-3">
            <span className="flex size-8 items-center justify-center rounded-lg bg-primary/15 text-primary">
              <RiFileList3Line className="size-4" aria-hidden />
            </span>
            <div>
              <h2 className="text-sm font-semibold">
                {documentKind === "proforma" ? "PO Proforma Preview" : "PO Invoice Preview"}
              </h2>
              <p className="text-[11px] text-muted-foreground">
                {rows.length} lines · {fileName ?? "manual"} · {source === "odoo" ? "Live Odoo" : "Sample"}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {/* Quick stats */}
            <div className="hidden items-center gap-3 border-r border-border/60 pr-3 sm:flex">
              <span className="flex items-center gap-1 text-xs font-medium text-emerald-700 dark:text-emerald-400">
                <RiCheckboxCircleLine className="size-3.5" />
                {rows.filter((r) => r.lineOk).length} OK
              </span>
              <span className="flex items-center gap-1 text-xs font-medium text-rose-700 dark:text-rose-400">
                <RiErrorWarningLine className="size-3.5" />
                {rows.filter((r) => !r.lineOk).length} issues
              </span>
            </div>
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="h-8 gap-1.5"
              onClick={handlePrint}
              disabled={!ready}
            >
              <RiPrinterLine className="size-3.5" aria-hidden />
              Print / PDF
            </Button>
            <Button
              type="button"
              size="sm"
              className="h-8 gap-1.5 bg-primary text-primary-foreground"
              onClick={handleDownload}
              disabled={!ready}
            >
              <RiDownloadLine className="size-3.5" aria-hidden />
              Download
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="icon-sm"
              className="size-8 text-muted-foreground"
              onClick={onClose}
              aria-label="Close invoice"
            >
              <RiCloseLine className="size-4" />
            </Button>
          </div>
        </div>

        {/* Loading shimmer */}
        {!ready && (
          <div className="flex flex-1 items-center justify-center gap-3 text-sm text-muted-foreground">
            <div className="size-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
            Generating invoice…
          </div>
        )}

        {/* iframe preview */}
        <iframe
          ref={previewRef}
          title="Invoice preview"
          className={cn("flex-1 bg-white", !ready && "hidden")}
          sandbox="allow-same-origin allow-modals"
          onLoad={() => setReady(true)}
        />

        {/* Footer hint */}
        <div className="shrink-0 border-t border-border/40 bg-muted/20 px-5 py-2 text-[11px] text-muted-foreground">
          Use <span className="font-medium text-foreground">Print / PDF</span> to save as PDF (select "Save as PDF" in the print dialog), or{" "}
          <span className="font-medium text-foreground">Download</span> to get the HTML file.
        </div>
      </div>
    </div>
  )
}
