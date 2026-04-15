"use client"

import * as React from "react"
import { RiArrowUpLine, RiFileExcel2Line, RiPriceTag3Line } from "@remixicon/react"

import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"

type Props = {
  value: string
  onChange: (v: string) => void
  onSubmit: () => void
  onExcelSelected: (file: File) => void | Promise<void>
  disabled?: boolean
  excelBusy?: boolean
  error?: string | null
  className?: string
  /** Hides the marketing header — input + actions only */
  minimal?: boolean
  /** Bottom-docked bar: stronger lift for ChatGPT-style placement */
  docked?: boolean
  /** Textarea grows to fill available space (Claude-style full-height input) */
  fill?: boolean
}

/**
 * ChatGPT-style composer: wide pill, attach Excel, primary send — aligned with Trends search bar styling.
 */
export function RspComposer({
  value,
  onChange,
  onSubmit,
  onExcelSelected,
  disabled,
  excelBusy,
  error,
  className,
  minimal = false,
  docked = false,
  fill = false,
}: Props) {
  const fileRef = React.useRef<HTMLInputElement>(null)

  const submit = () => {
    if (disabled || excelBusy) return
    onSubmit()
  }

  return (
    <div className={cn("w-full max-w-3xl", className)}>
      <div
        className={cn(
          "overflow-hidden rounded-3xl border-2 border-border/70 bg-card/95 shadow-xl ring-1 ring-border/30 backdrop-blur-md transition-all",
          "focus-within:border-primary/35 focus-within:shadow-2xl focus-within:ring-primary/15",
          docked &&
          "rounded-[22px] border-border/50 bg-card shadow-[0_-4px_32px_-8px_rgba(0,0,0,0.12),0_8px_32px_-8px_rgba(0,0,0,0.15)] dark:shadow-[0_-4px_32px_-8px_rgba(0,0,0,0.45),0_8px_40px_-12px_rgba(0,0,0,0.5)]",
          fill && "flex flex-col"
        )}
      >
        {!minimal ? (
          <div className="flex gap-2 border-b border-border/40 bg-muted/20 px-4 py-2.5">
            <span className="inline-flex size-8 shrink-0 items-center justify-center rounded-xl bg-primary/12 text-primary ring-1 ring-primary/20">
              <RiPriceTag3Line className="size-4" aria-hidden />
            </span>
            <div className="min-w-0 flex-1 text-left">
              <p className="text-sm font-semibold tracking-tight">Retail selling price</p>
              <p className="text-[11px] leading-snug text-muted-foreground">
                Type COGS in AED or attach a spreadsheet — we&apos;ll compute UAE, region &amp; Saudi.
              </p>
            </div>
          </div>
        ) : null}

        <label className={cn("block px-1", !minimal ? "pt-2" : "pt-3", fill && "flex-1")}>
          <span className="sr-only">COGS amount in Indian rupees</span>
          <textarea
            rows={fill ? undefined : 2}
            value={value}
            onChange={(e) => onChange(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault()
                submit()
              }
            }}
            placeholder={
              minimal
                ? "COGS in AED (e.g. 450) or upload Excel…"
                : "e.g. 450 — or upload Excel / CSV with a COGS column (and optional Name / SKU)…"
            }
            disabled={disabled || excelBusy}
            className={cn(
              "w-full resize-none bg-transparent px-4 py-3 text-[15px] leading-relaxed outline-none placeholder:text-muted-foreground/70 disabled:opacity-60",
              fill ? "h-full min-h-[120px]" : "max-h-40 min-h-[72px] resize-y"
            )}
          />
        </label>

        <div className="flex flex-wrap items-center justify-between gap-2 border-t border-border/40 bg-muted/10 px-3 py-2.5">
          <div className="flex flex-wrap items-center gap-1.5">
            <input
              ref={fileRef}
              type="file"
              accept=".xlsx,.xls,.csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/vnd.ms-excel,text/csv"
              className="sr-only"
              onChange={(e) => {
                const f = e.target.files?.[0]
                e.target.value = ""
                if (f) void onExcelSelected(f)
              }}
            />
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="gap-1.5 rounded-full border-border/80"
              disabled={disabled || excelBusy}
              onClick={() => fileRef.current?.click()}
            >
              <RiFileExcel2Line className="size-4 text-emerald-600 dark:text-emerald-400" aria-hidden />
              {excelBusy ? "Reading…" : "Upload Excel"}
            </Button>
            <span className="rounded-full border border-border/70 bg-background/70 px-2 py-0.5 text-[10px] text-muted-foreground">
              Enter to run
            </span>
          </div>
          <Button
            type="button"
            size="sm"
            className="h-10 shrink-0 gap-1.5 rounded-full px-3 shadow-md"
            disabled={disabled || excelBusy}
            onClick={submit}
            aria-label="Generate RSP"
          >
            <RiArrowUpLine className="size-5" aria-hidden />
            <span className="text-xs font-semibold">Generate</span>
          </Button>
        </div>
      </div>
      {error ? (
        <p className="mt-2 px-1 text-center text-xs text-rose-600 dark:text-rose-400" role="alert">
          {error}
        </p>
      ) : null}
    </div>
  )
}
