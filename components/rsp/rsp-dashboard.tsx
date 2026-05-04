"use client"

import type { ReactNode } from "react"
import * as React from "react"
import {
  RiAddLine,
  RiCheckLine,
  RiDeleteBinLine,
  RiEqualizerLine,
  RiFundsLine,
  RiGlobalLine,
  RiLineChartLine,
  RiMapPinLine,
  RiPercentLine,
  RiPriceTag3Line,
  RiSparklingLine,
} from "@remixicon/react"

import { Panel } from "@/components/panel"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { RspQuoteSheetDialog, type RspQuoteLine } from "@/components/rsp/rsp-quote-sheet-dialog"
import {
  type RspFactor,
  type RspSharePayload,
  defaultFactors,
  deriveRspNumbers,
  recomputePayload,
} from "@/lib/rsp-share-types"
import {
  loadRetailerTemplatesState,
  normalizeRetailerArea,
  type RetailerArea,
} from "@/lib/retailer-order-templates"
import { cn } from "@/lib/utils"

function toMoney(n: number) {
  return `AED ${Math.round(n).toLocaleString("en-AE")}`
}

function newFactorId() {
  return typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : `f-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`
}

type Props = {
  payload: RspSharePayload
  onChange: (next: RspSharePayload) => void
  className?: string
  /** When set (e.g. bulk session), quote sheet lists these lines; otherwise title + COGS from payload. */
  quoteProductLines?: RspQuoteLine[]
  /** Expose quote sheet open state externally */
  quoteOpen?: boolean
  onQuoteOpenChange?: (open: boolean) => void
}

export function RspDashboard({
  payload,
  onChange,
  className,
  quoteProductLines,
  quoteOpen: externalQuoteOpen,
  onQuoteOpenChange,
}: Props) {
  const d = deriveRspNumbers(payload)
  const [internalQuoteOpen, setInternalQuoteOpen] = React.useState(false)

  // Load retailers from shared localStorage store
  const [retailers, setRetailers] = React.useState<{ id: string; name: string; area: RetailerArea }[]>([])
  React.useLayoutEffect(() => {
    try {
      const s = loadRetailerTemplatesState()
      setRetailers(
        (s.retailers ?? []).map((r) => ({
          id: r.id,
          name: r.name,
          area: normalizeRetailerArea(r.area),
        }))
      )
    } catch {
      /* storage unavailable */
    }
  }, [])

  const quoteOpen = externalQuoteOpen !== undefined ? externalQuoteOpen : internalQuoteOpen
  const setQuoteOpen = (v: boolean) => {
    setInternalQuoteOpen(v)
    onQuoteOpenChange?.(v)
  }

  const quoteLines = React.useMemo((): RspQuoteLine[] => {
    if (quoteProductLines && quoteProductLines.length > 0) return quoteProductLines
    return [{ label: payload.title?.trim() || "Product", cogs: payload.cogs }]
  }, [quoteProductLines, payload.title, payload.cogs])

  const patch = React.useCallback(
    (fn: (p: RspSharePayload) => RspSharePayload) => {
      onChange(recomputePayload(fn(payload)))
    },
    [onChange, payload]
  )

  const setNum = (key: keyof RspSharePayload, val: number) => {
    patch((p) => ({ ...p, [key]: val }))
  }

  const updateFactor = (id: string, part: Partial<RspFactor>) => {
    patch((p) => ({
      ...p,
      factors: p.factors.map((f) => (f.id === id ? { ...f, ...part } : f)),
    }))
  }

  const addFactor = () => {
    patch((p) => ({
      ...p,
      factors: [
        ...p.factors,
        { id: newFactorId(), label: "New factor", detail: "Describe impact on price." },
      ],
    }))
  }

  const removeFactor = (id: string) => {
    patch((p) => ({ ...p, factors: p.factors.filter((f) => f.id !== id) }))
  }

  const resetFactors = () => {
    patch((p) => ({ ...p, factors: defaultFactors() }))
  }

  const stackSteps = [
    { label: "Factory COGS", value: d.factoryCogs, pct: null as string | null },
    { label: "After input duty", value: d.afterInputDuty, pct: `${payload.inputDutyPct}%` },
    { label: "After marketing", value: d.afterMarketing, pct: `${payload.marketingPct}%` },
    { label: "After overhead", value: d.afterCompanyOverhead, pct: `${payload.companyOverheadPct}%` },
    { label: "After payment / bank", value: d.afterPaymentHandling, pct: `${payload.paymentHandlingPct}%` },
  ]

  return (
    <div className={cn("space-y-4 lg:space-y-5", className)}>
      {/* Title + factory COGS */}
      {/* <Panel className="border-border/60 bg-linear-to-br from-background via-card to-muted/20 p-4 shadow-sm sm:p-5"> */}
      {/* <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between"> */}
      {/* <div className="min-w-0 space-y-1.5">
            <label className="text-xs font-medium text-muted-foreground" htmlFor="dash-title">
              Title
            </label>
            <Input
              id="dash-title"
              value={payload.title}
              onChange={(e) => patch((p) => ({ ...p, title: e.target.value }))}
              placeholder="Optional name for this RSP"
              className="max-w-md bg-background/90"
            />
          </div> */}
      {/* <div className="space-y-1">
            <label htmlFor="dash-cogs" className="text-xs font-medium text-muted-foreground">
              Factory COGS (AED)
            </label>
            <Input
              id="dash-cogs"
              inputMode="decimal"
              className="h-11 w-40 bg-background/90 font-mono text-base tabular-nums"
              value={payload.cogs || ""}
              onChange={(e) => {
                const n = Number(e.target.value.replace(/,/g, ""))
                patch((p) => ({ ...p, cogs: Number.isFinite(n) ? Math.max(0, n) : 0 }))
              }}
            />
          </div> */}
      {/* </div> */}
      {/* </Panel> */}
      <div className="lg:col-span-12">
        <div className="overflow-hidden rounded-2xl border-2 border-primary/15 bg-linear-to-br from-primary/[0.04] via-card to-muted/25 shadow-lg ring-1 ring-primary/10">
          {/* Header */}
          <div className="flex flex-col gap-3 border-b border-border/60 bg-linear-to-r from-primary/8 via-primary/4 to-transparent px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex flex-wrap items-center gap-2.5">
              <span className="flex size-9 items-center justify-center rounded-xl bg-primary/15 text-primary shadow-sm ring-1 ring-primary/20">
                <RiPercentLine className="size-4" aria-hidden />
              </span>
              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <h3 className="text-sm font-semibold sm:text-base">Detailed RSP breakdown</h3>
                  <span className="inline-flex items-center gap-1 rounded-full border border-primary/25 bg-background/90 px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-primary/90">
                    <RiSparklingLine className="size-3" aria-hidden />
                    Formula trace
                  </span>
                </div>
                <p className="mt-0.5 text-[11px] text-muted-foreground">
                  Step-by-step cost stacking for each channel
                </p>
              </div>
            </div>
            <Button
              type="button"
              size="sm"
              className="h-9 shrink-0 gap-2 bg-primary/90 text-primary-foreground shadow-sm hover:bg-primary"
              onClick={() => setQuoteOpen(true)}
            >
              <RiPriceTag3Line className="size-3.5" aria-hidden />
              Quote sheet
            </Button>
          </div>

          {/* Channel columns */}
          <div className="grid gap-0 divide-y divide-border/40 lg:divide-x lg:divide-y-0 lg:grid-cols-3 p-0">
            <EnhancedBreakdownColumn
              accent="sky"
              title="UAE"
              icon={<RiGlobalLine className="size-4" />}
              finalLabel="UAE shelf price"
              finalValue={d.uaeRsp}
              steps={[
                { k: "Factory COGS", v: toMoney(d.factoryCogs), kind: "base" },
                { k: `Input duty (${payload.inputDutyPct}%)`, v: toMoney(d.afterInputDuty), kind: "add" },
                { k: `Marketing (${payload.marketingPct}%)`, v: toMoney(d.afterMarketing), kind: "add" },
                { k: `Overhead (${payload.companyOverheadPct}%)`, v: toMoney(d.afterCompanyOverhead), kind: "add" },
                { k: `Payment (${payload.paymentHandlingPct}%)`, v: toMoney(d.loadedCost), kind: "checkpoint" },
                { k: `× Margin (${payload.marginMultiplier})`, v: toMoney(d.uaeBase), kind: "multiply" },
                { k: `+ VAT (${payload.uaeVatPct}%)`, v: toMoney(d.uaeRsp), kind: "final" },
              ]}
            />
            <EnhancedBreakdownColumn
              accent="emerald"
              title="Region"
              icon={<RiMapPinLine className="size-4" />}
              finalLabel="Region shelf price"
              finalValue={d.regionRsp}
              steps={[
                { k: "Loaded cost", v: toMoney(d.loadedCost), kind: "checkpoint" },
                { k: `+ Freight (${payload.regionFreightPct}%)`, v: toMoney(d.regionLanded), kind: "add" },
                { k: `× Margin (${payload.marginMultiplier})`, v: toMoney(d.regionRsp), kind: "final" },
              ]}
            />
            <EnhancedBreakdownColumn
              accent="violet"
              title="Saudi"
              icon={<RiFundsLine className="size-4" />}
              finalLabel="Saudi shelf price"
              finalValue={d.SaudiRsp}
              steps={[
                { k: "Loaded cost", v: toMoney(d.loadedCost), kind: "checkpoint" },
                { k: `+ Freight (${payload.SaudiFreightPct}%)`, v: toMoney(d.SaudiAfterFreight), kind: "add" },
                { k: `× Margin (${payload.marginMultiplier})`, v: toMoney(d.SaudiAfterMargin), kind: "multiply" },
                { k: `+ VAT (${payload.SaudiVatPct}%)`, v: toMoney(d.SaudiRsp), kind: "final" },
              ]}
            />
          </div>
        </div>
      </div>

      <div className="grid gap-3 lg:grid-cols-12 lg:gap-4">
        {/* Cost stack — editable % layers */}
        {/* <Panel className="relative overflow-hidden border-border/60 bg-card/95 p-4 shadow-sm lg:col-span-5 lg:row-span-1">
          <div
            className="pointer-events-none absolute -right-16 -top-16 size-48 rounded-full bg-primary/10 blur-3xl"
            aria-hidden
          />
          <div className="relative">
            <h3 className="flex items-center gap-2 text-sm font-semibold">
              <RiPriceTag3Line className="size-4 text-primary" aria-hidden />
              Loaded cost (before freight)
            </h3>
            <p className="mt-1 text-[11px] leading-snug text-muted-foreground">
              Duty, marketing, overhead, and payment compound on factory COGS. Then each channel adds freight
              and margin.
            </p>
            <div className="mt-4 grid grid-cols-2 gap-3">
              <RateMini
                label="Input duty %"
                value={payload.inputDutyPct}
                onChange={(n) => setNum("inputDutyPct", n)}
              />
              <RateMini
                label="Marketing %"
                value={payload.marketingPct}
                onChange={(n) => setNum("marketingPct", n)}
              />
              <RateMini
                label="Company overhead %"
                value={payload.companyOverheadPct}
                onChange={(n) => setNum("companyOverheadPct", n)}
              />
              <RateMini
                label="Payment / bank %"
                value={payload.paymentHandlingPct}
                onChange={(n) => setNum("paymentHandlingPct", n)}
              />
            </div>
            <div className="mt-4 space-y-1.5 rounded-xl border border-border/60 bg-muted/20 p-3">
              {stackSteps.map((s, i) => (
                <div
                  key={i}
                  className="flex items-center justify-between gap-2 text-xs sm:text-sm"
                >
                  <span className="text-muted-foreground">
                    {s.label}
                    {s.pct ? (
                      <span className="ml-1 font-mono text-[10px] text-muted-foreground/80">
                        (+{s.pct})
                      </span>
                    ) : null}
                  </span>
                  <span className="font-mono tabular-nums font-medium">{toMoney(s.value)}</span>
                </div>
              ))}
              <div className="flex items-center justify-between border-t border-border/50 pt-2 text-sm font-semibold">
                <span>Loaded cost</span>
                <span className="font-mono tabular-nums text-primary">{toMoney(d.loadedCost)}</span>
              </div>
            </div>
          </div>
        </Panel> */}


        {/* Margin bands + Channel rules — side by side on same row */}
        <Panel className="border-border/60 bg-muted/15 p-4 shadow-sm lg:col-span-5">
          <div className="flex items-center gap-2 text-sm font-semibold">
            <RiLineChartLine className="size-4 text-primary" aria-hidden />
            Margin bands
          </div>
          <p className="mt-1 text-[11px] text-muted-foreground">Reference shelf on region effective cost.</p>
          <div className="mt-3 grid gap-3 sm:grid-cols-2">
            <RateMini
              label="Low margin %"
              value={payload.marginBandLowPct}
              onChange={(n) => setNum("marginBandLowPct", n)}
            />
            <RateMini
              label="High margin %"
              value={payload.marginBandHighPct}
              onChange={(n) => setNum("marginBandHighPct", n)}
            />
            <div className="rounded-xl border border-border bg-card p-3 shadow-sm">
              <p className="text-[10px] font-medium text-muted-foreground">Thin shelf</p>
              <p className="mt-0.5 text-xl font-bold tabular-nums">{toMoney(d.marginBandLowShelf)}</p>
            </div>
            <div className="rounded-xl border border-border bg-card p-3 shadow-sm">
              <p className="text-[10px] font-medium text-muted-foreground">Healthy shelf</p>
              <p className="mt-0.5 text-xl font-bold tabular-nums">{toMoney(d.marginBandHighShelf)}</p>
            </div>
          </div>
        </Panel>


        {/* Channel + margin model */}
        <Panel className="border-border/60 bg-card/95 p-4 shadow-sm lg:col-span-7">
          <h3 className="mb-3 flex items-center gap-2 text-sm font-semibold">
            <RiEqualizerLine className="size-4 text-primary" aria-hidden />
            Channel rules &amp; margin
          </h3>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            <RateMini
              label="Margin multiplier"
              value={payload.marginMultiplier}
              step={0.01}
              onChange={(n) => setNum("marginMultiplier", n)}
            />
            <RateMini label="UAE VAT %" value={payload.uaeVatPct} onChange={(n) => setNum("uaeVatPct", n)} />
            <RateMini
              label="Region freight %"
              value={payload.regionFreightPct}
              onChange={(n) => setNum("regionFreightPct", n)}
            />
            <RateMini
              label="Saudi VAT %"
              value={payload.SaudiVatPct}
              onChange={(n) => setNum("SaudiVatPct", n)}
            />
            <RateMini
              label="Saudi freight %"
              value={payload.SaudiFreightPct}
              onChange={(n) => setNum("SaudiFreightPct", n)}
            />
          </div>
        </Panel>

        {/* ─── DETAILED RSP BREAKDOWN ─── */}


        {/* Notes */}
        <Panel className="border-border/60 p-4 shadow-sm sm:p-5 lg:col-span-12">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h3 className="text-sm font-semibold">Notes &amp; assumptions</h3>
            <div className="flex gap-2">
              <Button type="button" variant="ghost" size="sm" onClick={resetFactors}>
                Reset defaults
              </Button>
              <Button type="button" variant="outline" size="sm" className="gap-1" onClick={addFactor}>
                <RiAddLine className="size-4" aria-hidden />
                Add
              </Button>
            </div>
          </div>
          <div className="mt-4 space-y-3">
            {payload.factors.map((f) => (
              <div
                key={f.id}
                className="rounded-xl border border-border/80 bg-muted/10 p-3 transition-colors hover:bg-muted/20"
              >
                <div className="flex gap-2">
                  <Input
                    value={f.label}
                    onChange={(e) => updateFactor(f.id, { label: e.target.value })}
                    className="h-9 max-w-xs font-medium"
                    placeholder="Factor name"
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="shrink-0 text-muted-foreground hover:text-destructive"
                    onClick={() => removeFactor(f.id)}
                    aria-label="Remove factor"
                  >
                    <RiDeleteBinLine className="size-4" />
                  </Button>
                </div>
                <textarea
                  value={f.detail}
                  onChange={(e) => updateFactor(f.id, { detail: e.target.value })}
                  rows={2}
                  className="mt-2 w-full resize-y rounded-lg border border-input bg-background px-3 py-2 text-sm outline-none focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/50"
                  placeholder="Why this matters…"
                />
              </div>
            ))}
          </div>
        </Panel>
      </div>

      <RspQuoteSheetDialog
        open={quoteOpen}
        onOpenChange={setQuoteOpen}
        payload={payload}
        lines={quoteLines}
        retailers={retailers}
      />
    </div>
  )
}


function RateMini({
  label,
  value,
  onChange,
  step = 0.1,
}: {
  label: string
  value: number
  onChange: (n: number) => void
  step?: number
}) {
  return (
    <div className="space-y-1">
      <span className="text-[11px] font-medium text-muted-foreground">{label}</span>
      <Input
        type="number"
        step={step}
        value={Number.isFinite(value) ? value : 0}
        onChange={(e) => onChange(Number(e.target.value))}
        className="h-9 bg-background/90 font-mono text-sm"
      />
    </div>
  )
}

type StepKind = "base" | "add" | "multiply" | "checkpoint" | "final"

const KIND_STYLES: Record<StepKind, { dot: string; rowBg: string; labelCls: string; valueCls: string; prefix?: string }> = {
  base: {
    dot: "bg-muted-foreground/40 ring-background",
    rowBg: "",
    labelCls: "text-muted-foreground",
    valueCls: "text-foreground/70",
  },
  add: {
    dot: "bg-muted-foreground/35 ring-background",
    rowBg: "",
    labelCls: "text-muted-foreground",
    valueCls: "text-foreground/70",
  },
  multiply: {
    dot: "bg-amber-500/80 ring-background",
    rowBg: "bg-amber-500/[0.04]",
    labelCls: "text-amber-700 dark:text-amber-300 font-medium",
    valueCls: "text-amber-800 dark:text-amber-200 font-semibold",
  },
  checkpoint: {
    dot: "bg-primary/80 ring-background",
    rowBg: "bg-primary/[0.05] ring-1 ring-primary/10",
    labelCls: "text-foreground font-semibold",
    valueCls: "text-primary font-bold",
  },
  final: {
    dot: "bg-emerald-500 ring-background shadow-[0_0_6px_2px_rgba(34,197,94,0.3)]",
    rowBg: "bg-emerald-500/[0.06] ring-1 ring-emerald-500/20",
    labelCls: "text-emerald-800 dark:text-emerald-200 font-semibold",
    valueCls: "text-emerald-700 dark:text-emerald-300 font-bold",
  },
}

function EnhancedBreakdownColumn({
  title,
  icon,
  accent,
  steps,
  finalLabel,
  finalValue,
}: {
  title: string
  icon: ReactNode
  accent: "sky" | "emerald" | "violet"
  steps: { k: string; v: string; kind: StepKind }[]
  finalLabel: string
  finalValue: number
}) {
  const headerBg =
    accent === "sky"
      ? "bg-sky-500/[0.07] border-sky-500/20"
      : accent === "emerald"
        ? "bg-emerald-500/[0.07] border-emerald-500/20"
        : "bg-violet-500/[0.07] border-violet-500/20"

  const accentText =
    accent === "sky"
      ? "text-sky-700 dark:text-sky-300"
      : accent === "emerald"
        ? "text-emerald-700 dark:text-emerald-300"
        : "text-violet-700 dark:text-violet-300"

  const accentBg =
    accent === "sky"
      ? "bg-sky-500/15 ring-sky-500/20"
      : accent === "emerald"
        ? "bg-emerald-500/15 ring-emerald-500/20"
        : "bg-violet-500/15 ring-violet-500/20"

  const accentDot =
    accent === "sky"
      ? "bg-sky-500"
      : accent === "emerald"
        ? "bg-emerald-500"
        : "bg-violet-500"

  const accentBar =
    accent === "sky"
      ? "bg-sky-500"
      : accent === "emerald"
        ? "bg-emerald-500"
        : "bg-violet-500"

  const accentFinalText =
    accent === "sky"
      ? "text-sky-800 dark:text-sky-100"
      : accent === "emerald"
        ? "text-emerald-800 dark:text-emerald-100"
        : "text-violet-800 dark:text-violet-100"

  const accentFinalBg =
    accent === "sky"
      ? "bg-sky-500/10 border-sky-500/20"
      : accent === "emerald"
        ? "bg-emerald-500/10 border-emerald-500/20"
        : "bg-violet-500/10 border-violet-500/20"

  return (
    <div className="flex flex-col">
      {/* Column header */}
      <div className={cn("flex items-center gap-2.5 border-b px-4 py-3.5", headerBg)}>
        <span className={cn("flex size-8 shrink-0 items-center justify-center rounded-lg ring-1", accentBg, accentText)}>
          {icon}
        </span>
        <div>
          <p className="text-[11px] font-bold uppercase tracking-wider text-foreground/80">{title}</p>
          <p className="text-[10px] text-muted-foreground">Step-by-step to shelf RSP</p>
        </div>
      </div>

      {/* Steps */}
      <div className="relative flex-1 px-4 py-4">
        {/* Vertical rail */}
        <div
          className="absolute bottom-[4.5rem] left-[1.65rem] top-6 w-px bg-border/50"
          aria-hidden
        />

        <ul className="space-y-2">
          {steps.map((s, i) => {
            const style = KIND_STYLES[s.kind]
            const isLast = i === steps.length - 1
            return (
              <li key={i} className="relative flex items-start gap-3">
                {/* Dot */}
                <span
                  className={cn(
                    "relative z-[1] mt-[3px] size-[10px] shrink-0 rounded-full ring-2",
                    s.kind === "final" ? accentDot : style.dot
                  )}
                  aria-hidden
                />
                <div
                  className={cn(
                    "flex min-w-0 flex-1 items-baseline justify-between gap-2 rounded-lg px-2.5 py-1.5 text-sm transition-colors",
                    style.rowBg
                  )}
                >
                  <span className={cn("leading-snug", style.labelCls)}>{s.k}</span>
                  <span className={cn("shrink-0 font-mono text-xs tabular-nums", style.valueCls, "sm:text-sm")}>
                    {s.v}
                  </span>
                </div>
              </li>
            )
          })}
        </ul>

        {/* Final RSP callout */}
        <div className={cn("mt-4 rounded-xl border p-3 shadow-sm", accentFinalBg)}>
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <span className={cn("flex size-5 items-center justify-center rounded-full", accentBg)}>
                <RiCheckLine className={cn("size-3", accentText)} aria-hidden />
              </span>
              <p className={cn("text-[11px] font-semibold uppercase tracking-wide", accentText)}>{finalLabel}</p>
            </div>
            <p className={cn("text-xl font-extrabold tabular-nums tracking-tight", accentFinalText)}>
              {toMoney(finalValue)}
            </p>
          </div>
          {/* Mini bar */}
          <div className="mt-2.5 h-1 overflow-hidden rounded-full bg-black/10 dark:bg-white/10">
            <div className={cn("h-full rounded-full", accentBar)} style={{ width: "100%" }} />
          </div>
        </div>
      </div>
    </div>
  )
}
