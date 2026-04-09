"use client"

import * as React from "react"
import Link from "next/link"

import { Panel } from "@/components/panel"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { useVariantsWithOdoo } from "@/hooks/use-variants-with-odoo"
import { useWorkflowState } from "@/hooks/use-workflow-state"
import { clearPoDraft, loadPoDraft, type PoDraft } from "@/lib/po-draft-storage"
import {
  evaluateStockForLines,
  formatStockConfirmationReport,
  type SalesOrderLine,
} from "@/lib/stock-confirmation"
import { cn } from "@/lib/utils"

/* ─── Pipeline steps ─── */

const PIPELINE = [
  {
    step: 1,
    title: "Trends",
    desc: "Spot demand strength, weeks of cover, and market context—then decide what to buy.",
    href: "/prediction",
    status: "navigate",
    icon: "🔮",
  },
  {
    step: 2,
    title: "RSP",
    desc: "Enter base cost → review shelf scenarios and margins. Approve a price when ready.",
    href: "/pricing",
    status: "navigate",
    icon: "💰",
  },
  {
    step: 3,
    title: "Order creation",
    desc: "Per-retailer templates, line items, mail or download filled Excel/PDF. Save a draft for Odoo when needed.",
    href: "/purchase",
    status: "navigate",
    icon: "📋",
  },
  {
    step: 4,
    title: "Purchase Order → Odoo",
    desc: "Send the saved order/PO draft lines to Odoo. Creates a real purchase order in your ERP.",
    href: null,
    anchor: "odoo-po",
    status: "action",
    icon: "🛒",
  },
  {
    step: 5,
    title: "Sales Order → Odoo",
    desc: "Convert purchase lines to sales. Add customer and create a quotation in Odoo.",
    href: null,
    anchor: "odoo-so",
    status: "action",
    icon: "📤",
  },
  {
    step: 6,
    title: "Stock Confirmation",
    desc: "Check if you have enough stock to fulfill the sales order. Generate a report.",
    href: null,
    anchor: "stock-check",
    status: "action",
    icon: "✅",
  },
] as const

/* ─── Helpers ─── */

async function postJson<T>(url: string, body: unknown): Promise<T> {
  const r = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  })
  return (await r.json()) as T
}

type OdooStatus = { configured?: boolean; defaultPoPartnerId?: number | null; defaultSoPartnerId?: number | null }

/* ─── Component ─── */

export function WorkflowWorkspace() {
  const { variants, source, odooLoading, refetchOdoo } = useVariantsWithOdoo()
  const { approvals, revokeRsp } = useWorkflowState()

  // Odoo connection
  const [odooStatus, setOdooStatus] = React.useState<OdooStatus | null>(null)

  // PO draft (loaded from localStorage)
  const [poDraft, setPoDraft] = React.useState<PoDraft | null>(null)
  const [poPartnerId, setPoPartnerId] = React.useState("")
  const [poResult, setPoResult] = React.useState<string | null>(null)
  const [poLoading, setPoLoading] = React.useState(false)

  // SO builder
  const [soPartnerId, setSoPartnerId] = React.useState("")
  const [soResult, setSoResult] = React.useState<string | null>(null)
  const [soLoading, setSoLoading] = React.useState(false)
  const [lineSku, setLineSku] = React.useState("")
  const [lineQty, setLineQty] = React.useState(1)
  const [soLines, setSoLines] = React.useState<SalesOrderLine[]>([])

  // Stock report
  const [report, setReport] = React.useState("")
  const [copied, setCopied] = React.useState(false)

  // Convert PO → SO
  const [convertedToSo, setConvertedToSo] = React.useState(false)

  const reloadDraft = React.useCallback(() => setPoDraft(loadPoDraft()), [])

  // Load Odoo status + PO draft on mount
  React.useEffect(() => {
    reloadDraft()
    void fetch("/api/odoo/status", { cache: "no-store" })
      .then((r) => r.json())
      .then((j: OdooStatus) => {
        setOdooStatus(j)
        if (j.defaultPoPartnerId) setPoPartnerId(String(j.defaultPoPartnerId))
        if (j.defaultSoPartnerId) setSoPartnerId(String(j.defaultSoPartnerId))
      })
      .catch(() => setOdooStatus({ configured: false }))
  }, [reloadDraft])

  React.useEffect(() => {
    if (variants.length && !lineSku) setLineSku(variants[0].sku)
  }, [variants, lineSku])

  /* ── SO line helpers ── */
  const addLine = () => {
    const qty = Math.max(1, Math.floor(lineQty) || 1)
    if (!lineSku.trim()) return
    setSoLines((prev) => {
      const i = prev.findIndex((l) => l.sku === lineSku)
      if (i >= 0) {
        const next = [...prev]
        next[i] = { sku: lineSku, qty: next[i]!.qty + qty }
        return next
      }
      return [...prev, { sku: lineSku, qty }]
    })
  }

  const removeLine = (sku: string) => setSoLines((prev) => prev.filter((l) => l.sku !== sku))

  /* ── Convert PO draft lines → SO lines ── */
  const convertPoToSo = () => {
    if (!poDraft?.lines.length) return
    const newLines: SalesOrderLine[] = poDraft.lines
      .filter((l) => l.qty > 0)
      .map((l) => ({ sku: l.sku, qty: l.qty }))
    setSoLines(newLines)
    setConvertedToSo(true)
    setTimeout(() => setConvertedToSo(false), 4000)
  }

  /* ── Resolve SKU → Odoo product id ── */
  const resolveOdooLines = (lines: SalesOrderLine[]) => {
    const resolved: { productId: number; quantity: number }[] = []
    const missing: string[] = []
    for (const l of lines) {
      const pid = variants.find((x) => x.sku === l.sku)?.odooProductId
      if (pid == null) { missing.push(l.sku); continue }
      resolved.push({ productId: pid, quantity: l.qty })
    }
    return { resolved, missing }
  }

  /* ── Create PO ── */
  const createPo = async () => {
    setPoResult(null)
    if (!poDraft?.lines.length) { setPoResult("No draft saved — go to Order creation first."); return }
    const partner = Number.parseInt(poPartnerId.trim(), 10)
    if (!Number.isFinite(partner) || partner <= 0) { setPoResult("Enter a vendor partner id."); return }
    const lines = poDraft.lines.filter((l) => l.odooProductId != null && l.qty > 0).map((l) => ({ productId: l.odooProductId!, quantity: l.qty }))
    if (!lines.length) { setPoResult("No lines have Odoo product ids."); return }
    setPoLoading(true)
    try {
      const j = await postJson<{ ok?: boolean; message?: string }>("/api/odoo/purchase-order", { partnerId: partner, lines })
      setPoResult(j.ok ? (j.message ?? "✓ PO created in Odoo.") : (j.message ?? "Failed."))
    } catch (e) { setPoResult(e instanceof Error ? e.message : "Request failed") }
    finally { setPoLoading(false) }
  }

  /* ── Create SO ── */
  const createSo = async () => {
    setSoResult(null)
    const partner = Number.parseInt(soPartnerId.trim(), 10)
    if (!Number.isFinite(partner) || partner <= 0) { setSoResult("Enter a customer partner id."); return }
    const { resolved, missing } = resolveOdooLines(soLines)
    if (!resolved.length) { setSoResult(missing.length ? `Missing Odoo ids for: ${missing.join(", ")}` : "Add at least one line."); return }
    setSoLoading(true)
    try {
      const j = await postJson<{ ok?: boolean; message?: string }>("/api/odoo/sale-order", { partnerId: partner, lines: resolved })
      setSoResult(j.ok ? (j.message ?? "✓ SO created in Odoo.") : (j.message ?? "Failed."))
    } catch (e) { setSoResult(e instanceof Error ? e.message : "Request failed") }
    finally { setSoLoading(false) }
  }

  /* ── Stock report ── */
  const stockResults = React.useMemo(() => {
    if (!soLines.length) return null
    return evaluateStockForLines(variants, soLines)
  }, [variants, soLines])

  const buildReport = () => {
    if (!stockResults) return
    setReport(formatStockConfirmationReport({
      title: "Stock Confirmation Report",
      sourceLabel: source === "odoo" ? "Odoo Live" : "Demo Data",
      lines: soLines,
      results: stockResults,
    }))
  }

  const copyReport = async () => {
    if (!report) return
    try { await navigator.clipboard.writeText(report); setCopied(true); setTimeout(() => setCopied(false), 2000) }
    catch { setCopied(false) }
  }

  /* ── Pipeline progress ── */
  const hasApprovals = approvals.length > 0
  const hasDraft = (poDraft?.lines?.length ?? 0) > 0
  const hasSoLines = soLines.length > 0

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Workflow</h1>
        <p className="mt-1 max-w-2xl text-sm leading-relaxed text-muted-foreground">
          The full buying cycle: spot a trend → generate RSP → retailer order creation → Odoo PO/SO → confirm stock. Follow the pipeline below.
        </p>
      </div>

      {/* Status bar */}
      <Panel className="flex flex-wrap items-center gap-3 p-4">
        <Button type="button" variant="outline" size="sm" onClick={() => refetchOdoo()}>Refresh</Button>
        <Button type="button" variant="outline" size="sm" onClick={reloadDraft}>Reload draft</Button>
        <span className="text-sm text-muted-foreground">
          {source === "odoo" ? "🟢 Odoo connected" : "🟡 Demo mode"} · {odooLoading ? "loading…" : `${variants.length} products`}
        </span>
        {odooStatus?.configured === false && (
          <span className="rounded-md bg-amber-500/10 px-2 py-1 text-xs text-amber-700 dark:text-amber-400">Set ODOO_URL in .env to connect</span>
        )}
      </Panel>

      {/* ─── PIPELINE CARDS ─── */}
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {PIPELINE.map((p) => {
          const done = (p.step === 1) ||
            (p.step === 2 && hasApprovals) ||
            (p.step === 3 && hasDraft) ||
            (p.step === 4 && poResult?.includes("✓")) ||
            (p.step === 5 && soResult?.includes("✓")) ||
            (p.step === 6 && report.length > 0)

          return (
            <Panel
              key={p.step}
              id={"anchor" in p && p.anchor ? p.anchor : undefined}
              className={cn(
                "relative p-4 transition-all",
                done && "border-emerald-500/30 bg-emerald-500/5",
              )}
            >
              <div className="flex items-start gap-3">
                <div className={cn(
                  "flex size-9 shrink-0 items-center justify-center rounded-xl text-lg",
                  done ? "bg-emerald-500/20" : "bg-muted",
                )}>
                  {done ? "✓" : p.icon}
                </div>
                <div className="min-w-0 space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] font-bold uppercase text-muted-foreground">Step {p.step}</span>
                    {done && <span className="rounded-full bg-emerald-500/20 px-1.5 py-0.5 text-[10px] font-medium text-emerald-700 dark:text-emerald-300">Done</span>}
                  </div>
                  <h2 className="text-sm font-semibold">{p.title}</h2>
                  <p className="text-xs leading-relaxed text-muted-foreground">{p.desc}</p>
                  {p.href && (
                    <Link href={p.href} className="inline-block text-xs font-medium text-primary hover:underline">Open →</Link>
                  )}
                </div>
              </div>
            </Panel>
          )
        })}
      </div>

      {/* ─── APPROVED RSPs ─── */}
      <Panel className="space-y-3 p-4">
        <div className="flex items-center gap-2">
          <h2 className="text-sm font-semibold">Approved RSPs</h2>
          <span className="rounded-full bg-primary/15 px-2 py-0.5 text-xs font-medium text-primary">{approvals.length}</span>
        </div>
        {approvals.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            No prices approved yet. Go to <Link href="/pricing" className="text-primary hover:underline">RSP</Link> → Approve a price.
          </p>
        ) : (
          <ul className="space-y-2">
            {approvals.sort((a, b) => b.approvedAtIso.localeCompare(a.approvedAtIso)).map((a) => (
              <li key={a.sku} className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-emerald-500/20 bg-emerald-500/5 px-3 py-2 text-sm">
                <div className="min-w-0">
                  <span className="font-mono text-xs">{a.sku}</span>
                  <span className="mx-2 text-muted-foreground">·</span>
                  <span className="truncate">{a.productName}</span>
                  <div className="text-xs text-muted-foreground">
                    RSP ₹{a.rspInr.toLocaleString("en-IN")}
                    {a.landedCost ? ` · Cost ₹${a.landedCost}` : ""}
                    {a.competitorPrice ? ` · Competitor ₹${a.competitorPrice}` : ""}
                    {" · "}{new Date(a.approvedAtIso).toLocaleDateString()}
                  </div>
                </div>
                <div className="flex flex-wrap gap-2">
                  <Button type="button" variant="outline" size="sm" asChild>
                    <Link href="/purchase">Order creation</Link>
                  </Button>
                  <Button type="button" variant="ghost" size="sm" onClick={() => revokeRsp(a.sku)}>Revoke</Button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </Panel>

      {/* ─── STEP 4: CREATE PO IN ODOO ─── */}
      <Panel className="space-y-4 p-4" id="odoo-po">
        <div className="flex items-center gap-2">
          <span className="flex size-7 items-center justify-center rounded-lg bg-primary/15 text-xs font-bold text-primary">4</span>
          <h2 className="text-sm font-semibold">Send Purchase Order to Odoo</h2>
        </div>
        <p className="text-xs text-muted-foreground">
          Lines saved from <Link href="/purchase" className="text-primary hover:underline">Order creation</Link> appear here.
          Enter your vendor&apos;s partner id and send to Odoo.
        </p>
        {poDraft?.lines?.length ? (
          <ul className="max-h-40 overflow-auto rounded-lg border border-border/60 text-sm">
            {poDraft.lines.map((l) => (
              <li key={l.sku} className="flex items-center justify-between border-b border-border/40 px-3 py-2 last:border-0">
                <span>
                  <span className="font-mono text-xs">{l.sku}</span> × {l.qty}
                </span>
                {l.odooProductId == null ? (
                  <span className="text-xs text-amber-700 dark:text-amber-400">no Odoo id</span>
                ) : (
                  <span className="text-xs text-muted-foreground">#{l.odooProductId}</span>
                )}
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-sm text-muted-foreground">No draft — save lines from Order creation first.</p>
        )}
        <div className="flex flex-wrap items-end gap-3">
          <div className="space-y-1">
            <label className="text-xs text-muted-foreground" htmlFor="wf-po-partner">Vendor partner id</label>
            <Input id="wf-po-partner" className="h-9 w-36" placeholder="e.g. 12" value={poPartnerId} onChange={(e) => setPoPartnerId(e.target.value)} />
          </div>
          <Button type="button" size="sm" disabled={poLoading} onClick={() => void createPo()}>
            {poLoading ? "Creating…" : "Send PO to Odoo"}
          </Button>
          <Button type="button" variant="outline" size="sm" onClick={() => { clearPoDraft(); reloadDraft(); setPoResult("Draft cleared.") }}>Clear draft</Button>
        </div>
        {poResult && (
          <p className={cn("text-sm", poResult.includes("✓") ? "text-emerald-700 dark:text-emerald-400" : "text-muted-foreground")} role="status">{poResult}</p>
        )}
      </Panel>

      {/* ─── STEP 5: PO → SO CONVERSION + SO CREATION ─── */}
      <Panel className="space-y-4 p-4" id="odoo-so">
        <div className="flex items-center gap-2">
          <span className="flex size-7 items-center justify-center rounded-lg bg-primary/15 text-xs font-bold text-primary">5</span>
          <h2 className="text-sm font-semibold">Create Sales Order in Odoo</h2>
        </div>
        <p className="text-xs text-muted-foreground">
          Convert PO lines to SO with one click, or add lines manually. Enter the customer partner id and send.
        </p>

        {/* Convert PO → SO button */}
        {poDraft?.lines?.length ? (
          <div className="flex flex-wrap items-center gap-3 rounded-md border border-violet-500/25 bg-violet-500/5 px-3 py-2">
            <div className="text-sm">
              <span className="font-medium">PO → SO conversion:</span>
              <span className="ml-2 text-muted-foreground">{poDraft.lines.length} lines from saved PO draft</span>
            </div>
            <Button type="button" variant="secondary" size="sm" onClick={convertPoToSo}>
              Convert PO to SO lines
            </Button>
            {convertedToSo && <span className="text-xs text-emerald-700 dark:text-emerald-400">✓ Lines copied</span>}
          </div>
        ) : null}

        {/* Manual line builder */}
        <div className="flex flex-wrap items-end gap-2">
          <div className="space-y-1">
            <label className="text-xs text-muted-foreground" htmlFor="wf-sku">SKU</label>
            <select
              id="wf-sku"
              className={cn("h-9 min-w-[200px] rounded-lg border border-input bg-background px-2 text-sm", "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring")}
              value={lineSku} onChange={(e) => setLineSku(e.target.value)}
            >
              {variants.map((v) => <option key={v.id} value={v.sku}>{v.sku} — {v.productName}</option>)}
            </select>
          </div>
          <div className="space-y-1">
            <label className="text-xs text-muted-foreground" htmlFor="wf-qty">Qty</label>
            <Input id="wf-qty" type="number" min={1} className="h-9 w-24" value={lineQty} onChange={(e) => setLineQty(Number(e.target.value) || 1)} />
          </div>
          <Button type="button" size="sm" onClick={addLine}>Add line</Button>
        </div>

        {soLines.length > 0 ? (
          <ul className="divide-y divide-border/50 rounded-lg border border-border/60 text-sm">
            {soLines.map((l) => (
              <li key={l.sku} className="flex items-center justify-between gap-2 px-3 py-2">
                <span><span className="font-mono text-xs">{l.sku}</span> × {l.qty}</span>
                <Button type="button" variant="ghost" size="sm" onClick={() => removeLine(l.sku)}>Remove</Button>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-sm text-muted-foreground">No lines yet. Convert from PO or add manually.</p>
        )}

        <div className="flex flex-wrap items-end gap-3">
          <div className="space-y-1">
            <label className="text-xs text-muted-foreground" htmlFor="wf-so-partner">Customer partner id</label>
            <Input id="wf-so-partner" className="h-9 w-36" placeholder="e.g. 8" value={soPartnerId} onChange={(e) => setSoPartnerId(e.target.value)} />
          </div>
          <Button type="button" size="sm" disabled={soLoading} onClick={() => void createSo()}>
            {soLoading ? "Creating…" : "Send SO to Odoo"}
          </Button>
        </div>
        {soResult && (
          <p className={cn("text-sm", soResult.includes("✓") ? "text-emerald-700 dark:text-emerald-400" : "text-muted-foreground")} role="status">{soResult}</p>
        )}
      </Panel>

      {/* ─── STEP 6: STOCK CONFIRMATION ─── */}
      <Panel className="space-y-4 p-4" id="stock-check">
        <div className="flex items-center gap-2">
          <span className="flex size-7 items-center justify-center rounded-lg bg-primary/15 text-xs font-bold text-primary">6</span>
          <h2 className="text-sm font-semibold">Stock Confirmation Report</h2>
        </div>
        <p className="text-xs text-muted-foreground">
          Checks the SO lines above against current stock. Shows per-line availability with status badges.
        </p>

        {/* Visual stock check per line */}
        {stockResults && stockResults.length > 0 && (
          <div className="space-y-2 rounded-lg border border-border/60 p-3">
            <div className="grid gap-2">
              {stockResults.map((r) => (
                <div key={r.sku} className={cn(
                  "flex flex-wrap items-center justify-between gap-2 rounded-md border px-3 py-2 text-sm",
                  r.ok ? "border-emerald-500/30 bg-emerald-500/5" : "border-rose-500/30 bg-rose-500/5",
                )}>
                  <div className="min-w-0">
                    <span className="font-mono text-xs">{r.sku}</span>
                    <span className="mx-2 text-muted-foreground">·</span>
                    <span className="truncate">{r.productName}</span>
                  </div>
                  <div className="flex items-center gap-3 text-xs">
                    <span className="text-muted-foreground">Need {r.requested}</span>
                    <span className="text-muted-foreground">Available {r.available}</span>
                    <span className={cn(
                      "rounded-full px-2 py-0.5 font-medium",
                      r.ok ? "bg-emerald-500/20 text-emerald-800 dark:text-emerald-200" : "bg-rose-500/20 text-rose-800 dark:text-rose-200",
                    )}>
                      {r.ok ? "🟢 In stock" : `🔴 Short by ${r.requested - r.available}`}
                    </span>
                  </div>
                </div>
              ))}
            </div>
            <p className="text-xs text-muted-foreground">
              {stockResults.every((r) => r.ok) ? "✓ All lines can be fulfilled." : "⚠ Some lines are short — consider restocking."}
            </p>
          </div>
        )}

        <div className="flex flex-wrap gap-2">
          <Button type="button" variant="secondary" size="sm" onClick={buildReport} disabled={!soLines.length}>Generate report</Button>
          <Button type="button" size="sm" onClick={() => void copyReport()} disabled={!report}>{copied ? "Copied" : "Copy report"}</Button>
        </div>
        {report && <pre className="max-h-64 overflow-auto rounded-lg border border-border/60 bg-muted/30 p-3 text-xs whitespace-pre-wrap">{report}</pre>}
      </Panel>
    </div>
  )
}
