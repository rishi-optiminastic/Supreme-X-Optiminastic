"use client"

import * as React from "react"
import Link from "next/link"
import {
  RiAddLine,
  RiArrowDownSLine,
  RiArrowRightLine,
  RiCheckboxCircleLine,
  RiCloseLine,
  RiDownloadLine,
  RiErrorWarningLine,
  RiFileList3Line,
  RiAlarmWarningLine,
  RiLoader4Line,
  RiPulseLine,
  RiRefreshLine,
  RiUploadCloud2Line,
} from "@remixicon/react"

import { Panel } from "@/components/panel"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { useVariantsWithOdoo } from "@/hooks/use-variants-with-odoo"
import {
  deadStockValueHint,
  stockHealthRow,
  type StockHealthRow,
  type StockSegment,
} from "@/lib/intelligence"
import { parsePurchaseOrderXlsx, type ParsedPoLine } from "@/lib/parse-purchase-order-xlsx"
import {
  buildPoStockReport,
  formatPoStockReportText,
  poReportToSalesOrderLines,
  type PoStockReportRow,
} from "@/lib/po-stock-match"
import {
  evaluateStockForLines,
  formatStockConfirmationReport,
  type SalesOrderLine,
} from "@/lib/stock-confirmation"
import { cn } from "@/lib/utils"

/* ─── Segment display config ─── */

const LABELS: Record<StockSegment, string> = {
  fast: "Selling well",
  slow: "Slow seller",
  overstock: "Lots in stock",
  dead: "Hard to move",
  stockout_risk: "Running low",
  ok: "Okay",
}

const BADGE_CLASS: Record<StockSegment, string> = {
  fast: "bg-emerald-500/15 text-emerald-800 dark:text-emerald-300",
  slow: "bg-slate-500/15 text-slate-800 dark:text-slate-300",
  overstock: "bg-amber-500/15 text-amber-900 dark:text-amber-200",
  dead: "bg-rose-500/15 text-rose-800 dark:text-rose-300",
  stockout_risk: "bg-red-500/20 text-red-900 dark:text-red-200",
  ok: "bg-muted text-muted-foreground",
}

/** Sort order for “needs attention” queue (lower = show first). */
const SEGMENT_ATTENTION_RANK: Record<StockSegment, number> = {
  stockout_risk: 0,
  dead: 1,
  slow: 2,
  overstock: 3,
  fast: 10,
  ok: 10,
}

/* ─── Types ─── */

type HealthFilter = "all" | "attention" | "stockout" | "slow_dead" | "overstock" | "healthy"
type SortMode = "days_asc" | "days_desc" | "on_hand_desc" | "trend_desc"
type StockCheckMode = "manual" | "upload"

type EnrichedRow = StockHealthRow & {
  weeksCover: number
  trendScore: number
  salesQty90d?: number
  inbound: number
}

function matchesFilter(seg: StockSegment, f: HealthFilter): boolean {
  if (f === "all") return true
  if (f === "attention")
    return seg === "stockout_risk" || seg === "dead" || seg === "slow" || seg === "overstock"
  if (f === "stockout") return seg === "stockout_risk"
  if (f === "slow_dead") return seg === "dead" || seg === "slow"
  if (f === "overstock") return seg === "overstock"
  if (f === "healthy") return seg === "ok" || seg === "fast"
  return true
}

function rowTone(seg: StockSegment) {
  if (seg === "stockout_risk") return "bg-red-500/6"
  if (seg === "dead") return "bg-rose-500/6"
  if (seg === "slow") return "bg-slate-500/5"
  if (seg === "overstock") return "bg-amber-500/6"
  return undefined
}

function escapeCsvCell(s: string): string {
  if (/[",\n\r]/.test(s)) return `"${s.replace(/"/g, '""')}"`
  return s
}

function buildPoReportCsv(rows: PoStockReportRow[]): string {
  const h = [
    "Row",
    "Item #",
    "Description",
    "Qty",
    "Matched SKU",
    "Match type",
    "SKU total",
    "Sellable",
    "On hand",
    "Reserved",
    "Status",
    "Note",
  ]
  const body = rows.map((r) =>
    [
      r.rowIndex,
      escapeCsvCell(r.itemNumber || ""),
      escapeCsvCell(r.description),
      r.qty,
      escapeCsvCell(r.resolvedSku || ""),
      r.matchMethod,
      r.skuAggregateQty,
      r.resolvedSku ? r.sellable : "",
      r.resolvedSku ? r.onHand : "",
      r.resolvedSku ? r.reserved : "",
      r.lineOk ? "OK" : "Issue",
      escapeCsvCell(r.note),
    ].join(",")
  )
  return [h.join(","), ...body].join("\n")
}

export function StockHealthWorkspace() {
  const { variants, source, odooLoading, odooError, refetchOdoo } = useVariantsWithOdoo()
  const [unitCost, setUnitCost] = React.useState(500)
  const [filter, setFilter] = React.useState<HealthFilter>("all")
  const [query, setQuery] = React.useState("")
  const [sort, setSort] = React.useState<SortMode>("days_asc")
  const [copiedCsv, setCopiedCsv] = React.useState(false)

  const [confirmSku, setConfirmSku] = React.useState("")
  const [confirmQty, setConfirmQty] = React.useState(1)
  const [confirmLines, setConfirmLines] = React.useState<SalesOrderLine[]>([])
  const [copiedReport, setCopiedReport] = React.useState(false)

  const [stockCheckMode, setStockCheckMode] = React.useState<StockCheckMode>("upload")
  const poInputRef = React.useRef<HTMLInputElement>(null)
  const [poFileName, setPoFileName] = React.useState<string | null>(null)
  const [poBusy, setPoBusy] = React.useState(false)
  const [poError, setPoError] = React.useState<string | null>(null)
  const [poParsedLines, setPoParsedLines] = React.useState<ParsedPoLine[] | null>(null)
  const [poDrag, setPoDrag] = React.useState(false)
  const [copiedPoReport, setCopiedPoReport] = React.useState(false)
  const [copiedPoCsv, setCopiedPoCsv] = React.useState(false)
  const [poRowFilter, setPoRowFilter] = React.useState<"all" | "issues" | "unmatched">("all")
  const [poReportCollapsed, setPoReportCollapsed] = React.useState(false)
  const [poAnalyzedAt, setPoAnalyzedAt] = React.useState<number | null>(null)

  React.useEffect(() => {
    if (!confirmSku && variants.length) setConfirmSku(variants[0].sku)
  }, [confirmSku, variants])

  const stockConfirmResults = React.useMemo(
    () => (confirmLines.length ? evaluateStockForLines(variants, confirmLines) : null),
    [variants, confirmLines]
  )

  const stockConfirmReport = React.useMemo(() => {
    if (!stockConfirmResults?.length) return ""
    return formatStockConfirmationReport({
      title: "Stock Confirmation Report",
      sourceLabel: source === "odoo" ? "Odoo Live" : "Demo Data",
      lines: confirmLines,
      results: stockConfirmResults,
    })
  }, [confirmLines, stockConfirmResults, source])

  const poReportRows = React.useMemo(() => {
    if (!poParsedLines?.length) return null
    return buildPoStockReport(variants, poParsedLines)
  }, [variants, poParsedLines])

  const poMatchedCount = poReportRows?.filter((r) => r.resolvedSku).length ?? 0
  const poAllOk = poReportRows && poReportRows.length > 0 ? poReportRows.every((r) => r.lineOk) : null
  const poIssueLineCount = poReportRows?.filter((r) => !r.lineOk).length ?? 0
  const poUnmatchedLineCount = poReportRows?.filter((r) => !r.resolvedSku).length ?? 0
  const poOkLineCount = poReportRows?.filter((r) => r.lineOk).length ?? 0
  const poMatchRatePct =
    poReportRows && poReportRows.length > 0 ? Math.round((poMatchedCount / poReportRows.length) * 100) : 0

  const filteredPoReportRows = React.useMemo(() => {
    if (!poReportRows?.length) return []
    if (poRowFilter === "issues") return poReportRows.filter((r) => !r.lineOk)
    if (poRowFilter === "unmatched") return poReportRows.filter((r) => !r.resolvedSku)
    return poReportRows
  }, [poReportRows, poRowFilter])

  const poReportCsv = React.useMemo(
    () => (poReportRows?.length ? buildPoReportCsv(poReportRows) : ""),
    [poReportRows]
  )
  const poReportText = React.useMemo(() => {
    if (!poReportRows?.length || !poFileName) return ""
    return formatPoStockReportText({
      fileName: poFileName,
      sourceLabel: source === "odoo" ? "Odoo Live" : "Demo / sample catalog",
      rows: poReportRows,
    })
  }, [poReportRows, poFileName, source])

  const addConfirmLine = () => {
    const qty = Math.max(1, Math.floor(confirmQty) || 1)
    if (!confirmSku.trim()) return
    setConfirmLines((prev) => {
      const i = prev.findIndex((l) => l.sku === confirmSku)
      if (i >= 0) {
        const next = [...prev]
        next[i] = { sku: confirmSku, qty: next[i]!.qty + qty }
        return next
      }
      return [...prev, { sku: confirmSku, qty }]
    })
  }

  const removeConfirmLine = (sku: string) =>
    setConfirmLines((prev) => prev.filter((l) => l.sku !== sku))

  const addConfirmLineForSku = (sku: string) => {
    const qty = Math.max(1, Math.floor(confirmQty) || 1)
    if (!sku.trim()) return
    setConfirmSku(sku)
    setConfirmLines((prev) => {
      const i = prev.findIndex((l) => l.sku === sku)
      if (i >= 0) {
        const next = [...prev]
        next[i] = { sku, qty: next[i]!.qty + qty }
        return next
      }
      return [...prev, { sku, qty }]
    })
  }

  const confirmAllOk =
    stockConfirmResults && stockConfirmResults.length > 0
      ? stockConfirmResults.every((r) => r.ok)
      : null

  const confirmSkuSet = React.useMemo(
    () => new Set(confirmLines.map((l) => l.sku)),
    [confirmLines]
  )

  const selectedVariantForConfirm = React.useMemo(
    () => variants.find((v) => v.sku === confirmSku),
    [variants, confirmSku]
  )
  const sellablePreview =
    selectedVariantForConfirm != null
      ? Math.max(0, selectedVariantForConfirm.onHand - selectedVariantForConfirm.reserved)
      : null

  const copyStockReport = async () => {
    if (!stockConfirmReport) return
    try {
      await navigator.clipboard.writeText(stockConfirmReport)
      setCopiedReport(true)
      setTimeout(() => setCopiedReport(false), 2000)
    } catch {
      setCopiedReport(false)
    }
  }

  const ingestPoFile = React.useCallback(async (file: File | null) => {
    if (!file) return
    const lower = file.name.toLowerCase()
    if (!lower.endsWith(".xlsx") && !lower.endsWith(".xls")) {
      setPoError("Please upload an Excel file (.xlsx or .xls).")
      setPoParsedLines(null)
      setPoFileName(null)
      return
    }
    setPoBusy(true)
    setPoError(null)
    try {
      const buf = await file.arrayBuffer()
      const res = await parsePurchaseOrderXlsx(buf)
      if (!res.ok) {
        setPoParsedLines(null)
        setPoFileName(null)
        setPoError(res.error)
        return
      }
      setPoParsedLines(res.lines)
      setPoFileName(file.name)
      setPoAnalyzedAt(Date.now())
      setPoRowFilter("all")
      setPoReportCollapsed(false)
    } catch (e) {
      setPoParsedLines(null)
      setPoFileName(null)
      setPoError(e instanceof Error ? e.message : "Could not read the file.")
    } finally {
      setPoBusy(false)
    }
  }, [])

  const clearPoUpload = () => {
    setPoParsedLines(null)
    setPoFileName(null)
    setPoError(null)
    setPoAnalyzedAt(null)
    setPoRowFilter("all")
    if (poInputRef.current) poInputRef.current.value = ""
  }

  const copyPoReport = async () => {
    if (!poReportText) return
    try {
      await navigator.clipboard.writeText(poReportText)
      setCopiedPoReport(true)
      setTimeout(() => setCopiedPoReport(false), 2000)
    } catch {
      setCopiedPoReport(false)
    }
  }

  const downloadPoCsv = () => {
    if (!poReportCsv || !poFileName) return
    const base = poFileName.replace(/\.[^.]+$/, "") || "po-stock-report"
    const blob = new Blob([poReportCsv], { type: "text/csv;charset=utf-8" })
    const url = URL.createObjectURL(blob)
    const a = document.createElement("a")
    a.href = url
    a.download = `${base}-stock-confirmation.csv`
    a.click()
    URL.revokeObjectURL(url)
  }

  const copyPoCsv = async () => {
    if (!poReportCsv) return
    try {
      await navigator.clipboard.writeText(poReportCsv)
      setCopiedPoCsv(true)
      setTimeout(() => setCopiedPoCsv(false), 2000)
    } catch {
      setCopiedPoCsv(false)
    }
  }

  const mergePoIntoManualCheck = () => {
    if (!poReportRows?.length) return
    const next = poReportToSalesOrderLines(poReportRows)
    if (!next.length) return
    setConfirmLines(next)
    setStockCheckMode("manual")
  }

  const queueSkuForStockCheck = (sku: string) => {
    setStockCheckMode("manual")
    addConfirmLineForSku(sku)
  }

  const enriched = React.useMemo((): EnrichedRow[] =>
    variants.map((v) => ({
      ...stockHealthRow(v),
      weeksCover: v.weeksCover,
      trendScore: v.trendScore,
      salesQty90d: v.salesQty90d,
      inbound: v.inbound,
    })),
  [variants])

  const kpis = React.useMemo(() => {
    let stockout = 0,
      attention = 0,
      healthy = 0,
      overstock = 0
    for (const r of enriched) {
      if (r.segment === "stockout_risk") stockout++
      if (matchesFilter(r.segment, "attention")) attention++
      if (r.segment === "ok" || r.segment === "fast") healthy++
      if (r.segment === "overstock") overstock++
    }
    return { stockout, attention, healthy, overstock }
  }, [enriched])

  const focusAttentionSkus = React.useMemo(() => {
    return [...enriched]
      .filter((r) => matchesFilter(r.segment, "attention"))
      .sort((a, b) => {
        const ra = SEGMENT_ATTENTION_RANK[a.segment]
        const rb = SEGMENT_ATTENTION_RANK[b.segment]
        if (ra !== rb) return ra - rb
        return (a.daysToStockout ?? 9999) - (b.daysToStockout ?? 9999)
      })
      .slice(0, 5)
  }, [enriched])

  const rows = React.useMemo(() => {
    const q = query.trim().toLowerCase()
    let list = enriched.filter((r) => {
      if (!matchesFilter(r.segment, filter)) return false
      if (!q) return true
      return r.sku.toLowerCase().includes(q) || r.productName.toLowerCase().includes(q)
    })
    list = [...list].sort((a, b) => {
      const d = (r: EnrichedRow) => r.daysToStockout ?? 9999
      if (sort === "days_asc") return d(a) - d(b)
      if (sort === "days_desc") return d(b) - d(a)
      if (sort === "on_hand_desc") return b.onHand - a.onHand
      return b.trendScore - a.trendScore
    })
    return list
  }, [enriched, filter, query, sort])

  const csv = React.useMemo(() => {
    const h =
      "sku,product,segment,cover_wk,trend,days_left,units_wk,on_hand,inbound,sales_90d,note\n"
    return (
      h +
      rows
        .map((r) =>
          [
            r.sku,
            `"${r.productName}"`,
            r.segment,
            r.weeksCover,
            r.trendScore,
            r.daysToStockout ?? "",
            r.weeklyDemand,
            r.onHand,
            r.inbound,
            r.salesQty90d ?? "",
            `"${r.note}"`,
          ].join(",")
        )
        .join("\n")
    )
  }, [rows])

  const copyCsv = async () => {
    try {
      await navigator.clipboard.writeText(csv)
      setCopiedCsv(true)
      setTimeout(() => setCopiedCsv(false), 2000)
    } catch {
      setCopiedCsv(false)
    }
  }

  const dataIsSample = source === "demo"
  const odooUnavailable = dataIsSample && Boolean(odooError)

  return (
    <div className="space-y-4 pb-10">
      <div className="grid items-start gap-4 lg:grid-cols-12">
        <div className="lg:col-span-8">
          <h1 className="text-xl font-semibold tracking-tight sm:text-2xl md:text-3xl">Inventory</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Portfolio health by SKU, PO upload vs sellable stock, filters and CSV export—use the sidebar to jump between tools anytime.
          </p>
        </div>
      </div>

      {/* Row: focus & shortcuts | snapshot | stock check */}
      <div className="grid items-stretch gap-4 lg:grid-cols-12">
        <Panel className="flex flex-col overflow-hidden border-border/60 bg-card/95 p-0 shadow-md ring-1 ring-black/5 dark:ring-white/5 lg:col-span-4 lg:min-h-[380px]">
          <div className="shrink-0 border-b border-border/50 bg-linear-to-r from-amber-500/8 to-transparent px-3 py-2.5 dark:from-amber-500/12">
            <div className="flex items-center gap-2">
              <span className="inline-flex size-8 items-center justify-center rounded-lg bg-amber-500/15 text-amber-800 dark:text-amber-200">
                <RiAlarmWarningLine className="size-4" aria-hidden />
              </span>
              <div>
                <h2 className="text-sm font-semibold tracking-tight">Focus &amp; shortcuts</h2>
                <p className="text-[11px] text-muted-foreground">Queue at-risk SKUs · jump to tools</p>
              </div>
            </div>
          </div>
          <div className="flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto p-3">
            <div className="flex flex-wrap items-center gap-2">
              <span
                className={cn(
                  "inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-medium",
                  source === "odoo"
                    ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-800 dark:text-emerald-200"
                    : "border-border/60 bg-muted/50 text-muted-foreground"
                )}
              >
                {source === "odoo" ? "Live · Odoo" : "Sample"}
              </span>
              <span className="text-xs tabular-nums text-muted-foreground">
                {odooLoading ? "Syncing…" : `${variants.length} SKUs`}
              </span>
              <Button
                type="button"
                variant="outline"
                size="icon-sm"
                className="size-8 shrink-0 border-border/70"
                title="Refresh catalog"
                disabled={odooLoading}
                onClick={() => refetchOdoo()}
              >
                <RiRefreshLine className={cn("size-4", odooLoading && "animate-spin")} aria-hidden />
              </Button>
              <Button type="button" variant="secondary" size="sm" className="h-8 text-xs" onClick={() => void copyCsv()}>
                {copiedCsv ? "Copied" : "Table CSV"}
              </Button>
            </div>
            {odooUnavailable ? (
              <p className="rounded-lg border border-amber-500/25 bg-amber-500/6 px-2.5 py-2 text-[11px] leading-snug text-amber-950 dark:text-amber-100/95">
                <span className="font-medium">Demo catalog</span> — Odoo did not load
                {odooError ? (
                  <>
                    {" "}
                    (<span className="font-mono text-[10px] opacity-90">{odooError}</span>)
                  </>
                ) : null}
                . Connect Odoo for live stock.
              </p>
            ) : null}

            <div className="min-h-0 flex-1">
              <p className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                Needs attention ({kpis.attention})
              </p>
              {focusAttentionSkus.length === 0 ? (
                <div className="rounded-xl border border-dashed border-border/70 bg-muted/15 px-3 py-6 text-center">
                  <p className="text-sm font-medium text-foreground">All clear</p>
                  <p className="mt-1 text-xs text-muted-foreground">No low, slow, dead, or heavy SKUs right now.</p>
                </div>
              ) : (
                <ul className="space-y-2">
                  {focusAttentionSkus.map((r) => (
                    <li
                      key={r.sku}
                      className="flex items-start gap-2 rounded-xl border border-border/60 bg-muted/20 p-2.5 shadow-sm transition-colors hover:bg-muted/35"
                    >
                      <div className="min-w-0 flex-1">
                        <p className="font-mono text-[11px] font-semibold text-foreground">{r.sku}</p>
                        <p className="truncate text-xs text-muted-foreground" title={r.productName}>
                          {r.productName}
                        </p>
                        <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
                          <span
                            className={cn(
                              "inline-flex rounded-full px-2 py-0.5 text-[10px] font-medium",
                              BADGE_CLASS[r.segment]
                            )}
                          >
                            {LABELS[r.segment]}
                          </span>
                          {r.daysToStockout != null ? (
                            <span className="text-[10px] tabular-nums text-muted-foreground">
                              ~{r.daysToStockout}d cover
                            </span>
                          ) : null}
                        </div>
                      </div>
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        className="h-8 shrink-0 gap-0.5 px-2 text-[11px]"
                        title="Add to stock check (manual)"
                        onClick={() => queueSkuForStockCheck(r.sku)}
                      >
                        <RiAddLine className="size-3.5" aria-hidden />
                        Queue
                      </Button>
                    </li>
                  ))}
                </ul>
              )}
            </div>

            <div className="border-t border-border/50 pt-3">
              <p className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Quick links</p>
              <nav className="flex flex-col gap-1">
                <Link
                  href="/prediction"
                  className="flex items-center justify-between rounded-lg border border-transparent px-2 py-1.5 text-xs font-medium text-foreground transition-colors hover:border-border/60 hover:bg-muted/30"
                >
                  <span className="flex items-center gap-2">
                    <RiPulseLine className="size-3.5 text-muted-foreground" aria-hidden />
                    Trends
                  </span>
                  <RiArrowRightLine className="size-3.5 text-muted-foreground" aria-hidden />
                </Link>
                <Link
                  href="/purchase"
                  className="flex items-center justify-between rounded-lg border border-transparent px-2 py-1.5 text-xs font-medium text-foreground transition-colors hover:border-border/60 hover:bg-muted/30"
                >
                  Order creation
                  <RiArrowRightLine className="size-3.5 text-muted-foreground" aria-hidden />
                </Link>
                <a
                  href="/Purchase%20Order.xlsx"
                  download
                  className="flex items-center justify-between rounded-lg border border-transparent px-2 py-1.5 text-xs font-medium text-primary transition-colors hover:border-primary/25 hover:bg-primary/5"
                >
                  PO Excel template
                  <RiDownloadLine className="size-3.5 opacity-80" aria-hidden />
                </a>
              </nav>
            </div>
          </div>
        </Panel>

        <Panel className="flex flex-col overflow-hidden border-border/60 bg-card/95 p-0 shadow-md ring-1 ring-black/5 dark:ring-white/5 lg:col-span-4 lg:min-h-[380px]">
          <div className="shrink-0 border-b border-border/50 bg-linear-to-r from-muted/40 to-muted/15 px-3 py-2.5">
            <h2 className="text-sm font-semibold tracking-tight">Portfolio snapshot</h2>
            <p className="text-[11px] text-muted-foreground">Counts by health segment</p>
          </div>
          <div className="flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto p-3">
            <div className="grid grid-cols-2 gap-2">
              {(
                [
                  ["Running low", kpis.stockout, "text-red-600 dark:text-red-400"],
                  ["Review", kpis.attention, ""],
                  ["Doing fine", kpis.healthy, "text-emerald-600 dark:text-emerald-400"],
                  ["Overstock", kpis.overstock, "text-amber-700 dark:text-amber-300"],
                ] as const
              ).map(([label, n, color]) => (
                <div
                  key={label}
                  className="rounded-xl border border-border/60 bg-linear-to-b from-muted/25 to-muted/10 p-3 shadow-sm"
                >
                  <p className="text-[11px] text-muted-foreground">{label}</p>
                  <p className={cn("text-xl font-semibold tabular-nums", color)}>{n}</p>
                </div>
              ))}
            </div>
            <div className="space-y-1 rounded-xl border border-border/50 bg-muted/15 p-3">
              <label className="text-[11px] font-medium text-muted-foreground" htmlFor="sh-cost">
                Unit cost guess (₹) — for value hints
              </label>
              <Input
                id="sh-cost"
                type="number"
                min={1}
                className="h-9 max-w-36 bg-background/80"
                value={unitCost}
                onChange={(e) => setUnitCost(Number(e.target.value) || 500)}
              />
            </div>
            <p className="text-xs leading-relaxed text-muted-foreground">{deadStockValueHint(variants, unitCost)}</p>
          </div>
        </Panel>

        <Panel className="flex flex-col overflow-hidden border-border/60 bg-card/95 p-0 shadow-md ring-1 ring-black/5 dark:ring-white/5 lg:col-span-4 lg:min-h-[380px]">
          <div className="shrink-0 border-b border-border/50 bg-linear-to-r from-muted/40 to-muted/20 px-3 py-2.5">
            <h2 className="text-sm font-semibold tracking-tight">Stock check</h2>
            <p className="mt-0.5 text-[11px] leading-snug text-muted-foreground">
              PO Excel or manual SKUs · sellable = on hand − reserved
            </p>
          </div>
          <div className="flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto p-3">
            <div className="flex rounded-xl border border-border/60 bg-muted/35 p-1 shadow-inner">
              <button
                type="button"
                onClick={() => setStockCheckMode("upload")}
                className={cn(
                  "flex flex-1 items-center justify-center gap-1.5 rounded-lg px-2 py-2 text-xs font-semibold transition-all",
                  stockCheckMode === "upload"
                    ? "bg-background text-foreground shadow-sm ring-1 ring-border/60"
                    : "text-muted-foreground hover:text-foreground"
                )}
              >
                <RiUploadCloud2Line className="size-3.5 shrink-0 opacity-90" aria-hidden />
                PO upload
              </button>
              <button
                type="button"
                onClick={() => setStockCheckMode("manual")}
                className={cn(
                  "flex flex-1 items-center justify-center gap-1.5 rounded-lg px-2 py-2 text-xs font-semibold transition-all",
                  stockCheckMode === "manual"
                    ? "bg-background text-foreground shadow-sm ring-1 ring-border/60"
                    : "text-muted-foreground hover:text-foreground"
                )}
              >
                Manual
              </button>
            </div>

            {variants.length === 0 ? (
              <p className="text-sm text-muted-foreground">No catalog.</p>
            ) : stockCheckMode === "upload" ? (
              <div className="space-y-3">
                <input
                  ref={poInputRef}
                  type="file"
                  accept=".xlsx,.xls,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/vnd.ms-excel"
                  className="hidden"
                  onChange={(e) => void ingestPoFile(e.target.files?.[0] ?? null)}
                />
                <div
                  role="button"
                  tabIndex={0}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") {
                      e.preventDefault()
                      poInputRef.current?.click()
                    }
                  }}
                  onDragEnter={(e) => {
                    e.preventDefault()
                    setPoDrag(true)
                  }}
                  onDragOver={(e) => {
                    e.preventDefault()
                    setPoDrag(true)
                  }}
                  onDragLeave={(e) => {
                    e.preventDefault()
                    if (!e.currentTarget.contains(e.relatedTarget as Node)) setPoDrag(false)
                  }}
                  onDrop={(e) => {
                    e.preventDefault()
                    setPoDrag(false)
                    const f = e.dataTransfer.files?.[0]
                    void ingestPoFile(f ?? null)
                  }}
                  onClick={() => !poBusy && poInputRef.current?.click()}
                  className={cn(
                    "group cursor-pointer rounded-2xl border-2 border-dashed px-3 py-5 text-center transition-all duration-200",
                    poDrag
                      ? "border-primary/55 bg-primary/8 shadow-md ring-2 ring-primary/20"
                      : "border-border/70 bg-linear-to-b from-muted/25 to-muted/10 hover:border-primary/40 hover:from-muted/35 hover:shadow-sm"
                  )}
                >
                  <span className="mx-auto flex size-12 items-center justify-center rounded-xl bg-background/80 shadow-sm ring-1 ring-border/50 transition-transform group-hover:scale-[1.02]">
                    {poBusy ? (
                      <RiLoader4Line className="size-7 animate-spin text-primary" aria-hidden />
                    ) : (
                      <RiUploadCloud2Line className="size-7 text-primary/80" aria-hidden />
                    )}
                  </span>
                  <p className="mt-3 text-xs font-semibold text-foreground">
                    {poBusy ? "Reading workbook…" : "Drop your PO here"}
                  </p>
                  <p className="mt-1 text-[11px] leading-relaxed text-muted-foreground">
                    Headers: <span className="font-medium text-foreground/90">ITEM #</span>,{" "}
                    <span className="font-medium text-foreground/90">DESCRIPTION</span>,{" "}
                    <span className="font-medium text-foreground/90">QTY</span>
                  </p>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="mt-3 h-8 border-border/80 bg-background/90 text-xs"
                    disabled={poBusy}
                    onClick={(e) => {
                      e.stopPropagation()
                      poInputRef.current?.click()
                    }}
                  >
                    Browse files
                  </Button>
                </div>
                <div className="flex flex-wrap items-center justify-between gap-2 text-[11px] text-muted-foreground">
                  <a
                    href="/Purchase%20Order.xlsx"
                    download
                    className="inline-flex items-center gap-1 font-medium text-primary underline-offset-2 hover:underline"
                  >
                    <RiDownloadLine className="size-3.5 opacity-70" aria-hidden />
                    Sample template
                  </a>
                  {(poFileName || poError) && (
                    <Button type="button" variant="ghost" size="sm" className="h-7 text-xs" onClick={clearPoUpload}>
                      Clear upload
                    </Button>
                  )}
                </div>
                {poError ? (
                  <div
                    className="flex gap-2 rounded-lg border border-destructive/30 bg-destructive/5 px-2.5 py-2 text-xs text-destructive"
                    role="alert"
                  >
                    <RiErrorWarningLine className="mt-0.5 size-4 shrink-0" aria-hidden />
                    <p className="min-w-0 leading-relaxed">{poError}</p>
                  </div>
                ) : null}
                {poFileName && poReportRows?.length ? (
                  <div className="space-y-2">
                    <div
                      className={cn(
                        "rounded-xl border px-3 py-2.5 text-xs shadow-sm",
                        poAllOk
                          ? "border-emerald-500/35 bg-emerald-500/10 text-emerald-950 dark:text-emerald-100"
                          : "border-amber-500/30 bg-amber-500/10 text-amber-950 dark:text-amber-50"
                      )}
                    >
                      <span className="flex flex-wrap items-center gap-1.5 font-medium">
                        {poAllOk ? (
                          <RiCheckboxCircleLine className="size-4 shrink-0 text-emerald-600 dark:text-emerald-400" aria-hidden />
                        ) : (
                          <RiErrorWarningLine className="size-4 shrink-0 text-amber-700 dark:text-amber-300" aria-hidden />
                        )}
                        <span className="truncate font-mono text-[11px]" title={poFileName}>
                          {poFileName}
                        </span>
                      </span>
                      <p className="mt-1.5 text-[11px] leading-relaxed opacity-95">
                        {poReportRows.length} line{poReportRows.length === 1 ? "" : "s"} · {poMatchedCount} matched (
                        {poMatchRatePct}%) · {poOkLineCount} OK / {poIssueLineCount} need attention
                        {poUnmatchedLineCount > 0 ? ` · ${poUnmatchedLineCount} unmatched` : ""}
                      </p>
                      {poAnalyzedAt ? (
                        <p className="mt-1 text-[10px] opacity-75">
                          Analyzed {new Date(poAnalyzedAt).toLocaleString()}
                        </p>
                      ) : null}
                    </div>
                    <div className="grid grid-cols-3 gap-1.5 text-center">
                      <div className="rounded-lg border border-border/50 bg-muted/20 px-1.5 py-1.5">
                        <p className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">Match</p>
                        <p className="text-sm font-bold tabular-nums text-foreground">{poMatchRatePct}%</p>
                      </div>
                      <div className="rounded-lg border border-border/50 bg-muted/20 px-1.5 py-1.5">
                        <p className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">OK lines</p>
                        <p className="text-sm font-bold tabular-nums text-emerald-700 dark:text-emerald-400">{poOkLineCount}</p>
                      </div>
                      <div className="rounded-lg border border-border/50 bg-muted/20 px-1.5 py-1.5">
                        <p className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">Issues</p>
                        <p className="text-sm font-bold tabular-nums text-rose-700 dark:text-rose-400">{poIssueLineCount}</p>
                      </div>
                    </div>
                  </div>
                ) : (
                  <p className="text-center text-[11px] leading-relaxed text-muted-foreground">
                    Full report, filters, and CSV export appear below after a successful upload.
                  </p>
                )}
              </div>
            ) : (
              <>
                <div className="space-y-2">
                  <div className="space-y-1">
                    <label className="text-xs text-muted-foreground" htmlFor="sh-confirm-sku">
                      SKU
                    </label>
                    <select
                      id="sh-confirm-sku"
                      className="h-9 w-full rounded-lg border border-input bg-background px-2 text-sm shadow-sm outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 dark:bg-input/30"
                      value={confirmSku}
                      onChange={(e) => setConfirmSku(e.target.value)}
                    >
                      {variants.map((v) => (
                        <option key={v.id} value={v.sku}>
                          {v.sku} — {v.productName.length > 42 ? `${v.productName.slice(0, 40)}…` : v.productName}
                        </option>
                      ))}
                    </select>
                    {sellablePreview != null ? (
                      <p className="text-[11px] text-muted-foreground">
                        Sellable{" "}
                        <span className="font-semibold tabular-nums text-foreground">{sellablePreview}</span>
                        {selectedVariantForConfirm ? (
                          <span className="text-muted-foreground/80">
                            {" "}
                            (on hand {selectedVariantForConfirm.onHand}, reserved {selectedVariantForConfirm.reserved})
                          </span>
                        ) : null}
                      </p>
                    ) : null}
                  </div>
                  <div className="flex flex-wrap items-end gap-2">
                    <div className="space-y-1">
                      <label className="text-xs text-muted-foreground" htmlFor="sh-confirm-qty">
                        Qty to add
                      </label>
                      <Input
                        id="sh-confirm-qty"
                        type="number"
                        min={1}
                        className="h-9 w-20 shadow-sm"
                        value={confirmQty}
                        onChange={(e) => setConfirmQty(Number(e.target.value) || 1)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter") {
                            e.preventDefault()
                            addConfirmLine()
                          }
                        }}
                      />
                    </div>
                    <Button type="button" size="sm" className="shrink-0" onClick={addConfirmLine}>
                      Add to check
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="shrink-0"
                      disabled={!confirmLines.length}
                      onClick={() => setConfirmLines([])}
                    >
                      Clear list
                    </Button>
                  </div>
                </div>
                {confirmLines.length > 0 && stockConfirmResults ? (
                  <div className="min-h-0 flex-1 space-y-2">
                    {confirmAllOk != null ? (
                      <div
                        className={cn(
                          "rounded-md border px-2.5 py-2 text-xs font-medium",
                          confirmAllOk
                            ? "border-emerald-500/30 bg-emerald-500/8 text-emerald-900 dark:text-emerald-100"
                            : "border-amber-500/25 bg-amber-500/8 text-amber-950 dark:text-amber-50"
                        )}
                      >
                        {confirmAllOk
                          ? "All requested qty is covered by sellable stock."
                          : "One or more lines are short — see Sellable vs Need below."}
                      </div>
                    ) : null}
                    <div className="max-h-[min(180px,32vh)] overflow-auto rounded-lg border border-border/60 shadow-sm">
                      <table className="w-full table-fixed border-collapse text-xs">
                        <colgroup>
                          <col className="w-[36%]" />
                          <col className="w-[18%]" />
                          <col className="w-[18%]" />
                          <col className="w-[16%]" />
                          <col className="w-[12%]" />
                        </colgroup>
                        <thead>
                          <tr className="border-b border-border/50 bg-muted/40 text-left text-muted-foreground">
                            <th className="px-2 py-1.5 font-medium">SKU</th>
                            <th className="px-2 py-1.5 text-right font-medium" title="Total qty you asked to check">
                              Need
                            </th>
                            <th className="px-2 py-1.5 text-right font-medium" title="Sellable now">
                              Sell
                            </th>
                            <th className="px-2 py-1.5 text-right font-medium">Status</th>
                            <th className="px-1 py-1.5 text-right font-medium">
                              <span className="sr-only">Remove</span>
                            </th>
                          </tr>
                        </thead>
                        <tbody>
                          {stockConfirmResults.map((r) => (
                            <tr key={r.sku} className="border-b border-border/40 last:border-0">
                              <td
                                className="px-2 py-1.5 font-mono text-[11px] leading-tight text-foreground"
                                title={r.sku}
                              >
                                <span className="block truncate">{r.sku}</span>
                              </td>
                              <td className="px-2 py-1.5 text-right tabular-nums">{r.requested}</td>
                              <td className="px-2 py-1.5 text-right tabular-nums">{r.available}</td>
                              <td className="px-2 py-1.5 text-right tabular-nums">
                                {r.ok ? (
                                  <span className="font-medium text-emerald-600 dark:text-emerald-400">OK</span>
                                ) : (
                                  <span className="font-medium text-rose-600 dark:text-rose-400">
                                    short {r.requested - r.available}
                                  </span>
                                )}
                              </td>
                              <td className="px-1 py-1 text-right align-middle">
                                <Button
                                  type="button"
                                  variant="outline"
                                  size="icon-sm"
                                  className="size-7 shrink-0 border-border/60 text-muted-foreground hover:border-destructive/40 hover:text-destructive"
                                  aria-label={`Remove ${r.sku} from check`}
                                  onClick={() => removeConfirmLine(r.sku)}
                                >
                                  <RiCloseLine className="size-3.5" aria-hidden />
                                </Button>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                    <p className="text-[10px] leading-snug text-muted-foreground">
                      Need is the running total for that SKU (each Add stacks). It can differ from &quot;Qty to add&quot;
                      above.
                    </p>
                    <Button
                      type="button"
                      variant="secondary"
                      size="sm"
                      className="w-full"
                      onClick={() => void copyStockReport()}
                    >
                      {copiedReport ? "Copied" : "Copy text report"}
                    </Button>
                  </div>
                ) : (
                  <p className="rounded-md border border-dashed border-border/60 bg-muted/20 px-3 py-3 text-center text-xs text-muted-foreground">
                    Add SKUs to verify against sellable stock, or use{" "}
                    <button
                      type="button"
                      className="font-medium text-primary underline-offset-2 hover:underline"
                      onClick={() => setStockCheckMode("upload")}
                    >
                      PO upload
                    </button>
                    .
                  </p>
                )}
              </>
            )}
          </div>
        </Panel>
      </div>

      {poReportRows && poReportRows.length > 0 ? (
        <Panel className="overflow-hidden border-primary/25 bg-linear-to-b from-primary/8 via-card to-muted/25 p-0 shadow-lg ring-1 ring-primary/15">
          <div className="flex flex-col gap-3 border-b border-border/50 bg-linear-to-r from-muted/45 to-muted/20 px-4 py-3 sm:flex-row sm:items-start sm:justify-between">
            <div className="flex min-w-0 flex-1 items-start gap-2">
              <button
                type="button"
                onClick={() => setPoReportCollapsed((c) => !c)}
                className="mt-0.5 inline-flex size-8 shrink-0 items-center justify-center rounded-lg border border-border/60 bg-background/80 text-muted-foreground shadow-sm transition-colors hover:bg-muted/50 hover:text-foreground"
                aria-expanded={!poReportCollapsed}
                aria-label={poReportCollapsed ? "Expand PO report" : "Collapse PO report"}
              >
                <RiArrowDownSLine
                  className={cn("size-4 transition-transform duration-200", poReportCollapsed && "-rotate-90")}
                  aria-hidden
                />
              </button>
              <div className="min-w-0">
                <h2 className="text-sm font-semibold tracking-tight">PO stock confirmation</h2>
                <p className="mt-0.5 text-xs text-muted-foreground">
                  <span className="font-mono text-[11px] text-foreground">{poFileName}</span>
                  <span className="mx-1.5 text-border">·</span>
                  {source === "odoo" ? "Live Odoo" : "Sample"} catalog ({variants.length} SKUs)
                </p>
              </div>
            </div>
            <div className="flex flex-wrap gap-2 sm:justify-end">
              <Button type="button" variant="outline" size="sm" className="h-9 bg-background/80" onClick={() => void copyPoReport()}>
                {copiedPoReport ? "Copied" : "Copy text"}
              </Button>
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="h-9 bg-background/80"
                onClick={() => void copyPoCsv()}
              >
                {copiedPoCsv ? "CSV copied" : "Copy CSV"}
              </Button>
              <Button type="button" variant="outline" size="sm" className="h-9 gap-1 bg-background/80" onClick={downloadPoCsv}>
                <RiDownloadLine className="size-3.5" aria-hidden />
                .csv
              </Button>
              <Button
                type="button"
                variant="secondary"
                size="sm"
                className="h-9"
                disabled={!poMatchedCount}
                onClick={mergePoIntoManualCheck}
              >
                To manual check
              </Button>
            </div>
          </div>

          {!poReportCollapsed ? (
            <>
              <div className="flex flex-col gap-3 border-b border-border/40 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex flex-wrap gap-1.5">
                  {(
                    [
                      ["all", "All lines", poReportRows.length],
                      ["issues", "Needs attention", poIssueLineCount],
                      ["unmatched", "Unmatched", poUnmatchedLineCount],
                    ] as const
                  ).map(([key, label, n]) => (
                    <button
                      key={key}
                      type="button"
                      onClick={() => setPoRowFilter(key)}
                      className={cn(
                        "rounded-full px-3 py-1 text-xs font-medium transition-colors",
                        poRowFilter === key
                          ? "bg-primary text-primary-foreground shadow-sm"
                          : "bg-muted/60 text-muted-foreground hover:bg-muted hover:text-foreground"
                      )}
                    >
                      {label}
                      <span className="ml-1 tabular-nums opacity-80">({n})</span>
                    </button>
                  ))}
                </div>
                <p className="text-[11px] text-muted-foreground">
                  Showing <span className="font-semibold text-foreground">{filteredPoReportRows.length}</span> of{" "}
                  {poReportRows.length}
                </p>
              </div>

              <div className="p-3 sm:p-4">
                <div className="overflow-hidden rounded-xl border border-border/60 bg-card/50 shadow-inner">
                  <div className="max-h-[min(520px,60vh)] overflow-auto">
                    <table className="w-full min-w-[860px] border-collapse text-sm">
                      <thead className="sticky top-0 z-10 border-b border-border/60 bg-muted/95 backdrop-blur-sm">
                        <tr className="text-left text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                          <th className="px-3 py-2.5">Row</th>
                          <th className="px-3 py-2.5">Item #</th>
                          <th className="px-3 py-2.5">Description</th>
                          <th className="px-3 py-2.5 text-right">Qty</th>
                          <th className="px-3 py-2.5">Match</th>
                          <th className="px-3 py-2.5 text-right" title="Total on PO for this SKU">
                            SKU Σ
                          </th>
                          <th className="px-3 py-2.5 text-right">Sellable</th>
                          <th className="px-3 py-2.5 text-center">Status</th>
                          <th className="min-w-[140px] px-3 py-2.5">Note</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-border/35">
                        {filteredPoReportRows.length === 0 ? (
                          <tr>
                            <td colSpan={9} className="px-3 py-10 text-center text-sm text-muted-foreground">
                              No rows for this filter — try <span className="font-medium text-foreground">All lines</span>.
                            </td>
                          </tr>
                        ) : (
                          filteredPoReportRows.map((r, i) => (
                            <tr
                              key={`po-${r.rowIndex}-${i}-${poRowFilter}`}
                              className={cn(
                                "transition-colors hover:bg-muted/40",
                                r.lineOk ? "bg-emerald-500/4" : "bg-rose-500/4"
                              )}
                            >
                              <td className="px-3 py-2.5 tabular-nums text-muted-foreground">{r.rowIndex}</td>
                              <td className="px-3 py-2.5 font-mono text-xs text-foreground">{r.itemNumber || "—"}</td>
                              <td className="max-w-[200px] px-3 py-2.5">
                                <span className="font-medium text-foreground">{r.description}</span>
                                {r.catalogProductName && r.matchMethod !== "none" ? (
                                  <span
                                    className="mt-0.5 block truncate text-xs text-muted-foreground"
                                    title={r.catalogProductName}
                                  >
                                    → {r.catalogProductName}
                                  </span>
                                ) : null}
                              </td>
                              <td className="px-3 py-2.5 text-right tabular-nums font-medium">{r.qty}</td>
                              <td className="px-3 py-2.5">
                                {r.resolvedSku ? (
                                  <span className="font-mono text-xs text-foreground">{r.resolvedSku}</span>
                                ) : (
                                  <span className="text-xs text-rose-700 dark:text-rose-300">Unmatched</span>
                                )}
                                {r.matchMethod !== "none" ? (
                                  <span className="mt-0.5 block text-[10px] uppercase tracking-wide text-muted-foreground">
                                    {r.matchMethod === "name_exact"
                                      ? "name"
                                      : r.matchMethod === "name_fuzzy"
                                        ? "fuzzy"
                                        : "sku"}
                                  </span>
                                ) : null}
                              </td>
                              <td className="px-3 py-2.5 text-right tabular-nums text-muted-foreground">
                                {r.skuAggregateQty}
                              </td>
                              <td className="px-3 py-2.5 text-right tabular-nums">{r.resolvedSku ? r.sellable : "—"}</td>
                              <td className="px-3 py-2.5 text-center">
                                {r.lineOk ? (
                                  <span className="inline-flex items-center gap-1 rounded-full border border-emerald-500/35 bg-emerald-500/15 px-2 py-0.5 text-xs font-semibold text-emerald-800 dark:text-emerald-200">
                                    <RiCheckboxCircleLine className="size-3.5" aria-hidden />
                                    OK
                                  </span>
                                ) : (
                                  <span className="inline-flex items-center gap-1 rounded-full border border-rose-500/35 bg-rose-500/15 px-2 py-0.5 text-xs font-semibold text-rose-800 dark:text-rose-200">
                                    <RiErrorWarningLine className="size-3.5" aria-hidden />
                                    Issue
                                  </span>
                                )}
                              </td>
                              <td className="max-w-[200px] px-3 py-2 text-xs leading-snug text-muted-foreground" title={r.note}>
                                <span className="line-clamp-2">{r.note}</span>
                              </td>
                            </tr>
                          ))
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
                <p className="mt-3 text-[11px] leading-relaxed text-muted-foreground">
                  <span className="font-medium text-foreground">SKU Σ</span> is the combined quantity on the PO for that
                  catalog SKU. Export includes on hand and reserved for matched lines.
                </p>
              </div>
            </>
          ) : (
            <div className="px-4 py-3 text-center text-xs text-muted-foreground">
              Report collapsed — click <span className="font-medium text-foreground">expand</span> to see the table and
              filters.
            </div>
          )}
        </Panel>
      ) : null}

      {/* Filters + table (single panel) */}
      <Panel className="space-y-3 border-border/60 bg-card/95 p-0 shadow-sm">
        <div className="border-b border-border/50 bg-muted/25 px-3 py-2.5">
          <h2 className="text-sm font-semibold">All SKUs</h2>
          <p className="text-[11px] text-muted-foreground">Filter, sort, search — add rows to the stock check above</p>
        </div>
        <div className="space-y-3 p-3">
        <div className="flex flex-col gap-3 lg:flex-row lg:flex-wrap lg:items-center lg:justify-between">
          <div className="flex flex-wrap gap-1.5">
            {(
              [
                ["all", "All"],
                ["attention", "Review"],
                ["stockout", "Low"],
                ["slow_dead", "Slow"],
                ["overstock", "Heavy"],
                ["healthy", "Fine"],
              ] as const
            ).map(([key, label]) => (
              <button
                key={key}
                type="button"
                onClick={() => setFilter(key)}
                className={cn(
                  "rounded-full px-3 py-1 text-xs font-medium transition-colors",
                  filter === key
                    ? "bg-primary text-primary-foreground shadow-sm"
                    : "bg-muted text-muted-foreground hover:bg-muted/80 hover:text-foreground"
                )}
              >
                {label}
              </button>
            ))}
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {/* <select
              className="h-9 rounded-lg border border-input bg-background px-2 text-sm shadow-sm"
              value={sort}
              onChange={(e) => setSort(e.target.value as SortMode)}
            >
              <option value="days_asc">Days left ↑</option>
              <option value="days_desc">Days left ↓</option>
              <option value="on_hand_desc">On hand</option>
              <option value="trend_desc">Trend</option>
            </select> */}
            <Input
              placeholder="Search SKU or product…"
              className="h-9 max-w-xs shadow-sm"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
          </div>
        </div>
        <p className="text-xs text-muted-foreground">
          {rows.length} of {enriched.length} SKUs
        </p>

        <div className="max-h-[min(560px,55vh)] overflow-auto rounded-lg border border-border/60">
          <table className="w-full min-w-[920px] text-sm">
            <thead className="sticky top-0 z-1 border-b border-border/60 bg-muted/90 backdrop-blur-sm">
              <tr className="text-left text-xs font-semibold uppercase text-muted-foreground">
                <th className="px-3 py-2" title="Stock keeping unit">
                  SKU
                </th>
                <th className="px-3 py-2">Product</th>
                <th className="px-3 py-2">Label</th>
                <th className="px-3 py-2 text-right" title="Weeks of cover">
                  Cover
                </th>
                <th className="px-3 py-2 text-right">Trend</th>
                <th className="px-3 py-2 text-right" title="Estimated days of stock left">
                  Days
                </th>
                <th className="px-3 py-2 text-right" title="Units per week">
                  u/wk
                </th>
                <th className="px-3 py-2 text-right" title="On hand">
                  OH
                </th>
                <th className="px-3 py-2 text-right" title="Inbound">
                  In
                </th>
                <th className="px-3 py-2 text-right" title="Sales last 90 days">
                  90d
                </th>
                <th className="px-3 py-2 text-center" title="Add to stock check">
                  +
                </th>
                <th className="px-3 py-2">Note</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/50">
              {rows.length === 0 ? (
                <tr>
                  <td colSpan={12} className="px-3 py-8 text-center text-sm text-muted-foreground">
                    Nothing matches — try All or clear search.
                  </td>
                </tr>
              ) : (
                rows.map((r) => (
                  <tr
                    key={r.sku}
                    className={cn(
                      "transition-colors hover:bg-muted/20",
                      rowTone(r.segment),
                      confirmSkuSet.has(r.sku) &&
                        "bg-primary/5 ring-1 ring-inset ring-primary/15"
                    )}
                  >
                    <td className="px-3 py-2 font-mono text-xs">{r.sku}</td>
                    <td className="max-w-[160px] truncate px-3 py-2" title={r.productName}>
                      {r.productName}
                    </td>
                    <td className="px-3 py-2">
                      <span
                        className={cn(
                          "inline-flex rounded-full px-2 py-0.5 text-xs font-medium",
                          BADGE_CLASS[r.segment]
                        )}
                      >
                        {LABELS[r.segment]}
                      </span>
                    </td>
                    <td className="px-3 py-2 text-right tabular-nums">{r.weeksCover.toFixed(1)}</td>
                    <td className="px-3 py-2 text-right tabular-nums">{r.trendScore}</td>
                    <td className="px-3 py-2 text-right tabular-nums">{r.daysToStockout ?? "—"}</td>
                    <td className="px-3 py-2 text-right tabular-nums">{r.weeklyDemand}</td>
                    <td className="px-3 py-2 text-right tabular-nums">{r.onHand}</td>
                    <td className="px-3 py-2 text-right tabular-nums">{r.inbound}</td>
                    <td className="px-3 py-2 text-right tabular-nums">{r.salesQty90d ?? "—"}</td>
                    <td className="px-1 py-1 text-center">
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="h-8 w-8 p-0"
                        title={`Add ${r.sku} × ${confirmQty} to stock check`}
                        aria-label={`Add ${r.sku} to stock check`}
                        onClick={() => addConfirmLineForSku(r.sku)}
                      >
                        <RiAddLine className="size-4" aria-hidden />
                      </Button>
                    </td>
                    <td className="max-w-[180px] truncate px-3 py-2 text-xs text-muted-foreground">{r.note}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
        </div>
      </Panel>
    </div>
  )
}
