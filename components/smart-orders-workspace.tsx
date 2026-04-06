"use client"

import * as React from "react"
import Link from "next/link"
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  XAxis,
  YAxis,
} from "recharts"

import { Panel } from "@/components/panel"
import { Button } from "@/components/ui/button"
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from "@/components/ui/chart"
import { Input } from "@/components/ui/input"
import { useVariantsWithOdoo } from "@/hooks/use-variants-with-odoo"
import { useWorkflowState } from "@/hooks/use-workflow-state"
import {
  applyTemplateToOrderQty,
  orderTimingAdvice,
  suggestedReorderQty,
} from "@/lib/intelligence"
import { savePoDraft } from "@/lib/po-draft-storage"
import type { PoDraftLine } from "@/lib/po-draft-storage"
import { reorderBreakdown, reorderRows } from "@/lib/planning-math"
import { cn } from "@/lib/utils"

const TEMPLATES = [
  {
    id: "Standard — refill",
    hint: "Only your target, lead, and safety weeks — no extra rules.",
  },
  {
    id: "After RSP — follow-up buy",
    hint: "Use after shelf price is approved: +5% on the buy quantity when you already plan to order.",
  },
  {
    id: "New supplier — trial line",
    hint: "First buy from a new supplier: caps near 1.5 weeks of sales (min 6 units).",
  },
  {
    id: "Spot — tight cover",
    hint: "If weeks of cover are under 2, adds 8% on the buy quantity.",
  },
  {
    id: "Promo — busy season",
    hint: "Adds 6% or 12% when trend is strong, if there is already a buy quantity.",
  },
  {
    id: "Slow SKU — smaller orders",
    hint: "Keeps orders small on slow lines (about 2.5 weeks of sales, minimum 8 units).",
  },
] as const

const chartConfig = {
  qty: { label: "Units", color: "var(--primary)" },
} satisfies ChartConfig

type FilterTab = "all" | "buy" | "wait" | "lines"

export function SmartOrdersWorkspace() {
  const { variants, source, odooLoading, odooError, refetchOdoo } =
    useVariantsWithOdoo()
  const { approvals } = useWorkflowState()
  const [targetWeeks, setTargetWeeks] = React.useState(4)
  const [leadWeeks, setLeadWeeks] = React.useState(2)
  const [safetyWeeks, setSafetyWeeks] = React.useState(1)
  const [template, setTemplate] = React.useState<string>(TEMPLATES[0].id)
  const [copied, setCopied] = React.useState(false)
  const [copiedCsv, setCopiedCsv] = React.useState(false)
  const [draftHint, setDraftHint] = React.useState<string | null>(null)
  const [filter, setFilter] = React.useState<FilterTab>("all")
  const [query, setQuery] = React.useState("")

  const rows = React.useMemo(
    () => reorderRows(variants, leadWeeks, safetyWeeks, targetWeeks),
    [variants, leadWeeks, safetyWeeks, targetWeeks]
  )

  const enriched = React.useMemo(() => {
    return rows.map((r) => {
      const v = variants.find((x) => x.sku === r.sku)
      const baseQty = v
        ? suggestedReorderQty(v, leadWeeks, safetyWeeks, targetWeeks)
        : r.suggestQty
      const { finalQty, adjustmentNote } = v
        ? applyTemplateToOrderQty(baseQty, template, v)
        : { finalQty: baseQty, adjustmentNote: null as string | null }
      const timing = v ? orderTimingAdvice(v, finalQty, leadWeeks) : null
      const breakdown = v
        ? reorderBreakdown(v, leadWeeks, safetyWeeks, targetWeeks)
        : null
      return {
        ...r,
        baseQty,
        finalQty,
        adjustmentNote,
        timing,
        breakdown,
      }
    })
  }, [rows, variants, leadWeeks, safetyWeeks, targetWeeks, template])

  const kpis = React.useMemo(() => {
    let totalUnits = 0
    let orderNow = 0
    let delay = 0
    let hold = 0
    let positiveLines = 0
    let urgent = 0
    for (const e of enriched) {
      totalUnits += e.finalQty
      if (e.finalQty > 0) positiveLines++
      if (e.urgency === "high") urgent++
      if (e.timing?.action === "order_now") orderNow++
      if (e.timing?.action === "delay") delay++
      if (e.timing?.action === "hold") hold++
    }
    return {
      totalUnits,
      orderNow,
      delay,
      hold,
      positiveLines,
      urgent,
      skuCount: enriched.length,
    }
  }, [enriched])

  const filtered = React.useMemo(() => {
    const q = query.trim().toLowerCase()
    return enriched.filter((e) => {
      if (q) {
        const hit =
          e.sku.toLowerCase().includes(q) ||
          e.productName.toLowerCase().includes(q)
        if (!hit) return false
      }
      if (filter === "all") return true
      if (filter === "lines") return e.finalQty > 0
      if (filter === "buy")
        return e.timing?.action === "order_now" || e.finalQty > 0
      if (filter === "wait")
        return e.timing?.action === "delay" || e.timing?.action === "hold"
      return true
    })
  }, [enriched, filter, query])

  const chartData = React.useMemo(() => {
    return [...enriched]
      .filter((e) => e.finalQty > 0)
      .sort((a, b) => b.finalQty - a.finalQty)
      .slice(0, 10)
      .map((e) => ({
        sku: e.sku.length > 10 ? `${e.sku.slice(0, 9)}…` : e.sku,
        qty: e.finalQty,
        fullSku: e.sku,
      }))
  }, [enriched])

  const summary = React.useMemo(() => {
    const head = `Purchase draft\nPreset: ${template}\nSource: ${source}\nTarget+Lead+Safety wk: ${targetWeeks}+${leadWeeks}+${safetyWeeks}\n\n`
    const body = enriched
      .filter((e) => e.finalQty > 0)
      .map(
        (e) =>
          `${e.sku}\t${e.productName}\t${e.finalQty}\t${e.timing?.action ?? ""}\t${e.adjustmentNote ?? ""}`
      )
      .join("\n")
    return head + (body || "(No lines with positive final qty)")
  }, [template, source, targetWeeks, leadWeeks, safetyWeeks, enriched])

  const csv = React.useMemo(() => {
    const h =
      "sku,product,base_qty,final_qty,cover_wk,weekly_demand,on_hand,inbound,timing,delay_days,note,preset_note\n"
    const lines = enriched
      .map(
        (e) =>
          [
            e.sku,
            `"${e.productName.replace(/"/g, '""')}"`,
            e.baseQty,
            e.finalQty,
            e.weeksCover,
            e.weeklyDemand,
            e.onHand,
            e.inbound,
            e.timing?.action ?? "",
            e.timing?.delayDays ?? "",
            `"${(e.timing?.reason ?? "").replace(/"/g, '""')}"`,
            `"${(e.adjustmentNote ?? "").replace(/"/g, '""')}"`,
          ].join(",")
      )
      .join("\n")
    return h + lines
  }, [enriched])

  const copyText = async (text: string, which: "draft" | "csv") => {
    try {
      await navigator.clipboard.writeText(text)
      if (which === "draft") {
        setCopied(true)
        window.setTimeout(() => setCopied(false), 2000)
      } else {
        setCopiedCsv(true)
        window.setTimeout(() => setCopiedCsv(false), 2000)
      }
    } catch {
      /* ignore */
    }
  }

  const templateMeta = TEMPLATES.find((t) => t.id === template)

  const saveDraftForOdoo = () => {
    const lines: PoDraftLine[] = []
    for (const e of enriched) {
      if (e.finalQty <= 0) continue
      const v = variants.find((x) => x.sku === e.sku)
      lines.push({
        sku: e.sku,
        productName: e.productName,
        odooProductId: v?.odooProductId ?? null,
        qty: e.finalQty,
      })
    }
    if (lines.length === 0) {
      setDraftHint("No lines with a buy quantity — raise target weeks or pick another preset.")
      window.setTimeout(() => setDraftHint(null), 4000)
      return
    }
    savePoDraft(lines, template)
    const missing = lines.filter((l) => l.odooProductId == null).length
    setDraftHint(
      missing
        ? `Saved ${lines.length} lines (${missing} without Odoo product id — connect Odoo for those). Open Workflow to create the PO.`
        : `Saved ${lines.length} lines. Open Workflow to create the PO in Odoo.`
    )
    window.setTimeout(() => setDraftHint(null), 6000)
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Restock</h1>
        <p className="mt-1 max-w-2xl text-sm leading-relaxed text-muted-foreground">
          We estimate units per week from your stock and cover, then how many to buy to hit your
          target weeks. Presets can bump or cap the number; timing tells you if you can wait.
        </p>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Panel className="p-4">
          <p className="text-xs text-muted-foreground">Total units to buy</p>
          <p className="text-2xl font-semibold tabular-nums">{kpis.totalUnits}</p>
        </Panel>
        <Panel className="p-4">
          <p className="text-xs text-muted-foreground">SKUs with a buy quantity</p>
          <p className="text-2xl font-semibold tabular-nums">
            {kpis.positiveLines}
            <span className="text-sm font-normal text-muted-foreground">
              {" "}
              / {kpis.skuCount}
            </span>
          </p>
        </Panel>
        <Panel className="p-4">
          <p className="text-xs text-muted-foreground">When to order</p>
          <p className="text-sm font-medium">
            <span className="text-emerald-600 dark:text-emerald-400">{kpis.orderNow} now</span>
            {" · "}
            <span className="text-amber-600 dark:text-amber-400">{kpis.delay} delay</span>
            {" · "}
            <span className="text-muted-foreground">{kpis.hold} hold</span>
          </p>
        </Panel>
        <Panel className="p-4">
          <p className="text-xs text-muted-foreground">Thin stock (urgent)</p>
          <p className="text-2xl font-semibold tabular-nums text-rose-600 dark:text-rose-400">
            {kpis.urgent}
          </p>
        </Panel>
      </div>

      {approvals.length > 0 ? (
        <Panel className="border-primary/20 bg-primary/5 p-4">
          <p className="text-sm text-muted-foreground">
            {approvals.length} shelf price{approvals.length === 1 ? "" : "s"} approved in this
            browser. For buys tied to that approval, choose the{" "}
            <span className="font-medium text-foreground">After RSP — follow-up buy</span> preset
            below.{" "}
            <Link href="/workflow" className="font-medium text-primary underline-offset-2 hover:underline">
              Workflow
            </Link>
          </p>
        </Panel>
      ) : null}

      <Panel className="space-y-4 p-4">
        <div className="flex flex-wrap items-end gap-4">
          <div className="space-y-1">
            <label className="text-xs text-muted-foreground">Preset</label>
            <select
              className={cn(
                "h-9 min-w-[220px] rounded-md border border-input bg-background px-3 text-sm"
              )}
              value={template}
              onChange={(e) => setTemplate(e.target.value)}
            >
              {TEMPLATES.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.id}
                </option>
              ))}
            </select>
            {templateMeta ? (
              <p className="max-w-md text-[11px] text-muted-foreground">{templateMeta.hint}</p>
            ) : null}
          </div>
          <div className="space-y-1">
            <label className="text-xs text-muted-foreground" htmlFor="so-target">
              Target wk
            </label>
            <Input
              id="so-target"
              type="number"
              className="h-9 w-20"
              min={1}
              value={targetWeeks}
              onChange={(e) => setTargetWeeks(Number(e.target.value) || 4)}
            />
          </div>
          <div className="space-y-1">
            <label className="text-xs text-muted-foreground" htmlFor="so-lead">
              Lead wk
            </label>
            <Input
              id="so-lead"
              type="number"
              className="h-9 w-20"
              min={0}
              value={leadWeeks}
              onChange={(e) => setLeadWeeks(Number(e.target.value) || 0)}
            />
          </div>
          <div className="space-y-1">
            <label className="text-xs text-muted-foreground" htmlFor="so-safe">
              Safety wk
            </label>
            <Input
              id="so-safe"
              type="number"
              className="h-9 w-20"
              min={0}
              value={safetyWeeks}
              onChange={(e) => setSafetyWeeks(Number(e.target.value) || 0)}
            />
          </div>
          <div className="flex flex-wrap gap-2">
            <Button type="button" variant="outline" size="sm" onClick={() => refetchOdoo()}>
              Refresh
            </Button>
            <Button type="button" variant="secondary" size="sm" onClick={() => copyText(summary, "draft")}>
              {copied ? "Copied" : "Copy draft"}
            </Button>
            <Button type="button" size="sm" onClick={() => copyText(csv, "csv")}>
              {copiedCsv ? "Copied" : "Copy CSV"}
            </Button>
            <Button type="button" variant="secondary" size="sm" onClick={saveDraftForOdoo}>
              Save for Odoo PO
            </Button>
            <Button type="button" variant="ghost" size="sm" asChild>
              <Link href="/workflow">Workflow</Link>
            </Button>
          </div>
          {odooLoading ? (
            <span className="text-xs text-muted-foreground">Loading…</span>
          ) : null}
          {odooError ? (
            <span className="text-xs text-destructive">{odooError}</span>
          ) : null}
          {draftHint ? (
            <p className="w-full text-xs text-muted-foreground">{draftHint}</p>
          ) : null}
        </div>

        <div className="flex flex-col gap-3 border-t border-border/50 pt-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex flex-wrap gap-2">
            {(
              [
                ["all", "All"],
                ["lines", "Has quantity"],
                ["buy", "Order soon"],
                ["wait", "Wait / skip"],
              ] as const
            ).map(([key, label]) => (
              <button
                key={key}
                type="button"
                onClick={() => setFilter(key)}
                className={cn(
                  "rounded-full px-3 py-1 text-xs font-medium transition-colors",
                  filter === key
                    ? "bg-primary text-primary-foreground"
                    : "bg-muted text-muted-foreground hover:bg-muted/80"
                )}
              >
                {label}
              </button>
            ))}
          </div>
          <Input
            placeholder="Search SKU or product…"
            className="h-9 max-w-xs"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </div>

        <p className="text-xs leading-relaxed text-muted-foreground">
          Units per week ≈ on hand ÷ weeks of cover. Target stock ≈ that × (
          {targetWeeks}+{leadWeeks}+{safetyWeeks}) ={" "}
          <span className="font-mono font-medium text-foreground">
            {targetWeeks + leadWeeks + safetyWeeks}
          </span>{" "}
          weeks. Buy quantity rounds up what you are short, then the preset may change it.
        </p>
      </Panel>

      <div className="grid gap-4 lg:grid-cols-5">
        <Panel className="overflow-hidden p-0 lg:col-span-2">
          <div className="border-b border-border/60 px-4 py-3">
            <h2 className="text-sm font-semibold">Largest buys</h2>
            <p className="mt-1 text-xs text-muted-foreground">Up to 10 SKUs with a buy quantity</p>
          </div>
          <div className="p-3">
            {chartData.length === 0 ? (
              <p className="text-sm text-muted-foreground">Nothing to chart.</p>
            ) : (
              <ChartContainer
                config={chartConfig}
                className="aspect-auto h-[220px] w-full"
                initialDimension={{ width: 360, height: 220 }}
              >
                <BarChart
                  data={chartData}
                  layout="vertical"
                  margin={{ left: 4, right: 12, top: 8, bottom: 4 }}
                >
                  <CartesianGrid strokeDasharray="3 3" className="stroke-border/60" horizontal={false} />
                  <XAxis type="number" tickLine={false} axisLine={false} />
                  <YAxis
                    type="category"
                    dataKey="sku"
                    width={88}
                    tickLine={false}
                    axisLine={false}
                    tick={{ fontSize: 10 }}
                  />
                  <ChartTooltip content={<ChartTooltipContent />} />
                  <Bar dataKey="qty" radius={[0, 4, 4, 0]} maxBarSize={22}>
                    {chartData.map((_, i) => (
                      <Cell
                        key={i}
                        fill={i === 0 ? "var(--primary)" : "var(--chart-2)"}
                      />
                    ))}
                  </Bar>
                </BarChart>
              </ChartContainer>
            )}
          </div>
        </Panel>

        <Panel className="overflow-x-auto p-0 lg:col-span-3">
          <table className="w-full min-w-[880px] text-sm">
            <thead>
              <tr className="border-b border-border/60 bg-muted/40 text-left text-xs font-semibold uppercase text-muted-foreground">
                <th className="px-3 py-2.5">SKU</th>
                <th className="px-3 py-2.5">Product</th>
                <th className="px-3 py-2.5 text-right">Cover</th>
                <th className="px-3 py-2.5 text-right">~u/wk</th>
                <th className="px-3 py-2.5 text-right">Qty</th>
                <th className="px-3 py-2.5">Timing</th>
                <th className="px-3 py-2.5">Note</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/50">
              {filtered.map((e) => {
                const title = e.breakdown
                  ? `Target ~${e.breakdown.targetUnits} u (${e.breakdown.demandWeeks} wk demand) − ${e.breakdown.available} on hand+inbound → base ${e.baseQty}`
                  : undefined
                return (
                  <tr
                    key={e.id}
                    className={cn(
                      "hover:bg-muted/20",
                      e.urgency === "high" && "bg-rose-500/6"
                    )}
                  >
                    <td className="px-3 py-2 font-mono text-xs">{e.sku}</td>
                    <td className="max-w-[160px] truncate px-3 py-2">{e.productName}</td>
                    <td className="px-3 py-2 text-right tabular-nums">{e.weeksCover}</td>
                    <td className="px-3 py-2 text-right tabular-nums text-muted-foreground">
                      {e.weeklyDemand}
                    </td>
                    <td
                      className="px-3 py-2 text-right font-medium tabular-nums"
                      title={title}
                    >
                      {e.baseQty !== e.finalQty ? (
                        <span className="text-muted-foreground">{e.baseQty}</span>
                      ) : null}
                      {e.baseQty !== e.finalQty ? (
                        <span className="mx-1 text-muted-foreground">→</span>
                      ) : null}
                      <span
                        className={cn(
                          e.finalQty > 0 && "text-foreground",
                          e.finalQty === 0 && "text-muted-foreground"
                        )}
                      >
                        {e.finalQty}
                      </span>
                      {e.adjustmentNote ? (
                        <span className="mt-0.5 block text-[10px] font-normal text-primary">
                          {e.adjustmentNote}
                        </span>
                      ) : null}
                    </td>
                    <td className="px-3 py-2">
                      <span
                        className={cn(
                          "inline-flex rounded-full px-2 py-0.5 text-xs font-medium",
                          e.timing?.action === "order_now" &&
                            "bg-emerald-500/15 text-emerald-800 dark:text-emerald-300",
                          e.timing?.action === "delay" &&
                            "bg-amber-500/15 text-amber-900 dark:text-amber-200",
                          e.timing?.action === "hold" && "bg-muted text-muted-foreground"
                        )}
                      >
                        {e.timing?.action === "order_now"
                          ? "Order now"
                          : e.timing?.action === "delay"
                            ? `Delay ~${e.timing.delayDays}d`
                            : "Hold"}
                      </span>
                    </td>
                    <td className="px-3 py-2 text-xs text-muted-foreground">
                      {e.timing?.reason ?? "—"}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
          {filtered.length === 0 ? (
            <p className="px-4 py-6 text-center text-sm text-muted-foreground">
              No rows match filter or search.
            </p>
          ) : null}
        </Panel>
      </div>
    </div>
  )
}
