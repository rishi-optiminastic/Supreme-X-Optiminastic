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

const steps = [
  {
    n: 1,
    title: "Demand check",
    body: "Review trend and demand score for a SKU before you commit to a supplier.",
    href: "/prediction",
  },
  {
    n: 2,
    title: "Shelf price (RSP)",
    body: "Use the built-in calculator, then approve the price you will use for buying and selling.",
    href: "/pricing",
  },
  {
    n: 3,
    title: "Purchase form",
    body: "Pick a preset, then Save for Odoo PO on Restock to store lines for the step below.",
    href: "/smart-orders",
  },
  {
    n: 4,
    title: "Odoo purchase order",
    body: "Creates a real draft PO in Odoo (vendor id from .env or the box below).",
    href: null,
    anchor: "odoo-po",
  },
  {
    n: 5,
    title: "Sell (sales order)",
    body: "Add customer lines below, create a draft quotation in Odoo, then confirm stock.",
    href: null,
    anchor: "odoo-so",
  },
  {
    n: 6,
    title: "Stock confirmation",
    body: "Same lines: check sellable quantity vs what you want to ship and copy a short report.",
    href: null,
    anchor: "stock-check",
  },
] as const

type OdooStatus = {
  configured?: boolean
  defaultPoPartnerId?: number | null
  defaultSoPartnerId?: number | null
}

export function WorkflowWorkspace() {
  const { variants, source, odooLoading, refetchOdoo } = useVariantsWithOdoo()
  const { approvals, revokeRsp } = useWorkflowState()

  const [odooStatus, setOdooStatus] = React.useState<OdooStatus | null>(null)
  const [poDraft, setPoDraft] = React.useState<PoDraft | null>(null)
  const [poPartnerId, setPoPartnerId] = React.useState("")
  const [soPartnerId, setSoPartnerId] = React.useState("")
  const [poResult, setPoResult] = React.useState<string | null>(null)
  const [soResult, setSoResult] = React.useState<string | null>(null)
  const [poLoading, setPoLoading] = React.useState(false)
  const [soLoading, setSoLoading] = React.useState(false)

  const [lineSku, setLineSku] = React.useState("")
  const [lineQty, setLineQty] = React.useState(1)
  const [soLines, setSoLines] = React.useState<SalesOrderLine[]>([])
  const [report, setReport] = React.useState("")
  const [copied, setCopied] = React.useState(false)

  const reloadDraft = React.useCallback(() => {
    setPoDraft(loadPoDraft())
  }, [])

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

  const removeLine = (sku: string) => {
    setSoLines((prev) => prev.filter((l) => l.sku !== sku))
  }

  const linesToOdooProducts = (lines: SalesOrderLine[]) => {
    const out: { productId: number; quantity: number }[] = []
    const missing: string[] = []
    for (const l of lines) {
      const v = variants.find((x) => x.sku === l.sku)
      const pid = v?.odooProductId
      if (pid == null) {
        missing.push(l.sku)
        continue
      }
      out.push({ productId: pid, quantity: l.qty })
    }
    return { out, missing }
  }

  const createPoInOdoo = async () => {
    setPoResult(null)
    if (!poDraft?.lines.length) {
      setPoResult("No saved draft — go to Restock and tap Save for Odoo PO.")
      return
    }
    const partner = Number.parseInt(poPartnerId.trim(), 10)
    if (!Number.isFinite(partner) || partner <= 0) {
      setPoResult("Enter a vendor partner id (Contacts in Odoo → Internal ID), or set ODOO_PO_PARTNER_ID in .env.")
      return
    }
    const lines = poDraft.lines
      .filter((l) => l.odooProductId != null && l.qty > 0)
      .map((l) => ({ productId: l.odooProductId!, quantity: l.qty }))
    const skipped = poDraft.lines.filter((l) => l.odooProductId == null)
    if (lines.length === 0) {
      setPoResult(
        "No lines with Odoo product ids. Connect Odoo and save the draft again from Restock."
      )
      return
    }
    setPoLoading(true)
    try {
      const r = await fetch("/api/odoo/purchase-order", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ partnerId: partner, lines }),
      })
      const j = (await r.json()) as { ok?: boolean; message?: string; purchaseOrderId?: number }
      if (j.ok && j.purchaseOrderId != null) {
        const extra =
          skipped.length > 0
            ? ` (${skipped.length} SKU(s) skipped — no Odoo product id)`
            : ""
        setPoResult(`${j.message ?? "Created."}${extra}`)
      } else {
        setPoResult(j.message ?? "Could not create PO.")
      }
    } catch (e) {
      setPoResult(e instanceof Error ? e.message : "Request failed")
    } finally {
      setPoLoading(false)
    }
  }

  const createSoInOdoo = async () => {
    setSoResult(null)
    const partner = Number.parseInt(soPartnerId.trim(), 10)
    if (!Number.isFinite(partner) || partner <= 0) {
      setSoResult("Enter a customer partner id, or set ODOO_SO_PARTNER_ID in .env.")
      return
    }
    const { out, missing } = linesToOdooProducts(soLines)
    if (out.length === 0) {
      setSoResult(
        missing.length
          ? `Add lines and ensure SKUs exist in Odoo: missing id for ${missing.join(", ")}.`
          : "Add at least one line with quantity."
      )
      return
    }
    setSoLoading(true)
    try {
      const r = await fetch("/api/odoo/sale-order", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ partnerId: partner, lines: out }),
      })
      const j = (await r.json()) as { ok?: boolean; message?: string; saleOrderId?: number }
      if (j.ok && j.saleOrderId != null) {
        const extra =
          missing.length > 0 ? ` (${missing.length} line(s) skipped — no Odoo product id)` : ""
        setSoResult(`${j.message ?? "Created."}${extra}`)
      } else {
        setSoResult(j.message ?? "Could not create sales order.")
      }
    } catch (e) {
      setSoResult(e instanceof Error ? e.message : "Request failed")
    } finally {
      setSoLoading(false)
    }
  }

  const buildReport = () => {
    const results = evaluateStockForLines(variants, soLines)
    const text = formatStockConfirmationReport({
      title: "Stock confirmation (sellable vs sales lines)",
      sourceLabel: source === "odoo" ? "Odoo products" : "Demo catalog",
      lines: soLines,
      results,
    })
    setReport(text)
  }

  const copyReport = async () => {
    if (!report) return
    try {
      await navigator.clipboard.writeText(report)
      setCopied(true)
      window.setTimeout(() => setCopied(false), 2000)
    } catch {
      setCopied(false)
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Workflow</h1>
        <p className="mt-1 max-w-2xl text-sm leading-relaxed text-muted-foreground">
          Demand and price in this app; purchase and sales documents in Odoo. Use Restock to
          save buy lines, then create a draft PO here. Add sell lines and open a draft quotation
          in Odoo, then run the stock check on the same lines.
        </p>
      </div>

      <Panel className="flex flex-wrap items-center gap-3 p-4">
        <Button type="button" variant="outline" size="sm" onClick={() => refetchOdoo()}>
          Refresh catalog
        </Button>
        <Button type="button" variant="outline" size="sm" onClick={() => reloadDraft()}>
          Reload PO draft
        </Button>
        <span className="text-sm text-muted-foreground">
          {source === "odoo" ? "Odoo" : "Demo"} · {odooLoading ? "loading…" : `${variants.length} SKUs`}
        </span>
        <span className="text-sm text-muted-foreground">
          · {approvals.length} approved price{approvals.length === 1 ? "" : "s"} (this browser)
        </span>
        {odooStatus?.configured === false ? (
          <span className="text-xs text-amber-700 dark:text-amber-400">
            Odoo not configured — PO/SO buttons need .env.
          </span>
        ) : null}
      </Panel>

      <div className="grid gap-3 md:grid-cols-2">
        {steps.map((s) => (
          <Panel key={s.n} className="p-4" id={"anchor" in s && s.anchor ? s.anchor : undefined}>
            <div className="flex gap-3">
              <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-primary/15 text-xs font-bold text-primary">
                {s.n}
              </span>
              <div className="min-w-0 space-y-1">
                <h2 className="text-sm font-semibold">{s.title}</h2>
                <p className="text-xs leading-relaxed text-muted-foreground">{s.body}</p>
                {s.href ? (
                  <Link
                    href={s.href}
                    className="inline-block text-xs font-medium text-primary hover:underline"
                  >
                    Open →
                  </Link>
                ) : null}
              </div>
            </div>
          </Panel>
        ))}
      </div>

      <Panel className="space-y-3 p-4">
        <h2 className="text-sm font-semibold">Approved shelf prices</h2>
        <p className="text-xs text-muted-foreground">
          Approve on the Price screen. Restock can use the &quot;After RSP — follow-up buy&quot;
          preset once a price is agreed.
        </p>
        {approvals.length === 0 ? (
          <p className="text-sm text-muted-foreground">None yet — open Price and tap Approve.</p>
        ) : (
          <ul className="space-y-2">
            {approvals
              .slice()
              .sort((a, b) => b.approvedAtIso.localeCompare(a.approvedAtIso))
              .map((a) => (
                <li
                  key={a.sku}
                  className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-border/60 bg-muted/20 px-3 py-2 text-sm"
                >
                  <div className="min-w-0">
                    <span className="font-mono text-xs">{a.sku}</span>
                    <span className="mx-2 text-muted-foreground">·</span>
                    <span className="truncate">{a.productName}</span>
                    <div className="text-xs text-muted-foreground">
                      ₹{a.rspInr.toLocaleString("en-IN")} ·{" "}
                      {new Date(a.approvedAtIso).toLocaleString()}
                    </div>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <Button type="button" variant="outline" size="sm" asChild>
                      <Link href="/smart-orders">Restock</Link>
                    </Button>
                    <Button type="button" variant="ghost" size="sm" onClick={() => revokeRsp(a.sku)}>
                      Clear
                    </Button>
                  </div>
                </li>
              ))}
          </ul>
        )}
      </Panel>

      <Panel className="space-y-4 p-4" id="odoo-po">
        <h2 className="text-sm font-semibold">Create purchase order in Odoo</h2>
        <p className="text-xs leading-relaxed text-muted-foreground">
          On <Link href="/smart-orders" className="text-primary underline-offset-2 hover:underline">Restock</Link>
          , tap <strong>Save for Odoo PO</strong>. Lines with an Odoo product id are sent to{" "}
          <code className="rounded bg-muted px-1">purchase.order</code> as a draft. Set{" "}
          <code className="rounded bg-muted px-1">ODOO_PO_PARTNER_ID</code> in{" "}
          <code className="rounded bg-muted px-1">.env</code> (vendor&apos;s numeric id) or type it
          below.
        </p>
        {poDraft?.templateLabel ? (
          <p className="text-xs text-muted-foreground">Preset when saved: {poDraft.templateLabel}</p>
        ) : null}
        {poDraft?.lines?.length ? (
          <ul className="max-h-40 overflow-auto rounded-lg border border-border/60 text-sm">
            {poDraft.lines.map((l) => (
              <li key={l.sku} className="border-b border-border/40 px-3 py-2 last:border-0">
                <span className="font-mono text-xs">{l.sku}</span> × {l.qty}
                {l.odooProductId == null ? (
                  <span className="ml-2 text-xs text-amber-700 dark:text-amber-400">
                    (no Odoo id — demo or missing sync)
                  </span>
                ) : (
                  <span className="ml-2 text-xs text-muted-foreground">id {l.odooProductId}</span>
                )}
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-sm text-muted-foreground">No draft yet — save from Restock first.</p>
        )}
        <div className="flex flex-wrap items-end gap-3">
          <div className="space-y-1">
            <label className="text-xs text-muted-foreground" htmlFor="wf-po-partner">
              Vendor partner id
            </label>
            <Input
              id="wf-po-partner"
              className="h-9 w-36"
              placeholder="e.g. 12"
              value={poPartnerId}
              onChange={(e) => setPoPartnerId(e.target.value)}
            />
          </div>
          <Button type="button" size="sm" disabled={poLoading} onClick={() => void createPoInOdoo()}>
            {poLoading ? "Creating…" : "Create draft PO"}
          </Button>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => {
              clearPoDraft()
              reloadDraft()
              setPoResult("Draft cleared.")
            }}
          >
            Clear draft
          </Button>
        </div>
        {poResult ? (
          <p className="text-sm text-muted-foreground" role="status">
            {poResult}
          </p>
        ) : null}
      </Panel>

      <Panel className="space-y-4 p-4" id="odoo-so">
        <h2 className="text-sm font-semibold">Customer lines → sales order in Odoo</h2>
        <p className="text-xs leading-relaxed text-muted-foreground">
          Add SKUs and quantities (same list you use for the stock report). Creates a draft in{" "}
          <code className="rounded bg-muted px-1">sale.order</code>. Set{" "}
          <code className="rounded bg-muted px-1">ODOO_SO_PARTNER_ID</code> or enter a customer id.
        </p>
        <div className="flex flex-wrap items-end gap-2">
          <div className="space-y-1">
            <label className="text-xs text-muted-foreground" htmlFor="wf-sku">
              SKU
            </label>
            <select
              id="wf-sku"
              className={cn(
                "h-9 min-w-[200px] rounded-lg border border-input bg-background px-2 text-sm",
                "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              )}
              value={lineSku}
              onChange={(e) => setLineSku(e.target.value)}
            >
              {variants.map((v) => (
                <option key={v.id} value={v.sku}>
                  {v.sku}
                </option>
              ))}
            </select>
          </div>
          <div className="space-y-1">
            <label className="text-xs text-muted-foreground" htmlFor="wf-qty">
              Qty
            </label>
            <Input
              id="wf-qty"
              type="number"
              min={1}
              className="h-9 w-24"
              value={lineQty}
              onChange={(e) => setLineQty(Number(e.target.value) || 1)}
            />
          </div>
          <Button type="button" size="sm" onClick={addLine}>
            Add line
          </Button>
        </div>
        {soLines.length > 0 ? (
          <ul className="divide-y divide-border/50 rounded-lg border border-border/60 text-sm">
            {soLines.map((l) => (
              <li key={l.sku} className="flex items-center justify-between gap-2 px-3 py-2">
                <span>
                  <span className="font-mono text-xs">{l.sku}</span> × {l.qty}
                </span>
                <Button type="button" variant="ghost" size="sm" onClick={() => removeLine(l.sku)}>
                  Remove
                </Button>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-sm text-muted-foreground">No lines yet.</p>
        )}
        <div className="flex flex-wrap items-end gap-3">
          <div className="space-y-1">
            <label className="text-xs text-muted-foreground" htmlFor="wf-so-partner">
              Customer partner id
            </label>
            <Input
              id="wf-so-partner"
              className="h-9 w-36"
              placeholder="e.g. 8"
              value={soPartnerId}
              onChange={(e) => setSoPartnerId(e.target.value)}
            />
          </div>
          <Button type="button" size="sm" disabled={soLoading} onClick={() => void createSoInOdoo()}>
            {soLoading ? "Creating…" : "Create draft SO"}
          </Button>
        </div>
        {soResult ? (
          <p className="text-sm text-muted-foreground" role="status">
            {soResult}
          </p>
        ) : null}
      </Panel>

      <Panel className="space-y-4 p-4" id="stock-check">
        <h2 className="text-sm font-semibold">Stock confirmation report</h2>
        <p className="text-xs leading-relaxed text-muted-foreground">
          Uses the same lines as above. Sellable = on hand minus reserved. Copy the text for your
          team or file.
        </p>
        <div className="flex flex-wrap gap-2">
          <Button type="button" variant="secondary" size="sm" onClick={buildReport}>
            Build report
          </Button>
          <Button type="button" size="sm" onClick={() => void copyReport()} disabled={!report}>
            {copied ? "Copied" : "Copy report"}
          </Button>
        </div>
        {report ? (
          <pre className="max-h-64 overflow-auto rounded-lg border border-border/60 bg-muted/30 p-3 text-xs whitespace-pre-wrap">
            {report}
          </pre>
        ) : null}
      </Panel>

      <Panel className="space-y-2 p-4">
        <h2 className="text-sm font-semibold">Later upgrades</h2>
        <p className="text-xs text-muted-foreground">
          Multi-company rules, approval roles, PDF export, and picking a vendor from a searchable
          list instead of typing ids.
        </p>
      </Panel>
    </div>
  )
}
