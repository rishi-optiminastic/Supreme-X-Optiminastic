"use client"

import * as React from "react"
import {
  RiAddLine,
  RiClipboardLine,
  RiCloseLine,
  RiDeleteBinLine,
  RiDownloadLine,
  RiFileList3Line,
  RiFilterLine,
  RiMailLine,
  RiSendPlaneLine,
  RiStore2Line,
} from "@remixicon/react"
import { Dialog } from "radix-ui"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { deriveRspNumbers, type RspSharePayload } from "@/lib/rsp-share-types"
import { RETAILER_AREA_LABELS, type RetailerArea } from "@/lib/retailer-order-templates"
import { cn } from "@/lib/utils"

export type RspQuoteLine = { label: string; cogs: number }

// ─── Currency ─────────────────────────────────────────────────────────────────
function toAed(n: number) {
  return `AED ${Math.round(n).toLocaleString("en-AE")}`
}

// ─── Manual product row ────────────────────────────────────────────────────────
type ManualRow = {
  id: string
  productCode: string
  barcode: string
  description: string
  brand: string
  rsp: string
  dimensions: string
  qty: string
}

function emptyRow(): ManualRow {
  return {
    id: crypto.randomUUID(),
    productCode: "",
    barcode: "",
    description: "",
    brand: "",
    rsp: "",
    dimensions: "",
    qty: "1",
  }
}

// ─── Computed rows from RSP model ─────────────────────────────────────────────
type ComputedRow = {
  label: string
  cogs: number
  uaeRsp: number
  regionRsp: number
  SaudiRsp: number
  thinShelf: number
  healthyShelf: number
}

function buildComputedRows(payload: RspSharePayload, lines: RspQuoteLine[]): ComputedRow[] {
  return lines.map((line) => {
    const d = deriveRspNumbers({ ...payload, cogs: line.cogs })
    return {
      label: line.label,
      cogs: line.cogs,
      uaeRsp: d.uaeRsp,
      regionRsp: d.regionRsp,
      SaudiRsp: d.SaudiRsp,
      thinShelf: d.marginBandLowShelf,
      healthyShelf: d.marginBandHighShelf,
    }
  })
}

function toCsv(rows: ComputedRow[], manualRows: ManualRow[]): string {
  const computedHeader = [
    "Product",
    "COGS (AED)",
    "UAE RSP",
    "Region RSP",
    "Saudi RSP",
    "Thin shelf",
    "Healthy shelf",
  ]
  const computedBody = rows.map((r) =>
    [
      escapeCsv(r.label),
      String(Math.round(r.cogs)),
      String(Math.round(r.uaeRsp)),
      String(Math.round(r.regionRsp)),
      String(Math.round(r.SaudiRsp)),
      String(Math.round(r.thinShelf)),
      String(Math.round(r.healthyShelf)),
    ].join(",")
  )

  const manualHeader = [
    "Product Code",
    "Barcode",
    "Description",
    "Brand",
    "RSP (AED)",
    "Dimensions",
    "Qty",
  ]
  const manualBody = manualRows.map((r) =>
    [
      escapeCsv(r.productCode),
      escapeCsv(r.barcode),
      escapeCsv(r.description),
      escapeCsv(r.brand),
      escapeCsv(r.rsp),
      escapeCsv(r.dimensions),
      escapeCsv(r.qty),
    ].join(",")
  )

  const parts: string[] = []
  if (rows.length > 0) {
    parts.push([computedHeader.join(","), ...computedBody].join("\n"))
  }
  if (manualRows.length > 0) {
    if (parts.length) parts.push("")
    parts.push([manualHeader.join(","), ...manualBody].join("\n"))
  }
  return parts.join("\n")
}

function escapeCsv(s: string): string {
  if (/[",\n\r]/.test(s)) return `"${s.replace(/"/g, '""')}"`
  return s
}

function buildMailBody(rows: ComputedRow[], manualRows: ManualRow[], retailer: string, title: string): string {
  const header = `Quote sheet${title ? `: ${title}` : ""}${retailer ? ` — for ${retailer}` : ""}`

  const computedLines = rows
    .map(
      (r) =>
        `${r.label} | COGS ${toAed(r.cogs)} | UAE ${toAed(r.uaeRsp)} | Region ${toAed(r.regionRsp)} | Saudi ${toAed(r.SaudiRsp)}`
    )
    .join("\n")

  const manualLines = manualRows
    .map(
      (r) =>
        `${r.description}${r.productCode ? ` [${r.productCode}]` : ""}${r.barcode ? ` (${r.barcode})` : ""} | RSP: ${r.rsp} AED | Qty: ${r.qty}${r.dimensions ? ` | Dims: ${r.dimensions}` : ""}`
    )
    .join("\n")

  const parts = [header, ""]
  if (computedLines) parts.push("= RSP Model Products =", computedLines)
  if (manualLines) parts.push("= Manual Products =", manualLines)
  parts.push("", "(Attach the CSV export for full columns.)")
  return parts.join("\n")
}

// ─── Prop types ───────────────────────────────────────────────────────────────
type Retailer = { id: string; name: string; area?: RetailerArea }

type Props = {
  open: boolean
  onOpenChange: (open: boolean) => void
  payload: RspSharePayload
  lines: RspQuoteLine[]
  retailers?: Retailer[]
  className?: string
}

// ─── Main component ───────────────────────────────────────────────────────────
export function RspQuoteSheetDialog({
  open,
  onOpenChange,
  payload,
  lines,
  retailers = [],
  className,
}: Props) {
  // Computed rows (from RSP model)
  const computedRows = React.useMemo(() => buildComputedRows(payload, lines), [payload, lines])

  // Manual entry rows
  const [manualRows, setManualRows] = React.useState<ManualRow[]>([])

  // Retailer selector
  const [selectedRetailerId, setSelectedRetailerId] = React.useState<string>("")
  const [retailerEmailInput, setRetailerEmailInput] = React.useState("")

  // Brand/product filter
  const [brandFilter, setBrandFilter] = React.useState("")
  const [searchFilter, setSearchFilter] = React.useState("")

  // UI state
  const [activeTab, setActiveTab] = React.useState<"computed" | "manual">("computed")
  const [copied, setCopied] = React.useState(false)

  const selectedRetailer = retailers.find((r) => r.id === selectedRetailerId)?.name ?? ""

  // ── Filtered computed rows ──
  const filteredComputedRows = React.useMemo(() => {
    if (!searchFilter.trim()) return computedRows
    const q = searchFilter.toLowerCase()
    return computedRows.filter((r) => r.label.toLowerCase().includes(q))
  }, [computedRows, searchFilter])

  // ── Filtered manual rows ──
  const filteredManualRows = React.useMemo(() => {
    let rows = manualRows
    if (brandFilter.trim()) {
      const b = brandFilter.toLowerCase()
      rows = rows.filter((r) => r.brand.toLowerCase().includes(b))
    }
    if (searchFilter.trim()) {
      const q = searchFilter.toLowerCase()
      rows = rows.filter(
        (r) =>
          r.description.toLowerCase().includes(q) ||
          r.productCode.toLowerCase().includes(q) ||
          r.barcode.toLowerCase().includes(q)
      )
    }
    return rows
  }, [manualRows, brandFilter, searchFilter])

  // ── Unique brands for filter ──
  const allBrands = React.useMemo(() => {
    const brands = new Set(manualRows.map((r) => r.brand.trim()).filter(Boolean))
    return Array.from(brands).sort()
  }, [manualRows])

  const addManualRow = () => {
    setManualRows((prev) => [...prev, emptyRow()])
  }

  const updateManualRow = (id: string, field: keyof ManualRow, value: string) => {
    setManualRows((prev) => prev.map((r) => (r.id === id ? { ...r, [field]: value } : r)))
  }

  const removeManualRow = (id: string) => {
    setManualRows((prev) => prev.filter((r) => r.id !== id))
  }

  const csv = React.useMemo(
    () => toCsv(computedRows, manualRows),
    [computedRows, manualRows]
  )

  const downloadCsv = () => {
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8" })
    const url = URL.createObjectURL(blob)
    const a = document.createElement("a")
    a.href = url
    const safe = (payload.title || "rsp-quote").replace(/[^\w.-]+/g, "_").slice(0, 48)
    a.download = `${safe}-${new Date().toISOString().slice(0, 10)}.csv`
    a.click()
    URL.revokeObjectURL(url)
  }

  const copyCsv = async () => {
    try {
      await navigator.clipboard.writeText(csv)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      setCopied(false)
    }
  }

  const mailQuote = () => {
    const subj = `RSP quote${payload.title ? ` — ${payload.title}` : ""}${selectedRetailer ? ` · ${selectedRetailer}` : ""}`
    let body = buildMailBody(computedRows, manualRows, selectedRetailer, payload.title)
    const max = 1800
    if (body.length > max) {
      body = `${body.slice(0, max)}…\n\n[Body truncated — use Download CSV for full list.]`
    }
    const to = retailerEmailInput.trim()
    window.location.href = `mailto:${to}?subject=${encodeURIComponent(subj)}&body=${encodeURIComponent(body)}`
  }

  const totalProducts = computedRows.length + manualRows.length

  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-50 bg-black/50 backdrop-blur-[1px] data-[state=closed]:animate-out data-[state=open]:animate-in data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0" />
        <Dialog.Content
          className={cn(
            "fixed left-1/2 top-1/2 z-50 max-h-[min(92vh,calc(100dvh-2rem))] w-[calc(100%-1.5rem)] max-w-4xl -translate-x-1/2 -translate-y-1/2 overflow-hidden rounded-2xl border border-border/80 bg-card shadow-2xl duration-200 data-[state=closed]:animate-out data-[state=open]:animate-in data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95 flex flex-col",
            className
          )}
        >
          {/* ── Header ── */}
          <div className="flex shrink-0 items-start justify-between gap-3 border-b border-border/60 bg-gradient-to-r from-primary/10 to-transparent px-5 py-4">
            <div className="flex min-w-0 items-start gap-3">
              <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-primary/15 text-primary">
                <RiFileList3Line className="size-5" aria-hidden />
              </span>
              <div className="min-w-0">
                <Dialog.Title className="text-lg font-semibold tracking-tight">Quote sheet</Dialog.Title>
                <Dialog.Description className="mt-0.5 text-sm text-muted-foreground">
                  {totalProducts} product{totalProducts === 1 ? "" : "s"} · modify, filter, then send to retailer
                </Dialog.Description>
              </div>
            </div>
            <Dialog.Close asChild>
              <Button type="button" variant="ghost" size="icon" className="size-9 shrink-0 rounded-xl">
                <RiCloseLine className="size-5" aria-hidden />
              </Button>
            </Dialog.Close>
          </div>

          {/* ── Retailer + filter bar ── */}
          <div className="shrink-0 border-b border-border/50 bg-muted/20 px-5 py-3">
            <div className="flex flex-wrap items-end gap-3">
              {/* Retailer select */}
              <div className="min-w-[180px] flex-1">
                <label className="mb-1 block text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                  Send to retailer
                </label>
                <div className="flex items-center gap-2">
                  <RiStore2Line className="size-4 shrink-0 text-muted-foreground" aria-hidden />
                  {retailers.length > 0 ? (
                    <select
                      className="h-9 flex-1 rounded-lg border border-border/70 bg-background px-2.5 text-sm shadow-sm outline-none focus-visible:ring-2 focus-visible:ring-primary/25"
                      value={selectedRetailerId}
                      onChange={(e) => setSelectedRetailerId(e.target.value)}
                    >
                      <option value="">Select retailer…</option>
                      {retailers.map((r) => (
                        <option key={r.id} value={r.id}>
                          {r.name} · {RETAILER_AREA_LABELS[r.area ?? "uae"]}
                        </option>
                      ))}
                    </select>
                  ) : (
                    <Input
                      placeholder="Retailer name (optional)"
                      className="h-9 flex-1 text-sm"
                      value={retailerEmailInput}
                      onChange={(e) => setRetailerEmailInput(e.target.value)}
                    />
                  )}
                </div>
              </div>

              {/* Email input when retailer selected */}
              {(selectedRetailerId || !retailers.length) && (
                <div className="min-w-[200px] flex-1">
                  <label className="mb-1 block text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                    Retailer email
                  </label>
                  <Input
                    type="email"
                    placeholder="buyer@retailer.com"
                    className="h-9 text-sm"
                    value={retailerEmailInput}
                    onChange={(e) => setRetailerEmailInput(e.target.value)}
                  />
                </div>
              )}

              {/* Search + brand filter */}
              <div className="flex items-center gap-2">
                <div className="relative">
                  <RiFilterLine className="absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" aria-hidden />
                  <Input
                    placeholder="Search products…"
                    className="h-9 w-40 pl-7 text-sm"
                    value={searchFilter}
                    onChange={(e) => setSearchFilter(e.target.value)}
                  />
                </div>
                {allBrands.length > 0 && (
                  <select
                    className="h-9 rounded-lg border border-border/70 bg-background px-2.5 text-sm shadow-sm outline-none focus-visible:ring-2 focus-visible:ring-primary/25"
                    value={brandFilter}
                    onChange={(e) => setBrandFilter(e.target.value)}
                  >
                    <option value="">All brands</option>
                    {allBrands.map((b) => (
                      <option key={b} value={b}>
                        {b}
                      </option>
                    ))}
                  </select>
                )}
              </div>
            </div>
          </div>

          {/* ── Tabs ── */}
          <div className="flex shrink-0 border-b border-border/50 px-5">
            {(["computed", "manual"] as const).map((tab) => (
              <button
                key={tab}
                type="button"
                onClick={() => setActiveTab(tab)}
                className={cn(
                  "border-b-2 px-4 py-2.5 text-sm font-medium transition-colors",
                  activeTab === tab
                    ? "border-primary text-primary"
                    : "border-transparent text-muted-foreground hover:text-foreground"
                )}
              >
                {tab === "computed" ? (
                  <>RSP model <span className="ml-1 rounded-full bg-muted px-1.5 py-0.5 text-[10px] tabular-nums">{computedRows.length}</span></>
                ) : (
                  <>Manual entry <span className="ml-1 rounded-full bg-muted px-1.5 py-0.5 text-[10px] tabular-nums">{manualRows.length}</span></>
                )}
              </button>
            ))}
          </div>

          {/* ── Body ── */}
          <div className="min-h-0 flex-1 overflow-auto">
            {activeTab === "computed" ? (
              <table className="w-full min-w-[640px] border-collapse text-sm">
                <thead className="sticky top-0 z-10 border-b border-border/60 bg-card/95 backdrop-blur-sm">
                  <tr className="text-left text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                    <th className="px-5 py-3">Product</th>
                    <th className="px-3 py-3 text-right">COGS</th>
                    <th className="px-3 py-3 text-right">UAE RSP</th>
                    <th className="px-3 py-3 text-right">Region</th>
                    <th className="px-3 py-3 text-right">Saudi</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/50">
                  {filteredComputedRows.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="px-5 py-8 text-center text-sm text-muted-foreground">
                        No products match your search.
                      </td>
                    </tr>
                  ) : (
                    filteredComputedRows.map((r, i) => (
                      <tr key={`${r.label}-${i}`} className="hover:bg-muted/25">
                        <td className="max-w-[220px] truncate px-5 py-3 font-medium" title={r.label}>
                          {r.label || "—"}
                        </td>
                        <td className="px-3 py-3 text-right font-mono text-xs tabular-nums text-muted-foreground">
                          {toAed(r.cogs)}
                        </td>
                        <td className="px-3 py-3 text-right font-mono text-xs tabular-nums font-semibold text-sky-700 dark:text-sky-300">
                          {toAed(r.uaeRsp)}
                        </td>
                        <td className="px-3 py-3 text-right font-mono text-xs tabular-nums text-emerald-700 dark:text-emerald-300">
                          {toAed(r.regionRsp)}
                        </td>
                        <td className="px-3 py-3 text-right font-mono text-xs tabular-nums text-violet-700 dark:text-violet-300">
                          {toAed(r.SaudiRsp)}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            ) : (
              <div className="p-4">
                {/* Add row button */}
                <div className="mb-3 flex items-center justify-between">
                  <p className="text-xs text-muted-foreground">
                    Manually add products with code, barcode, description, RSP, dimensions and qty.
                  </p>
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    className="gap-1.5"
                    onClick={addManualRow}
                  >
                    <RiAddLine className="size-4" aria-hidden />
                    Add product
                  </Button>
                </div>

                {filteredManualRows.length === 0 && manualRows.length === 0 ? (
                  <div className="flex flex-col items-center justify-center gap-3 rounded-2xl border-2 border-dashed border-border/60 bg-muted/10 py-12 text-center">
                    <RiFileList3Line className="size-10 text-muted-foreground/30" aria-hidden />
                    <div>
                      <p className="text-sm font-medium text-foreground">No manual products yet</p>
                      <p className="mt-1 text-xs text-muted-foreground">Click "Add product" to enter product details manually</p>
                    </div>
                    <Button type="button" size="sm" onClick={addManualRow} className="gap-1.5">
                      <RiAddLine className="size-4" aria-hidden />
                      Add first product
                    </Button>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {filteredManualRows.map((row) => (
                      <div
                        key={row.id}
                        className="rounded-xl border border-border/60 bg-muted/10 p-4 transition-colors hover:bg-muted/20"
                      >
                        <div className="mb-3 flex items-center justify-between gap-2">
                          <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                            Product entry
                          </span>
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            className="size-7 shrink-0 text-muted-foreground hover:text-destructive"
                            onClick={() => removeManualRow(row.id)}
                            aria-label="Remove row"
                          >
                            <RiDeleteBinLine className="size-4" aria-hidden />
                          </Button>
                        </div>
                        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
                          <div className="space-y-1">
                            <label className="text-[11px] font-medium text-muted-foreground">Product Code</label>
                            <Input
                              placeholder="e.g. ATL-001"
                              className="h-8 text-sm"
                              value={row.productCode}
                              onChange={(e) => updateManualRow(row.id, "productCode", e.target.value)}
                            />
                          </div>
                          <div className="space-y-1">
                            <label className="text-[11px] font-medium text-muted-foreground">Barcode / EAN</label>
                            <Input
                              placeholder="e.g. 4002944250770"
                              className="h-8 text-sm"
                              value={row.barcode}
                              onChange={(e) => updateManualRow(row.id, "barcode", e.target.value)}
                            />
                          </div>
                          <div className="col-span-2 space-y-1 sm:col-span-1">
                            <label className="text-[11px] font-medium text-muted-foreground">Brand</label>
                            <Input
                              placeholder="e.g. Playmobil"
                              className="h-8 text-sm"
                              value={row.brand}
                              onChange={(e) => updateManualRow(row.id, "brand", e.target.value)}
                            />
                          </div>
                          <div className="col-span-2 space-y-1 lg:col-span-1">
                            <label className="text-[11px] font-medium text-muted-foreground">Description</label>
                            <Input
                              placeholder="Product description"
                              className="h-8 text-sm"
                              value={row.description}
                              onChange={(e) => updateManualRow(row.id, "description", e.target.value)}
                            />
                          </div>
                          <div className="space-y-1">
                            <label className="text-[11px] font-medium text-muted-foreground">RSP (AED)</label>
                            <Input
                              placeholder="e.g. 199"
                              className="h-8 text-sm font-mono"
                              value={row.rsp}
                              onChange={(e) => updateManualRow(row.id, "rsp", e.target.value)}
                            />
                          </div>
                          <div className="space-y-1">
                            <label className="text-[11px] font-medium text-muted-foreground">Dimensions</label>
                            <Input
                              placeholder="e.g. 30×20×10 cm"
                              className="h-8 text-sm"
                              value={row.dimensions}
                              onChange={(e) => updateManualRow(row.id, "dimensions", e.target.value)}
                            />
                          </div>
                          <div className="space-y-1">
                            <label className="text-[11px] font-medium text-muted-foreground">Qty</label>
                            <Input
                              type="number"
                              min="1"
                              placeholder="1"
                              className="h-8 w-24 text-sm font-mono"
                              value={row.qty}
                              onChange={(e) => updateManualRow(row.id, "qty", e.target.value)}
                            />
                          </div>
                        </div>
                      </div>
                    ))}
                    {filteredManualRows.length > 0 && (
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        className="w-full gap-1.5 border-dashed"
                        onClick={addManualRow}
                      >
                        <RiAddLine className="size-4" aria-hidden />
                        Add another product
                      </Button>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* ── Footer actions ── */}
          <div className="shrink-0 border-t border-border/60 bg-muted/20 px-5 py-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              {/* Left: export */}
              <div className="flex flex-wrap items-center gap-2">
                <Button type="button" variant="outline" size="sm" className="gap-1.5" onClick={() => void copyCsv()}>
                  <RiClipboardLine className="size-4" aria-hidden />
                  {copied ? "Copied!" : "Copy CSV"}
                </Button>
                <Button type="button" variant="outline" size="sm" className="gap-1.5" onClick={downloadCsv}>
                  <RiDownloadLine className="size-4" aria-hidden />
                  Download CSV
                </Button>
              </div>

              {/* Right: send */}
              <div className="flex flex-wrap items-center gap-2">
                <Button
                  type="button"
                  variant="secondary"
                  size="sm"
                  className="gap-1.5"
                  onClick={mailQuote}
                  disabled={totalProducts === 0}
                >
                  <RiMailLine className="size-4" aria-hidden />
                  Mail summary
                </Button>
                <Button
                  type="button"
                  size="sm"
                  className="gap-1.5 shadow-sm"
                  onClick={mailQuote}
                  disabled={totalProducts === 0}
                >
                  <RiSendPlaneLine className="size-4" aria-hidden />
                  Send quote{selectedRetailer ? ` to ${selectedRetailer}` : ""}
                </Button>
              </div>
            </div>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  )
}
