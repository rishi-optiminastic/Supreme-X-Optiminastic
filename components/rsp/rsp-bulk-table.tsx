"use client"

import * as React from "react"
import {
  RiDownloadLine,
  RiFileList3Line,
  RiFundsLine,
  RiGlobalLine,
  RiMapPinLine,
  RiStackLine,
} from "@remixicon/react"
import * as XLSX from "xlsx"

import { Panel } from "@/components/panel"
import { Button } from "@/components/ui/button"
import { RspMetricCard } from "@/components/rsp/rsp-metric-card"
import { RspQuoteSheetDialog } from "@/components/rsp/rsp-quote-sheet-dialog"
import { deriveRspNumbers, type RspSharePayload } from "@/lib/rsp-share-types"
import { cn } from "@/lib/utils"

export type RspBulkRow = {
  id: string
  label: string
  cogs: number
}

type Computed = RspBulkRow & ReturnType<typeof deriveRspNumbers>

function toMoney(n: number) {
  return `AED ${Math.round(n).toLocaleString("en-AE")}`
}

function computeRows(payload: RspSharePayload, rows: RspBulkRow[]): Computed[] {
  return rows.map((r) => ({
    ...r,
    ...deriveRspNumbers({ ...payload, cogs: r.cogs }),
  }))
}

type Props = {
  payload: RspSharePayload
  rows: RspBulkRow[]
  className?: string
}

export function RspBulkTable({ payload, rows, className }: Props) {
  const [quoteOpen, setQuoteOpen] = React.useState(false)
  const computed = React.useMemo(() => computeRows(payload, rows), [payload, rows])
  const quoteLines = React.useMemo(() => rows.map((r) => ({ label: r.label, cogs: r.cogs })), [rows])

  const avg = React.useMemo(() => {
    if (!computed.length) return { cogs: 0, uae: 0, region: 0, Saudi: 0 }
    const n = computed.length
    const sum = computed.reduce(
      (acc, r) => ({
        cogs: acc.cogs + r.cogs,
        uae: acc.uae + r.uaeRsp,
        region: acc.region + r.regionRsp,
        Saudi: acc.Saudi + r.SaudiRsp,
      }),
      { cogs: 0, uae: 0, region: 0, Saudi: 0 }
    )
    return {
      cogs: Math.round(sum.cogs / n),
      uae: Math.round(sum.uae / n),
      region: Math.round(sum.region / n),
      Saudi: Math.round(sum.Saudi / n),
    }
  }, [computed])

  const exportXlsx = () => {
    const data = computed.map((r) => ({
      Label: r.label,
      COGS: r.cogs,
      "UAE RSP": r.uaeRsp,
      "Region RSP": r.regionRsp,
      "Saudi RSP": r.SaudiRsp,
      "Thin shelf (low %)": r.marginBandLowShelf,
      "Healthy shelf (high %)": r.marginBandHighShelf,
    }))
    const ws = XLSX.utils.json_to_sheet(data)
    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws, "RSP bulk")
    XLSX.writeFile(wb, `rsp-bulk-${new Date().toISOString().slice(0, 10)}.xlsx`)
  }

  return (
    <div className={cn("space-y-4", className)}>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <RspMetricCard
          title="Lines"
          value={String(computed.length)}
          helper="Rows in this workbook"
          icon={<RiStackLine className="size-4" aria-hidden />}
          barPct={Math.min(100, Math.max(8, computed.length * 4))}
        />
        <RspMetricCard
          title="Avg COGS"
          value={toMoney(avg.cogs)}
          helper="Mean unit cost"
          icon={<RiFundsLine className="size-4" aria-hidden />}
          barPct={55}
        />
        <RspMetricCard
          title="Avg UAE RSP"
          value={toMoney(avg.uae)}
          helper="VAT-inclusive shelf"
          icon={<RiGlobalLine className="size-4" aria-hidden />}
          barPct={62}
        />
        <RspMetricCard
          title="Avg region RSP"
          value={toMoney(avg.region)}
          helper="Freight + margin stack"
          icon={<RiMapPinLine className="size-4" aria-hidden />}
          barPct={58}
        />
      </div>

      <Panel className="overflow-hidden border-border/60 p-0 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border/50 bg-muted/25 px-4 py-2.5">
          <div>
            <h2 className="text-sm font-semibold tracking-tight">Bulk RSP</h2>
            <p className="text-[11px] text-muted-foreground">
              Same margin &amp; tax model as the calculator — one row per SKU / line.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="gap-1.5"
              disabled={!rows.length}
              onClick={() => setQuoteOpen(true)}
            >
              <RiFileList3Line className="size-4" aria-hidden />
              Quote sheet
            </Button>
            <Button type="button" variant="secondary" size="sm" className="gap-1.5" onClick={exportXlsx}>
              <RiDownloadLine className="size-4" aria-hidden />
              Export Excel
            </Button>
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[720px] text-left text-sm">
            <thead className="sticky top-0 z-10">
              <tr className="border-b border-border/60 bg-muted/40 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground backdrop-blur">
                <th className="px-4 py-3">Label</th>
                <th className="px-3 py-3 tabular-nums">COGS</th>
                <th className="px-3 py-3 tabular-nums">UAE</th>
                <th className="px-3 py-3 tabular-nums">Region</th>
                <th className="px-3 py-3 tabular-nums">Saudi</th>
                <th className="px-3 py-3 tabular-nums">Thin shelf</th>
                <th className="px-4 py-3 tabular-nums">Healthy shelf</th>
              </tr>
            </thead>
            <tbody>
              {computed.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-4 py-10 text-center text-sm text-muted-foreground">
                    No rows available yet. Upload an Excel file or add lines to view bulk pricing.
                  </td>
                </tr>
              ) : (
                computed.map((r, idx) => (
                  <tr
                    key={r.id}
                    className={cn(
                      "border-b border-border/40 transition-colors hover:bg-muted/30",
                      idx % 2 === 1 && "bg-muted/6"
                    )}
                  >
                    <td className="max-w-[200px] truncate px-4 py-2.5 font-medium">{r.label}</td>
                    <td className="px-3 py-2.5 font-mono text-xs tabular-nums text-muted-foreground">
                      {toMoney(r.cogs)}
                    </td>
                    <td className="px-3 py-2.5 font-mono text-xs tabular-nums">{toMoney(r.uaeRsp)}</td>
                    <td className="px-3 py-2.5 font-mono text-xs tabular-nums">{toMoney(r.regionRsp)}</td>
                    <td className="px-3 py-2.5 font-mono text-xs tabular-nums">{toMoney(r.SaudiRsp)}</td>
                    <td className="px-3 py-2.5 font-mono text-xs tabular-nums text-muted-foreground">
                      {toMoney(r.marginBandLowShelf)}
                    </td>
                    <td className="px-4 py-2.5 font-mono text-xs tabular-nums text-muted-foreground">
                      {toMoney(r.marginBandHighShelf)}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </Panel>

      <RspQuoteSheetDialog
        open={quoteOpen}
        onOpenChange={setQuoteOpen}
        payload={payload}
        lines={quoteLines}
      />
    </div>
  )
}
