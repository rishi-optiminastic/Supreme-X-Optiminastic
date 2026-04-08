"use client"

import * as React from "react"
import Link from "next/link"
import {
  RiDownloadLine,
  RiInformationLine,
  RiMailLine,
  RiPrinterLine,
  RiShoppingCart2Line,
  RiStore2Line,
  RiUploadCloud2Line,
} from "@remixicon/react"

import { Panel } from "@/components/panel"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { useVariantsWithOdoo } from "@/hooks/use-variants-with-odoo"
import {
  fillUploadedOrderTemplate,
  triggerBlobDownload,
  type OrderTemplateFillInput,
} from "@/lib/fill-order-template"
import { savePoDraft, type PoDraftLine } from "@/lib/po-draft-storage"
import { buildRetailerOrderFormHtml } from "@/lib/po-template-print"
import type { PoPrintLine, PoPrintTotals } from "@/lib/po-template-print"
import {
  fileToStoredTemplate,
  loadRetailerTemplatesState,
  newRetailerId,
  persistRetailerTemplatesState,
  storedTemplateToBlob,
  validateTemplateFile,
  type RetailerOrderProfile,
} from "@/lib/retailer-order-templates"
import { evaluateStockForLines, type SalesOrderLine } from "@/lib/stock-confirmation"
import { cn } from "@/lib/utils"

type OrderLine = {
  sku: string
  productName: string
  odooProductId: number | null
  qty: number
  unitPrice: number
  discountPct: number
  vatPct: number
}

const DEFAULT_META = {
  currency: "AED",
  payment: "90 days from document date",
  deliverTo: "As per retailer agreement",
}

async function postJson<T>(url: string, body: unknown): Promise<T> {
  const r = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  })
  return (await r.json()) as T
}

const round2 = (n: number) => Math.round(n * 100) / 100

function FieldLabel({ children, htmlFor }: { children: React.ReactNode; htmlFor?: string }) {
  return (
    <label
      htmlFor={htmlFor}
      className="mb-1 block text-[11px] font-medium uppercase tracking-wide text-muted-foreground"
    >
      {children}
    </label>
  )
}

function SectionTitle({ children }: { children: React.ReactNode }) {
  return <h2 className="text-sm font-semibold tracking-tight text-foreground">{children}</h2>
}

function buildOrderHtml(
  retailerName: string,
  orderRef: string,
  orderDate: string,
  deliveryDate: string,
  retailerCode: string,
  deliverTo: string,
  paymentTerms: string,
  currency: string,
  notes: string,
  lines: OrderLine[],
  totals: PoPrintTotals
): string {
  const printLines: PoPrintLine[] = lines.map((l, idx) => ({
    itemNo: (idx + 1) * 10,
    description: l.productName,
    sku: l.sku,
    qty: l.qty,
    unitPrice: l.unitPrice,
    discountPct: l.discountPct,
    vatPct: l.vatPct,
    lineValue: round2(l.qty * l.unitPrice * (1 - l.discountPct / 100)),
  }))
  return buildRetailerOrderFormHtml(
    {
      orderRef,
      orderDateIso: orderDate,
      deliveryDateIso: deliveryDate,
      retailerName,
      retailerCode,
      currency,
      deliverTo,
      paymentTerms,
      notes,
    },
    printLines,
    totals
  )
}

const Purchase = () => {
  const { variants, source, odooLoading, odooError, refetchOdoo } = useVariantsWithOdoo()

  const [retailers, setRetailers] = React.useState<RetailerOrderProfile[]>([])
  const [selectedRetailerId, setSelectedRetailerId] = React.useState<string | null>(null)
  const [templateHint, setTemplateHint] = React.useState<string | null>(null)
  const fileInputRef = React.useRef<HTMLInputElement>(null)
  const newRetailerInputRef = React.useRef<HTMLInputElement>(null)

  React.useLayoutEffect(() => {
    const s = loadRetailerTemplatesState()
    setRetailers(s.retailers)
    setSelectedRetailerId(s.selectedRetailerId)
  }, [])

  const persistRetailers = React.useCallback((nextRetailers: RetailerOrderProfile[], selId: string | null) => {
    const ok = persistRetailerTemplatesState({
      retailers: nextRetailers,
      selectedRetailerId: selId,
    })
    if (!ok) return false
    setRetailers(nextRetailers)
    setSelectedRetailerId(selId)
    return true
  }, [])

  const selectedRetailer = retailers.find((r) => r.id === selectedRetailerId) ?? null

  const [orderRef, setOrderRef] = React.useState(`ORD-${new Date().getFullYear()}-${String(Date.now()).slice(-6)}`)
  const [orderDate, setOrderDate] = React.useState(new Date().toISOString().slice(0, 10))
  const [deliveryDate, setDeliveryDate] = React.useState(
    new Date(Date.now() + 7 * 86400000).toISOString().slice(0, 10)
  )
  const [retailerCode, setRetailerCode] = React.useState("")
  const [deliverTo, setDeliverTo] = React.useState(DEFAULT_META.deliverTo)
  const [paymentTerms, setPaymentTerms] = React.useState(DEFAULT_META.payment)
  const [currency, setCurrency] = React.useState(DEFAULT_META.currency)
  const [notes, setNotes] = React.useState("")

  const [sku, setSku] = React.useState("")
  const [qty, setQty] = React.useState(1)
  const [unitPrice, setUnitPrice] = React.useState(10)
  const [discountPct, setDiscountPct] = React.useState(0)
  const [vatPct, setVatPct] = React.useState(5)

  const [lines, setLines] = React.useState<OrderLine[]>([])
  const [draftHint, setDraftHint] = React.useState<string | null>(null)
  const [outputBusy, setOutputBusy] = React.useState(false)

  React.useEffect(() => {
    if (!sku && variants.length) {
      setSku(variants[0].sku)
    }
  }, [sku, variants])

  const addRetailer = React.useCallback(() => {
    const name = (newRetailerInputRef.current?.value ?? "").trim()
    if (!name) {
      setTemplateHint("Enter a retailer name.")
      setTimeout(() => setTemplateHint(null), 4000)
      return
    }
    let id: string
    try {
      id = newRetailerId()
    } catch {
      id = `r-${Date.now()}-${Math.random().toString(36).slice(2, 11)}`
    }
    let storedList: RetailerOrderProfile[]
    try {
      const s = loadRetailerTemplatesState()
      storedList = Array.isArray(s.retailers) ? s.retailers : []
    } catch {
      setTemplateHint("Could not read browser storage. Allow storage for this site or disable private mode.")
      setTimeout(() => setTemplateHint(null), 8000)
      return
    }
    const profile: RetailerOrderProfile = {
      id,
      name,
      createdAtIso: new Date().toISOString(),
      template: null,
    }
    const byId = new Map<string, RetailerOrderProfile>()
    for (const r of storedList) {
      if (r && typeof r.id === "string") byId.set(r.id, r)
    }
    for (const r of retailers) {
      if (r && typeof r.id === "string") byId.set(r.id, r)
    }
    const next = [...Array.from(byId.values()), profile]
    const ok = persistRetailers(next, id)
    if (!ok) {
      setTemplateHint("Could not save to browser storage (quota full or private mode).")
      setTimeout(() => setTemplateHint(null), 8000)
      return
    }
    if (newRetailerInputRef.current) newRetailerInputRef.current.value = ""
    setTemplateHint(`Added retailer “${name}”. Upload their order template when ready.`)
    setTimeout(() => setTemplateHint(null), 5000)
  }, [retailers, persistRetailers])

  const removeRetailer = (id: string) => {
    const base = retailers.length > 0 ? retailers : loadRetailerTemplatesState().retailers
    const next = base.filter((r) => r.id !== id)
    const sel = selectedRetailerId === id ? (next[0]?.id ?? null) : selectedRetailerId
    const ok = persistRetailers(next, sel)
    if (!ok) {
      setTemplateHint("Could not save to browser storage (quota full or private mode).")
      setTimeout(() => setTemplateHint(null), 8000)
    }
  }

  const onTemplateFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    e.target.value = ""
    if (!file || !selectedRetailerId) return
    const err = validateTemplateFile(file)
    if (err) {
      setTemplateHint(err)
      setTimeout(() => setTemplateHint(null), 8000)
      return
    }
    try {
      const template = await fileToStoredTemplate(file)
      const base = retailers.length > 0 ? retailers : loadRetailerTemplatesState().retailers
      const next = base.map((r) => (r.id === selectedRetailerId ? { ...r, template } : r))
      const ok = persistRetailers(next, selectedRetailerId)
      if (!ok) {
        setTemplateHint("Could not save to browser storage (quota full or private mode).")
        setTimeout(() => setTemplateHint(null), 8000)
        return
      }
      setTemplateHint(`Saved template “${file.name}” for this retailer.`)
      setTimeout(() => setTemplateHint(null), 4000)
    } catch {
      setTemplateHint("Could not read that file.")
      setTimeout(() => setTemplateHint(null), 5000)
    }
  }

  const downloadStoredTemplate = () => {
    const t = selectedRetailer?.template
    if (!t) return
    const blob = storedTemplateToBlob(t)
    const url = URL.createObjectURL(blob)
    const a = document.createElement("a")
    a.href = url
    a.download = t.fileName
    a.click()
    URL.revokeObjectURL(url)
  }

  const addLine = () => {
    const v = variants.find((x) => x.sku === sku)
    if (!v) return
    const next: OrderLine = {
      sku: v.sku,
      productName: v.productName,
      odooProductId: v.odooProductId ?? null,
      qty: Math.max(1, Math.floor(qty) || 1),
      unitPrice: Math.max(0, round2(unitPrice)),
      discountPct: Math.max(0, round2(discountPct)),
      vatPct: Math.max(0, round2(vatPct)),
    }
    setLines((prev) => [...prev, next])
  }

  const removeLine = (idx: number) => setLines((prev) => prev.filter((_, i) => i !== idx))

  const totals = React.useMemo(() => {
    let qtyTotal = 0
    let gross = 0
    let discounted = 0
    let vat = 0
    for (const l of lines) {
      const lineGross = l.qty * l.unitPrice
      const lineDiscounted = lineGross * (1 - l.discountPct / 100)
      const lineVat = lineDiscounted * (l.vatPct / 100)
      qtyTotal += l.qty
      gross += lineGross
      discounted += lineDiscounted
      vat += lineVat
    }
    return {
      qtyTotal,
      gross: round2(gross),
      discounted: round2(discounted),
      vat: round2(vat),
      net: round2(discounted + vat),
    }
  }, [lines])

  const retailerDisplayName = selectedRetailer?.name ?? "Select a retailer"

  const getFillInput = React.useCallback((): OrderTemplateFillInput => {
    return {
      retailerName: selectedRetailer?.name ?? "",
      orderRef,
      orderDateIso: orderDate,
      deliveryDateIso: deliveryDate,
      retailerCode: retailerCode.trim(),
      deliverTo: deliverTo.trim() || DEFAULT_META.deliverTo,
      paymentTerms: paymentTerms.trim() || DEFAULT_META.payment,
      currency: currency.trim() || DEFAULT_META.currency,
      notes,
      lines: lines.map((l) => ({
        sku: l.sku,
        productName: l.productName,
        qty: l.qty,
        unitPrice: l.unitPrice,
        discountPct: l.discountPct,
        vatPct: l.vatPct,
      })),
      totals,
    }
  }, [
    selectedRetailer?.name,
    orderRef,
    orderDate,
    deliveryDate,
    retailerCode,
    deliverTo,
    paymentTerms,
    currency,
    notes,
    lines,
    totals,
  ])

  const fallbackSupremeHtml = React.useMemo(() => {
    if (!lines.length) return ""
    return buildOrderHtml(
      retailerDisplayName,
      orderRef,
      orderDate,
      deliveryDate,
      retailerCode.trim(),
      deliverTo.trim() || DEFAULT_META.deliverTo,
      paymentTerms.trim() || DEFAULT_META.payment,
      currency.trim() || DEFAULT_META.currency,
      notes,
      lines,
      totals
    )
  }, [
    lines,
    retailerDisplayName,
    orderRef,
    orderDate,
    deliveryDate,
    retailerCode,
    deliverTo,
    paymentTerms,
    currency,
    notes,
    totals,
  ])

  const saveDraft = () => {
    const poLines: PoDraftLine[] = lines
      .filter((l) => l.qty > 0)
      .map((l) => ({
        sku: l.sku,
        productName: l.productName,
        odooProductId: l.odooProductId,
        qty: l.qty,
      }))
    if (!poLines.length) {
      setDraftHint("Add at least one line before saving draft.")
      return
    }
    savePoDraft(poLines, `Order ${orderRef} — ${retailerDisplayName}`)
    setDraftHint(`Saved ${poLines.length} line(s) to Workflow draft.`)
    setTimeout(() => setDraftHint(null), 3000)
  }

  const downloadFilledFromTemplate = async () => {
    const t = selectedRetailer?.template
    if (!t) {
      setDraftHint("Upload this retailer’s order template (.xlsx, .xls, .csv, or fillable PDF) first.")
      setTimeout(() => setDraftHint(null), 6000)
      return
    }
    if (!lines.length) {
      setDraftHint("Add at least one line item.")
      setTimeout(() => setDraftHint(null), 4000)
      return
    }
    setOutputBusy(true)
    try {
      const buf = await storedTemplateToBlob(t).arrayBuffer()
      const res = await fillUploadedOrderTemplate(buf, t.fileName, t.mimeType, getFillInput())
      if (!res.ok) {
        setDraftHint(res.error)
        setTimeout(() => setDraftHint(null), 10_000)
        return
      }
      triggerBlobDownload(res.data, res.fileName, res.mimeType)
      if (res.warning) {
        setDraftHint(res.warning)
        setTimeout(() => setDraftHint(null), 10_000)
      }
    } catch (e) {
      setDraftHint(e instanceof Error ? e.message : "Could not build the filled file.")
      setTimeout(() => setDraftHint(null), 8000)
    } finally {
      setOutputBusy(false)
    }
  }

  const printOrSaveFilledPdf = async () => {
    const t = selectedRetailer?.template
    if (!t) {
      setDraftHint("Upload a fillable PDF template to print, or download the Excel version and print from there.")
      setTimeout(() => setDraftHint(null), 8000)
      return
    }
    if (!lines.length) {
      setDraftHint("Add at least one line item.")
      setTimeout(() => setDraftHint(null), 4000)
      return
    }
    const isPdf = t.fileName.toLowerCase().endsWith(".pdf") || t.mimeType.includes("pdf")
    if (!isPdf) {
      await downloadFilledFromTemplate()
      setDraftHint("Downloaded filled spreadsheet — open it in Excel (or similar) and use Print or Save as PDF.")
      setTimeout(() => setDraftHint(null), 8000)
      return
    }
    setOutputBusy(true)
    try {
      const buf = await storedTemplateToBlob(t).arrayBuffer()
      const res = await fillUploadedOrderTemplate(buf, t.fileName, t.mimeType, getFillInput())
      if (!res.ok) {
        setDraftHint(res.error)
        setTimeout(() => setDraftHint(null), 10_000)
        return
      }
      const blob = new Blob([res.data as BlobPart], { type: "application/pdf" })
      const blobUrl = URL.createObjectURL(blob)
      const w = window.open(blobUrl, "_blank")
      if (w) {
        const cleanup = () => setTimeout(() => URL.revokeObjectURL(blobUrl), 120_000)
        const doPrint = () => {
          try {
            w.focus()
            w.print()
          } catch {
            /* ignore */
          }
          cleanup()
        }
        if (w.document.readyState === "complete") {
          setTimeout(doPrint, 400)
        } else {
          w.addEventListener("load", () => setTimeout(doPrint, 400), { once: true })
        }
        return
      }
      URL.revokeObjectURL(blobUrl)
      triggerBlobDownload(res.data, res.fileName, res.mimeType)
      setDraftHint("Pop-up blocked — filled PDF downloaded. Open it and choose Print → Save as PDF.")
      setTimeout(() => setDraftHint(null), 8000)
    } catch (e) {
      setDraftHint(e instanceof Error ? e.message : "Could not open PDF.")
      setTimeout(() => setDraftHint(null), 8000)
    } finally {
      setOutputBusy(false)
    }
  }

  const downloadFallbackSupremeHtml = () => {
    if (!fallbackSupremeHtml) return
    const safeName = `${orderRef.replace(/[^\w.-]+/g, "_")}-supreme-order.html`
    const blob = new Blob([fallbackSupremeHtml], { type: "text/html;charset=utf-8" })
    const url = URL.createObjectURL(blob)
    const a = document.createElement("a")
    a.href = url
    a.download = safeName
    a.click()
    URL.revokeObjectURL(url)
  }

  const mailOrderSummary = () => {
    if (!selectedRetailerId) {
      setDraftHint("Select a retailer before sending mail.")
      setTimeout(() => setDraftHint(null), 4000)
      return
    }
    if (!lines.length) {
      setDraftHint("Add at least one product line before mailing.")
      setTimeout(() => setDraftHint(null), 4000)
      return
    }
    const subj = `Order ${orderRef} — ${retailerDisplayName}`
    const lineText = lines
      .map(
        (l, i) =>
          `${i + 1}. ${l.productName} (${l.sku}) — Qty ${l.qty}, Rate ${l.unitPrice.toFixed(2)} ${currency}, Disc ${l.discountPct}%, VAT ${l.vatPct}%`
      )
      .join("\n")
    const body = [
      `Retailer: ${retailerDisplayName}`,
      retailerCode.trim() ? `Retailer ref: ${retailerCode.trim()}` : null,
      `Order ref: ${orderRef}`,
      `Order date: ${orderDate}`,
      `Delivery: ${deliveryDate}`,
      `Deliver to: ${deliverTo}`,
      "",
      "Lines:",
      lineText,
      "",
      `Total qty: ${totals.qtyTotal} EA`,
      `Net: ${totals.net.toFixed(2)} ${currency}`,
      "",
      notes.trim() ? `Notes:\n${notes.trim()}` : null,
      "",
      "—",
      "Attach the filled file from Download filled file (merged into this retailer’s template) if needed.",
    ]
      .filter(Boolean)
      .join("\n")

    const href = `mailto:?subject=${encodeURIComponent(subj)}&body=${encodeURIComponent(body)}`
    if (href.length > 1800) {
      setDraftHint("Summary is long for email; use Download and attach the HTML/PDF instead.")
      setTimeout(() => setDraftHint(null), 6000)
    }
    window.location.href = href
  }

  const soLines = React.useMemo<SalesOrderLine[]>(
    () => lines.filter((l) => l.qty > 0).map((l) => ({ sku: l.sku, qty: l.qty })),
    [lines]
  )

  const stock = React.useMemo(
    () => (soLines.length ? evaluateStockForLines(variants, soLines) : []),
    [variants, soLines]
  )

  const [soPartnerId, setSoPartnerId] = React.useState("")
  const [soResult, setSoResult] = React.useState<string | null>(null)
  const [soLoading, setSoLoading] = React.useState(false)

  const createSoInOdoo = async () => {
    setSoResult(null)
    const qtyLines = lines.filter((l) => l.qty > 0)
    if (!qtyLines.length) {
      setSoResult("Add at least one line first.")
      return
    }

    if (source === "demo") {
      const mockId = 800000 + Math.floor(Math.random() * 899999)
      const ref = soPartnerId.trim() || "(demo customer ref)"
      setSoResult(
        `✓ Demo mode: simulated draft SO #${mockId} for customer ref ${ref} (${qtyLines.length} line(s)). No Odoo request was sent — connect Odoo for a real sale.order.`
      )
      return
    }

    const partner = Number.parseInt(soPartnerId.trim(), 10)
    if (!Number.isFinite(partner) || partner <= 0) {
      setSoResult("Enter a valid customer partner id.")
      return
    }
    const payloadLines = lines
      .filter((l) => l.odooProductId != null && l.qty > 0)
      .map((l) => ({ productId: l.odooProductId as number, quantity: l.qty }))
    if (!payloadLines.length) {
      setSoResult("No Odoo product ids in lines. Use live Odoo products or demo mode.")
      return
    }
    setSoLoading(true)
    try {
      const res = await postJson<{ ok?: boolean; message?: string }>("/api/odoo/sale-order", {
        partnerId: partner,
        lines: payloadLines,
      })
      setSoResult(res.ok ? (res.message ?? "SO created in Odoo.") : (res.message ?? "Failed to create SO."))
    } catch (e) {
      setSoResult(e instanceof Error ? e.message : "SO request failed.")
    } finally {
      setSoLoading(false)
    }
  }

  const canMail = Boolean(selectedRetailerId) && lines.length > 0

  const bannerMessages = [odooError, templateHint, draftHint].filter(Boolean) as string[]
  const dataIsSample = source === "demo"
  const odooUnavailable = dataIsSample && Boolean(odooError)

  return (
    <div className="space-y-3 pb-8">
      <div className="grid items-start gap-3 lg:grid-cols-12">
        <div className="flex items-start gap-3 lg:col-span-8">
          <div className="mt-0.5 inline-flex size-10 shrink-0 items-center justify-center rounded-xl bg-primary/10">
            <RiShoppingCart2Line className="size-6 text-primary" aria-hidden />
          </div>
          <div className="min-w-0">
            <h1 className="text-2xl font-semibold tracking-tight md:text-3xl">Retailer order</h1>
            <p className="mt-1 text-sm leading-relaxed text-muted-foreground">
              Upload each retailer&apos;s template once. Your lines merge into that file for download — Excel uses{" "}
              <span className="font-medium text-foreground">{"{{placeholders}}"}</span> in cells; PDFs need fillable
              text fields (see left panel).
            </p>
          </div>
        </div>
        <Panel className="flex flex-wrap items-center gap-3 border-primary/25 bg-primary/5 p-3 text-sm lg:col-span-4 lg:justify-self-end">
          <span className="inline-flex size-7 shrink-0 items-center justify-center rounded-full bg-primary text-xs font-bold text-primary-foreground">
            3
          </span>
          <span className="text-muted-foreground">Next:</span>
          <Link href="/workflow" className="font-semibold text-primary underline-offset-4 hover:underline">
            Workflow →
          </Link>
        </Panel>
      </div>

      {bannerMessages.length > 0 ? (
        <div
          className={cn(
            "rounded-lg border px-3 py-2 text-sm",
            odooError
              ? "border-destructive/40 bg-destructive/5 text-destructive"
              : "border-border/60 bg-muted/30 text-muted-foreground"
          )}
        >
          {bannerMessages.map((m, i) => (
            <p key={i} className={i > 0 ? "mt-1 border-t border-border/40 pt-1" : undefined}>
              {m}
            </p>
          ))}
        </div>
      ) : null}

      <div className="grid items-stretch gap-3 lg:grid-cols-12">
        <Panel className="space-y-3 overflow-y-auto border-border/60 bg-card/95 p-3 lg:col-span-3 lg:max-h-[min(88vh,960px)] lg:overflow-y-auto">
          {odooUnavailable ? (
            <div className="flex gap-3 rounded-xl border border-amber-500/30 bg-amber-500/8 p-3 text-sm text-amber-950 dark:border-amber-500/25 dark:bg-amber-500/10 dark:text-amber-50/95">
              <RiInformationLine className="mt-0.5 size-5 shrink-0 text-amber-600 dark:text-amber-400" aria-hidden />
              <div className="min-w-0">
                <p className="font-medium">Live catalog unavailable</p>
                <p className="mt-1 text-xs leading-relaxed opacity-90">Using sample inventory for product pickers.</p>
              </div>
            </div>
          ) : null}
          <div className="flex flex-wrap items-center justify-between gap-2 text-sm">
            <span
              className={cn(
                "inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-medium",
                source === "odoo"
                  ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-800 dark:text-emerald-200"
                  : "border-border/60 bg-muted/40 text-muted-foreground"
              )}
            >
              {source === "odoo" ? "Live · Odoo" : "Sample data"}
            </span>
            <span className="text-xs text-muted-foreground">{variants.length} products</span>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Button type="button" variant="outline" size="sm" className="w-fit" onClick={() => refetchOdoo()}>
              Refresh data
            </Button>
            {odooLoading ? <span className="text-xs text-muted-foreground">Loading catalog…</span> : null}
          </div>

          <div className="rounded-xl border border-border/60 bg-muted/20 p-3 shadow-sm">
            <p className="text-xs font-semibold tracking-tight text-foreground">Excel / CSV / Google Sheets</p>
            <p className="mt-2 text-[11px] leading-relaxed text-muted-foreground">
              Put tokens in cells (exact text). We replace them when you download.
            </p>
            <p className="mt-2 break-all font-mono text-[10px] leading-relaxed text-muted-foreground">
              {"{{ORDER_REF}} {{ORDER_DATE}} {{DELIVERY_DATE}} {{RETAILER_NAME}} {{RETAILER_CODE}} {{DELIVER_TO}} {{CURRENCY}} {{PAYMENT_TERMS}} {{NOTES}} {{LINE_ITEMS}} {{NET_TOTAL}} {{GROSS_TOTAL}} {{AFTER_DISCOUNT_TOTAL}} {{VAT_TOTAL}} {{QTY_TOTAL}}"}
            </p>
            <p className="mt-2 text-[11px] text-muted-foreground">
              Lines:{" "}
              <span className="font-mono text-[10px]">
                {"{{LINE_1_SKU}} {{LINE_1_NAME}} {{LINE_1_QTY}} {{LINE_1_RATE}} {{LINE_1_DISC}} {{LINE_1_VAT}} {{LINE_1_VALUE}}"}
              </span>{" "}
              … up to <span className="font-mono text-[10px]">{"{{LINE_50_*}}"}</span>.
            </p>
          </div>

          <div className="rounded-xl border border-border/60 bg-muted/20 p-3 shadow-sm">
            <p className="text-xs font-semibold tracking-tight text-foreground">Fillable PDF</p>
            <p className="mt-2 text-[11px] leading-relaxed text-muted-foreground">
              AcroForm <span className="font-medium text-foreground">text</span> fields are filled by name, e.g.{" "}
              <span className="font-mono text-[10px]">order_ref</span>,{" "}
              <span className="font-mono text-[10px]">retailer_name</span>,{" "}
              <span className="font-mono text-[10px]">line_items</span>,{" "}
              <span className="font-mono text-[10px]">net_total</span>,{" "}
              <span className="font-mono text-[10px]">delivery_date</span>. Flat PDFs without fields cannot be filled
              automatically.
            </p>
          </div>
        </Panel>

        <div className="space-y-3 lg:col-span-6">
        <Panel className="divide-y divide-border/60 overflow-hidden p-0">
          {/* Retailer */}
          <section className="space-y-4 p-4 sm:p-5">
            <div className="flex flex-wrap items-center gap-2">
              <RiStore2Line className="size-4 text-primary" aria-hidden />
              <SectionTitle>Who is this order for?</SectionTitle>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <FieldLabel>Retailer</FieldLabel>
                <div className="flex flex-wrap gap-2">
                  <select
                    className="h-10 min-w-0 flex-1 rounded-lg border border-input bg-background px-3 text-sm shadow-sm"
                    value={selectedRetailerId ?? ""}
                    onChange={(e) => {
                      const id = e.target.value || null
                      const base = retailers.length > 0 ? retailers : loadRetailerTemplatesState().retailers
                      const ok = persistRetailers(base, id)
                      if (!ok) {
                        setTemplateHint("Could not save to browser storage (quota full or private mode).")
                        setTimeout(() => setTemplateHint(null), 8000)
                      }
                    }}
                  >
                    <option value="">Select…</option>
                    {retailers.map((r) => (
                      <option key={r.id} value={r.id}>
                        {r.name}
                        {r.template ? " · template saved" : ""}
                      </option>
                    ))}
                  </select>
                  {selectedRetailerId ? (
                    <Button type="button" variant="outline" size="sm" onClick={() => removeRetailer(selectedRetailerId)}>
                      Remove
                    </Button>
                  ) : null}
                </div>
              </div>
              <div>
                <FieldLabel htmlFor="purchase-new-retailer-name">New retailer</FieldLabel>
                <div className="flex gap-2">
                  <Input
                    ref={newRetailerInputRef}
                    id="purchase-new-retailer-name"
                    autoComplete="off"
                    placeholder="Name"
                    className="h-10"
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        e.preventDefault()
                        addRetailer()
                      }
                    }}
                  />
                  <button
                    type="button"
                    className="inline-flex h-10 shrink-0 cursor-pointer items-center justify-center rounded-lg border border-transparent bg-primary px-4 text-sm font-medium text-primary-foreground shadow-sm outline-none transition-colors hover:bg-primary/90 focus-visible:ring-2 focus-visible:ring-ring/50"
                    onClick={addRetailer}
                  >
                    Add
                  </button>
                </div>
              </div>
            </div>
            <div className="rounded-xl border border-dashed border-border/80 bg-muted/15 p-4">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <p className="text-sm font-medium">Their blank order file</p>
                  <p className="mt-0.5 text-xs text-muted-foreground">PDF, Excel, or similar — kept per retailer on this browser.</p>
                </div>
                <div className="flex flex-wrap gap-2">
                  <input
                    ref={fileInputRef}
                    type="file"
                    className="hidden"
                    accept=".xlsx,.xls,.pdf,.csv,.doc,.docx,application/*"
                    onChange={(e) => void onTemplateFile(e)}
                  />
                  <Button
                    type="button"
                    variant="secondary"
                    size="sm"
                    className="gap-1.5"
                    disabled={!selectedRetailerId}
                    onClick={() => fileInputRef.current?.click()}
                  >
                    <RiUploadCloud2Line className="size-4" aria-hidden />
                    Upload
                  </Button>
                  {selectedRetailer?.template ? (
                    <Button type="button" variant="outline" size="sm" className="gap-1.5" onClick={downloadStoredTemplate}>
                      <RiDownloadLine className="size-4" aria-hidden />
                      Original file
                    </Button>
                  ) : null}
                </div>
              </div>
              {selectedRetailer?.template ? (
                <p className="mt-3 font-mono text-xs text-muted-foreground">{selectedRetailer.template.fileName}</p>
              ) : selectedRetailerId ? (
                <p className="mt-3 text-xs text-amber-700 dark:text-amber-400">Optional but recommended: upload their standard order form.</p>
              ) : (
                <p className="mt-3 text-xs text-muted-foreground">Pick a retailer above to upload a file.</p>
              )}
            </div>
          </section>

          {/* Order meta */}
          <section className="space-y-4 p-4 sm:p-5">
            <SectionTitle>Order header</SectionTitle>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <div>
                <FieldLabel>Reference</FieldLabel>
                <Input className="h-10" value={orderRef} onChange={(e) => setOrderRef(e.target.value)} />
              </div>
              <div>
                <FieldLabel>Order date</FieldLabel>
                <Input className="h-10" type="date" value={orderDate} onChange={(e) => setOrderDate(e.target.value)} />
              </div>
              <div>
                <FieldLabel>Delivery date</FieldLabel>
                <Input className="h-10" type="date" value={deliveryDate} onChange={(e) => setDeliveryDate(e.target.value)} />
              </div>
              <div>
                <FieldLabel>Retailer code</FieldLabel>
                <Input className="h-10" value={retailerCode} onChange={(e) => setRetailerCode(e.target.value)} placeholder="Optional" />
              </div>
            </div>
            <div className="grid gap-3 lg:grid-cols-2">
              <div>
                <FieldLabel>Deliver to</FieldLabel>
                <Input className="h-10" value={deliverTo} onChange={(e) => setDeliverTo(e.target.value)} />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <FieldLabel>Currency</FieldLabel>
                  <Input className="h-10" value={currency} onChange={(e) => setCurrency(e.target.value)} />
                </div>
                <div>
                  <FieldLabel>Payment</FieldLabel>
                  <Input className="h-10" value={paymentTerms} onChange={(e) => setPaymentTerms(e.target.value)} />
                </div>
              </div>
            </div>
            <div>
              <FieldLabel>Notes on printed form</FieldLabel>
              <Input className="h-10" value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Optional" />
            </div>
          </section>

          {/* Lines */}
          <section className="space-y-4 p-4 sm:p-5">
            <SectionTitle>Line items</SectionTitle>
            <div className="rounded-xl border border-border/60 bg-muted/10 p-3 sm:p-4">
              <p className="mb-3 text-xs text-muted-foreground">Add one row at a time to the table below.</p>
              <div className="grid gap-3 md:grid-cols-12 md:items-end">
                <div className="md:col-span-4">
                  <FieldLabel>Product</FieldLabel>
                  <select
                    className="h-10 w-full rounded-lg border border-input bg-background px-3 text-sm shadow-sm"
                    value={sku}
                    onChange={(e) => setSku(e.target.value)}
                  >
                    {variants.map((v) => (
                      <option key={v.id} value={v.sku}>
                        {v.sku} — {v.productName}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="md:col-span-2">
                  <FieldLabel>Qty</FieldLabel>
                  <Input className="h-10" type="number" min={1} value={qty} onChange={(e) => setQty(Number(e.target.value) || 1)} />
                </div>
                <div className="md:col-span-2">
                  <FieldLabel>Rate</FieldLabel>
                  <Input
                    className="h-10"
                    type="number"
                    min={0}
                    step="0.01"
                    value={unitPrice}
                    onChange={(e) => setUnitPrice(Number(e.target.value) || 0)}
                  />
                </div>
                <div className="md:col-span-2">
                  <FieldLabel>Disc %</FieldLabel>
                  <Input
                    className="h-10"
                    type="number"
                    min={0}
                    step="0.01"
                    value={discountPct}
                    onChange={(e) => setDiscountPct(Number(e.target.value) || 0)}
                  />
                </div>
                <div className="md:col-span-2">
                  <FieldLabel>VAT %</FieldLabel>
                  <Input
                    className="h-10"
                    type="number"
                    min={0}
                    step="0.01"
                    value={vatPct}
                    onChange={(e) => setVatPct(Number(e.target.value) || 0)}
                  />
                </div>
                <div className="md:col-span-12">
                  <Button type="button" size="sm" className="mt-1" onClick={addLine}>
                    Add to order
                  </Button>
                </div>
              </div>
            </div>

            <div className="overflow-x-auto rounded-xl border border-border/60">
              <table className="w-full min-w-[720px] text-sm">
                <thead>
                  <tr className="border-b border-border/60 bg-muted/40 text-left text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                    <th className="px-3 py-2.5">#</th>
                    <th className="px-3 py-2.5">Product</th>
                    <th className="px-3 py-2.5 text-right">Qty</th>
                    <th className="px-3 py-2.5 text-right">Rate</th>
                    <th className="px-3 py-2.5 text-right">Disc</th>
                    <th className="px-3 py-2.5 text-right">VAT</th>
                    <th className="px-3 py-2.5 text-right">Value</th>
                    <th className="px-3 py-2.5 w-[1%]" />
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/50">
                  {lines.map((l, idx) => {
                    const value = round2(l.qty * l.unitPrice * (1 - l.discountPct / 100))
                    return (
                      <tr key={`${l.sku}-${idx}`} className="bg-card">
                        <td className="px-3 py-2.5 tabular-nums text-muted-foreground">{(idx + 1) * 10}</td>
                        <td className="px-3 py-2.5">
                          <span className="font-medium">{l.productName}</span>
                          <span className="mt-0.5 block font-mono text-xs text-muted-foreground">{l.sku}</span>
                        </td>
                        <td className="px-3 py-2.5 text-right tabular-nums">{l.qty.toFixed(0)}</td>
                        <td className="px-3 py-2.5 text-right tabular-nums">{l.unitPrice.toFixed(2)}</td>
                        <td className="px-3 py-2.5 text-right tabular-nums">{l.discountPct.toFixed(0)}%</td>
                        <td className="px-3 py-2.5 text-right tabular-nums">{l.vatPct.toFixed(0)}%</td>
                        <td className="px-3 py-2.5 text-right font-medium tabular-nums">{value.toFixed(2)}</td>
                        <td className="px-3 py-2.5">
                          <Button type="button" variant="ghost" size="sm" className="h-8 text-xs" onClick={() => removeLine(idx)}>
                            Remove
                          </Button>
                        </td>
                      </tr>
                    )
                  })}
                  {lines.length === 0 && (
                    <tr>
                      <td className="px-3 py-10 text-center text-sm text-muted-foreground" colSpan={8}>
                        No products yet — use the form above.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>

            <div className="grid gap-3 rounded-xl bg-muted/25 p-4 sm:grid-cols-2 lg:grid-cols-5">
              <div>
                <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">Qty</p>
                <p className="mt-1 text-lg font-semibold tabular-nums">{totals.qtyTotal}</p>
              </div>
              <div>
                <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">Subtotal</p>
                <p className="mt-1 text-lg font-semibold tabular-nums">
                  {totals.gross.toFixed(2)} {currency}
                </p>
              </div>
              <div>
                <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">After discount</p>
                <p className="mt-1 text-lg font-semibold tabular-nums">
                  {totals.discounted.toFixed(2)} {currency}
                </p>
              </div>
              <div>
                <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">VAT</p>
                <p className="mt-1 text-lg font-semibold tabular-nums">
                  {totals.vat.toFixed(2)} {currency}
                </p>
              </div>
              <div className="sm:col-span-2 lg:col-span-1 lg:border-l lg:border-border/60 lg:pl-4">
                <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">Net</p>
                <p className="mt-1 text-xl font-bold tabular-nums text-primary">
                  {totals.net.toFixed(2)} {currency}
                </p>
              </div>
            </div>
          </section>
        </Panel>
        </div>

        <div className="space-y-3 lg:col-span-3">
          <Panel className="space-y-4 border-primary/20 bg-primary/5 p-4 ring-1 ring-primary/10 lg:sticky lg:top-4">
            <div>
              <h2 className="text-sm font-semibold text-foreground">Finish order</h2>
              <p className="mt-1 text-xs text-muted-foreground">
                Download merges your lines into the uploaded template. For PDFs, print opens the filled file; for Excel,
                download then print from the spreadsheet app.
              </p>
            </div>
            <div className="flex flex-col gap-2">
              <Button
                type="button"
                className="h-11 w-full justify-center gap-2"
                disabled={!canMail}
                onClick={mailOrderSummary}
              >
                <RiMailLine className="size-4" aria-hidden />
                Mail summary
              </Button>
              <Button
                type="button"
                variant="outline"
                className="h-11 w-full justify-center gap-2 bg-background"
                disabled={!lines.length || !selectedRetailer?.template || outputBusy}
                onClick={() => void downloadFilledFromTemplate()}
              >
                <RiDownloadLine className="size-4" aria-hidden />
                {outputBusy ? "Working…" : "Download filled file"}
              </Button>
              <Button
                type="button"
                variant="secondary"
                className="h-11 w-full justify-center gap-2"
                disabled={!lines.length || !selectedRetailer?.template || outputBusy}
                onClick={() => void printOrSaveFilledPdf()}
              >
                <RiPrinterLine className="size-4" aria-hidden />
                {outputBusy ? "Working…" : "Print / Save PDF"}
              </Button>
            </div>
            {!selectedRetailer?.template ? (
              <p className="text-center text-xs text-muted-foreground">Upload a template to enable download and print.</p>
            ) : !lines.length ? (
              <p className="text-center text-xs text-muted-foreground">Add lines to enable download and print.</p>
            ) : !selectedRetailerId ? (
              <p className="text-center text-xs text-muted-foreground">Select a retailer to enable mail.</p>
            ) : null}
          </Panel>

          <details className="group rounded-xl border border-border/60 bg-card p-4 shadow-sm">
            <summary className="cursor-pointer text-sm font-semibold outline-none [&::-webkit-details-marker]:hidden">
              <span className="inline-flex w-full items-center justify-between">
                More tools
                <span className="text-xs font-normal text-muted-foreground group-open:hidden">Workflow, Odoo, stock</span>
                <span className="hidden text-xs font-normal text-muted-foreground group-open:inline">Hide</span>
              </span>
            </summary>
            <div className="mt-4 space-y-4 border-t border-border/60 pt-4">
              <div className="flex flex-wrap gap-2">
                <Button type="button" variant="secondary" size="sm" onClick={saveDraft}>
                  Save for Workflow
                </Button>
                <Button type="button" variant="outline" size="sm" asChild>
                  <Link href="/workflow">Workflow</Link>
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  disabled={!lines.length}
                  onClick={downloadFallbackSupremeHtml}
                >
                  Supreme HTML (fallback)
                </Button>
              </div>
              {source === "demo" ? (
                <p className="rounded-md border border-amber-500/25 bg-amber-500/8 px-3 py-2 text-xs text-muted-foreground">
                  Demo mode: Odoo below is simulated until you connect live Odoo.
                </p>
              ) : null}
              <div className="space-y-2 rounded-lg border border-border/60 bg-muted/15 p-3">
                <p className="text-xs font-medium text-muted-foreground">
                  {source === "demo" ? "Simulate SO" : "Draft sale order in Odoo"}
                </p>
                <div className="flex flex-col gap-2 sm:flex-row">
                  <Input
                    className="h-9"
                    placeholder={source === "demo" ? "Customer ref (optional)" : "Customer partner id"}
                    value={soPartnerId}
                    onChange={(e) => setSoPartnerId(e.target.value)}
                  />
                  <Button type="button" size="sm" className="h-9 shrink-0" disabled={soLoading} onClick={() => void createSoInOdoo()}>
                    {soLoading ? "…" : source === "demo" ? "Simulate" : "Create SO"}
                  </Button>
                </div>
                {soResult ? (
                  <p
                    className={cn(
                      "text-xs",
                      soResult.startsWith("✓") ? "text-emerald-700 dark:text-emerald-400" : "text-muted-foreground"
                    )}
                  >
                    {soResult}
                  </p>
                ) : null}
              </div>
              <div>
                <p className="mb-2 text-xs font-medium text-muted-foreground">Stock vs these lines</p>
                {stock.length === 0 ? (
                  <p className="text-xs text-muted-foreground">Add lines to see availability.</p>
                ) : (
                  <ul className="max-h-48 space-y-1.5 overflow-y-auto text-xs">
                    {stock.map((s) => (
                      <li
                        key={s.sku}
                        className={cn(
                          "flex flex-col gap-0.5 rounded-md border px-2 py-1.5 sm:flex-row sm:items-center sm:justify-between",
                          s.ok ? "border-emerald-500/25 bg-emerald-500/5" : "border-rose-500/25 bg-rose-500/5"
                        )}
                      >
                        <span className="font-mono text-[11px]">{s.sku}</span>
                        <span className="text-muted-foreground">
                          need {s.requested} · have {s.available}
                          {s.ok ? "" : ` · short ${s.requested - s.available}`}
                        </span>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </div>
          </details>
        </div>
      </div>
    </div>
  )
}

export default Purchase
