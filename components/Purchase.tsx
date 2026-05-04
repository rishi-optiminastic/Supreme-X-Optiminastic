"use client"

import * as React from "react"
import {
  RiAddLine,
  RiArrowDownSLine,
  RiArrowUpSLine,
  RiCloseLine,
  RiDownloadLine,
  RiLoader4Line,
  RiMailLine,
  RiPrinterLine,
  RiStore2Line,
  RiUploadCloud2Line,
} from "@remixicon/react"
import { Dialog } from "radix-ui"

import { PurchasePreviousOrdersPanel } from "@/components/purchase-previous-orders-panel"
import { RetailerOrderAiSuggestions } from "@/components/retailer-order-ai-suggestions"
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
  normalizeRetailerArea,
  persistRetailerTemplatesState,
  RETAILER_AREA_LABELS,
  storedTemplateToBlob,
  validateTemplateFile,
  type RetailerArea,
  type RetailerOrderProfile,
  type StoredTemplateFile,
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

/** Built-in workbook used when a retailer has no custom template (see Add retailer → default master). */
const DEFAULT_MASTER_SHEET_URL = "/Order%20Form.xlsx"
const DEFAULT_MASTER_SHEET_NAME = "Order Form.xlsx"

async function loadTemplateBufferForRetailer(
  retailer: RetailerOrderProfile | null
): Promise<{ buf: ArrayBuffer; fileName: string; mimeType: string } | null> {
  if (!retailer) return null
  if (retailer.template) {
    const blob = storedTemplateToBlob(retailer.template)
    return {
      buf: await blob.arrayBuffer(),
      fileName: retailer.template.fileName,
      mimeType: retailer.template.mimeType,
    }
  }
  if (retailer.useDefaultMasterSheet) {
    const res = await fetch(DEFAULT_MASTER_SHEET_URL)
    if (!res.ok) return null
    const buf = await res.arrayBuffer()
    return {
      buf,
      fileName: DEFAULT_MASTER_SHEET_NAME,
      mimeType:
        res.headers.get("content-type") ||
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    }
  }
  return null
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

function FieldLabel({
  children,
  htmlFor,
  className,
}: {
  children: React.ReactNode
  htmlFor?: string
  className?: string
}) {
  return (
    <label
      htmlFor={htmlFor}
      className={cn(
        "mb-1 block text-[11px] font-medium uppercase tracking-wide text-muted-foreground",
        className
      )}
    >
      {children}
    </label>
  )
}

function SectionTitle({ children }: { children: React.ReactNode }) {
  return <h2 className="text-sm font-semibold tracking-tight text-foreground">{children}</h2>
}

function OrderTemplatePreviewBlock({
  orderRef,
  retailerName,
  deliverTo,
  currency,
  templateFileName,
  templateKind,
}: {
  orderRef: string
  retailerName: string
  deliverTo: string
  currency: string
  templateFileName: string | null
  templateKind: "custom" | "default" | "none"
}) {
  const [expanded, setExpanded] = React.useState(false)
  const kindLabel = templateKind === "default" ? "Default master" : templateKind === "custom" ? "Your file" : "No template"
  const fileLine = templateFileName ?? DEFAULT_MASTER_SHEET_NAME

  const collapsedSummary =
    templateKind === "none"
      ? "No template — upload or use default master sheet"
      : fileLine

  return (
    <div className="mt-3 flex flex-col rounded-xl border border-border/50 bg-muted/10 px-3 py-2 text-left shadow-sm ring-1 ring-black/5 dark:ring-white/5">
      <button
        type="button"
        onClick={() => setExpanded((v) => !v)}
        aria-expanded={expanded}
        className="flex w-full items-center justify-between gap-2 rounded-lg py-1 text-left transition-colors hover:bg-muted/20"
      >
        <div className="min-w-0 flex-1">
          <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">Template preview</p>
          <p className="mt-0.5 truncate font-mono text-[10px] text-muted-foreground" title={collapsedSummary}>
            {collapsedSummary}
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <span className="rounded-full bg-background px-2 py-0.5 text-[9px] font-medium text-muted-foreground">
            {kindLabel}
          </span>
          {expanded ? (
            <RiArrowUpSLine className="size-4 text-muted-foreground" aria-hidden />
          ) : (
            <RiArrowDownSLine className="size-4 text-muted-foreground" aria-hidden />
          )}
        </div>
      </button>

      {expanded && templateKind === "none" ? (
        <div className="mt-2.5 border-t border-border/30 pt-2.5">
          <p className="text-[10px] leading-relaxed text-muted-foreground">
            Upload a template or turn on the default master sheet to see how merged fields will line up with your
            order.
          </p>
        </div>
      ) : null}

      {expanded && templateKind !== "none" ? (
        <div className="mt-2.5 border-t border-border/30 pt-2.5">
          <div className="flex min-h-[9rem] flex-col overflow-hidden rounded-md border border-border/60 bg-card p-2.5 shadow-sm dark:bg-zinc-950/40">
            <div className="pointer-events-none space-y-2 font-mono text-[8px] uppercase tracking-wider text-muted-foreground/90">
              <div className="flex justify-between gap-2 border-b border-border/40 pb-1">
                <span>Order ref</span>
                <span className="max-w-[58%] truncate text-right font-semibold text-foreground">{orderRef.trim() || "—"}</span>
              </div>
              <div className="flex justify-between gap-2 border-b border-border/40 pb-1">
                <span>Retailer</span>
                <span className="max-w-[58%] truncate text-right font-semibold text-foreground">{retailerName}</span>
              </div>
              <div className="flex justify-between gap-2 border-b border-border/40 pb-1">
                <span>Ship to</span>
                <span className="max-w-[58%] truncate text-right text-[7px] font-normal normal-case leading-snug text-foreground/80">
                  {deliverTo}
                </span>
              </div>
              <div className="flex justify-between gap-2 border-b border-border/40 pb-1">
                <span>Currency</span>
                <span className="font-semibold text-foreground">{currency}</span>
              </div>
              <div className="rounded border border-dashed border-primary/30 bg-primary/5 p-1.5">
                <p className="text-[7px] font-semibold text-primary">Line items</p>
                <div className="mt-1 grid grid-cols-4 gap-0.5 border-t border-border/30 pt-1 text-[6px]">
                  <span className="font-semibold">#</span>
                  <span className="col-span-2 font-semibold">SKU / Desc</span>
                  <span className="text-right font-semibold">Qty</span>
                  <span className="opacity-70">10</span>
                  <span className="col-span-2 truncate opacity-80">…</span>
                  <span className="text-right opacity-70">…</span>
                </div>
              </div>
            </div>
          </div>
          <p className="mt-2 text-[9px] leading-snug text-muted-foreground">
            Exports merge placeholders (e.g.{" "}
            <span className="font-mono text-foreground/80">{"{{ORDER_REF}}"}</span>) with these values.
          </p>
        </div>
      ) : null}
    </div>
  )
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
  const addRetailerTemplateInputRef = React.useRef<HTMLInputElement>(null)

  const [addRetailerOpen, setAddRetailerOpen] = React.useState(false)
  const [newRetailerName, setNewRetailerName] = React.useState("")
  const [newRetailerArea, setNewRetailerArea] = React.useState<RetailerArea>("uae")
  const [addRetailerUseDefault, setAddRetailerUseDefault] = React.useState(false)
  const [addRetailerTemplateFile, setAddRetailerTemplateFile] = React.useState<File | null>(null)
  const [dialogTemplateDrag, setDialogTemplateDrag] = React.useState(false)
  const [addRetailerBusy, setAddRetailerBusy] = React.useState(false)

  const resetAddRetailerForm = React.useCallback(() => {
    setNewRetailerName("")
    setNewRetailerArea("uae")
    setAddRetailerUseDefault(false)
    setAddRetailerTemplateFile(null)
    setDialogTemplateDrag(false)
    if (addRetailerTemplateInputRef.current) addRetailerTemplateInputRef.current.value = ""
  }, [])

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
  const hasTemplateForOutput = Boolean(selectedRetailer?.template || selectedRetailer?.useDefaultMasterSheet)

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

  const submitAddRetailer = React.useCallback(async () => {
    const name = newRetailerName.trim()
    if (!name) {
      setTemplateHint("Enter a retailer name.")
      setTimeout(() => setTemplateHint(null), 4000)
      return
    }
    if (!addRetailerUseDefault && !addRetailerTemplateFile) {
      setTemplateHint("Upload an order creation template or turn on “Use default master sheet”.")
      setTimeout(() => setTemplateHint(null), 6000)
      return
    }

    setAddRetailerBusy(true)
    try {
      let template: StoredTemplateFile | null = null
      let useDefaultMasterSheet: boolean | undefined
      if (addRetailerUseDefault) {
        useDefaultMasterSheet = true
      } else if (addRetailerTemplateFile) {
        const err = validateTemplateFile(addRetailerTemplateFile)
        if (err) {
          setTemplateHint(err)
          setTimeout(() => setTemplateHint(null), 8000)
          return
        }
        template = await fileToStoredTemplate(addRetailerTemplateFile)
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
        area: newRetailerArea,
        createdAtIso: new Date().toISOString(),
        template,
        useDefaultMasterSheet: template ? undefined : useDefaultMasterSheet,
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
      resetAddRetailerForm()
      setAddRetailerOpen(false)
      setTemplateHint(
        profile.useDefaultMasterSheet
          ? `Added retailer “${name}” using the default master sheet.`
          : `Added retailer “${name}” with their order template.`
      )
      setTimeout(() => setTemplateHint(null), 5000)
    } catch {
      setTemplateHint("Could not read that template file.")
      setTimeout(() => setTemplateHint(null), 5000)
    } finally {
      setAddRetailerBusy(false)
    }
  }, [
    addRetailerTemplateFile,
    addRetailerUseDefault,
    newRetailerArea,
    newRetailerName,
    persistRetailers,
    retailers,
    resetAddRetailerForm,
  ])

  const ingestAddRetailerTemplateFile = React.useCallback((file: File | null) => {
    if (!file) return
    setAddRetailerUseDefault(false)
    const err = validateTemplateFile(file)
    if (err) {
      setTemplateHint(err)
      setTimeout(() => setTemplateHint(null), 8000)
      return
    }
    setAddRetailerTemplateFile(file)
  }, [])

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
      const next = base.map((r) =>
        r.id === selectedRetailerId ? { ...r, template, useDefaultMasterSheet: undefined } : r
      )
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

  const addSuggestedLine = React.useCallback(
    (suggestedSku: string, suggestedQty: number) => {
      const v = variants.find((x) => x.sku === suggestedSku)
      if (!v) return
      const next: OrderLine = {
        sku: v.sku,
        productName: v.productName,
        odooProductId: v.odooProductId ?? null,
        qty: Math.max(1, Math.floor(suggestedQty) || 1),
        unitPrice: Math.max(0, round2(unitPrice)),
        discountPct: Math.max(0, round2(discountPct)),
        vatPct: Math.max(0, round2(vatPct)),
      }
      setLines((prev) => [...prev, next])
    },
    [variants, unitPrice, discountPct, vatPct]
  )

  const removeLine = (idx: number) => setLines((prev) => prev.filter((_, i) => i !== idx))

  const lineSkus = React.useMemo(() => lines.map((l) => l.sku), [lines])

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
    savePoDraft(poLines, `Order ${orderRef} — ${retailerDisplayName}`, selectedRetailerId)
    setDraftHint(`Saved ${poLines.length} line(s) to Workflow draft.`)
    setTimeout(() => setDraftHint(null), 3000)
  }

  const downloadFilledFromTemplate = async () => {
    const loaded = await loadTemplateBufferForRetailer(selectedRetailer)
    if (!loaded) {
      setDraftHint("Upload this retailer’s order template or enable the default master sheet when adding the retailer.")
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
      const { buf, fileName, mimeType } = loaded
      const res = await fillUploadedOrderTemplate(buf, fileName, mimeType, getFillInput())
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
    const loaded = await loadTemplateBufferForRetailer(selectedRetailer)
    if (!loaded) {
      setDraftHint("Upload a fillable PDF template to print, or download the Excel version and print from there.")
      setTimeout(() => setDraftHint(null), 8000)
      return
    }
    if (!lines.length) {
      setDraftHint("Add at least one line item.")
      setTimeout(() => setDraftHint(null), 4000)
      return
    }
    const { buf, fileName, mimeType } = loaded
    const isPdf = fileName.toLowerCase().endsWith(".pdf") || mimeType.includes("pdf")
    if (!isPdf) {
      await downloadFilledFromTemplate()
      setDraftHint("Downloaded filled spreadsheet — open it in Excel (or similar) and use Print or Save as PDF.")
      setTimeout(() => setDraftHint(null), 8000)
      return
    }
    setOutputBusy(true)
    try {
      const res = await fillUploadedOrderTemplate(buf, fileName, mimeType, getFillInput())
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
    <div className="">

      {/* ── Page header ── */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight md:text-3xl">Order creation</h1>
          <p className="mt-0.5 text-sm text-muted-foreground">
            Build an order, fill the retailer&apos;s template, and download or print.
          </p>
        </div>
        <Button
          type="button"
          size="sm"
          variant="default"
          className="h-9 shrink-0 gap-1.5 shadow-sm"
          onClick={() => setAddRetailerOpen(true)}
        >
          <RiAddLine className="size-4" aria-hidden />
          Add retailer
        </Button>
      </div>

      {/* ── Banner messages ── */}
      {/* {bannerMessages.length > 0 && (
        <div
          className={cn(
            "rounded-lg border px-3 py-2.5 text-sm",
            odooError
              ? "border-destructive/40 bg-destructive/5 text-destructive"
              : "border-border/60 bg-muted/30 text-muted-foreground"
          )}
        >
          {bannerMessages.map((m, i) => (
            <p key={i} className={i > 0 ? "mt-1 border-t border-border/40 pt-1" : undefined}>{m}</p>
          ))}
        </div>
      )} */}

      {/* ── Main 2-column layout ── */}
      <div className="grid items-start gap-4 lg:grid-cols-12">

        {/* ─── Main: order-first panel ─── */}
        <div className="min-w-0 space-y-4 lg:col-span-8">
          <Panel className="overflow-hidden p-0 shadow-md ring-1 ring-black/5 dark:ring-white/5">
            {/* ── Order items first — primary workflow without scrolling past retailer/header ── */}
            <section className="space-y-3 border-b border-border/60 p-4 sm:p-5" aria-label="Order line items">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <SectionTitle>Order items</SectionTitle>
                    {lines.length > 0 ? (
                      <span className="rounded-full bg-primary/10 px-2.5 py-0.5 text-xs font-semibold tabular-nums text-primary">
                        {lines.length} line{lines.length === 1 ? "" : "s"}
                      </span>
                    ) : null}
                    {/* <span className="rounded-full border border-primary/20 bg-primary/5 px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide text-primary/90">
                      Start here
                    </span> */}
                  </div>
                  <p className="mt-0.5 text-[11px] text-muted-foreground">
                    Add products — totals update per line 
                  </p>
                </div>
                <div className="flex flex-wrap gap-2">
                  <Button size="sm" onClick={mailOrderSummary} disabled={!lines.length}>
                    <RiMailLine className="size-4" aria-hidden /> Mail Summary
                  </Button>
                  <Button size="sm" onClick={downloadFilledFromTemplate} disabled={!lines.length}>
                    <RiDownloadLine className="size-4" aria-hidden /> Download Filled File
                  </Button>
                  <Button size="sm" onClick={printOrSaveFilledPdf} disabled={!lines.length}>
                    <RiPrinterLine className="size-4" aria-hidden /> Print / Save PDF
                  </Button>
                </div>
              </div>

              <div className="rounded-xl border border-border/60 bg-linear-to-b from-muted/20 to-muted/5 p-3 sm:p-4">
                <p className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Add product</p>
                <div className="grid gap-2 sm:gap-3 md:grid-cols-12 md:items-stretch">
                  <div className="md:col-span-4">
                    <FieldLabel htmlFor="purchase-product-select">Product</FieldLabel>
                    <select
                      id="purchase-product-select"
                      className="h-10 w-full rounded-lg border border-input bg-background px-3 text-sm shadow-sm transition-colors hover:border-primary/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/25"
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
                    <FieldLabel>Rate ({currency})</FieldLabel>
                    <Input className="h-10" type="number" min={0} step="0.01" value={unitPrice} onChange={(e) => setUnitPrice(Number(e.target.value) || 0)} />
                  </div>
                  <div className="md:col-span-1">
                    <FieldLabel>Disc %</FieldLabel>
                    <Input className="h-10" type="number" min={0} step="0.01" value={discountPct} onChange={(e) => setDiscountPct(Number(e.target.value) || 0)} />
                  </div>
                  <div className="md:col-span-1">
                    <FieldLabel>VAT %</FieldLabel>
                    <Input className="h-10" type="number" min={0} step="0.01" value={vatPct} onChange={(e) => setVatPct(Number(e.target.value) || 0)} />
                  </div>
                  <div className="flex min-w-0 flex-col justify-end md:col-span-2">
                    <FieldLabel htmlFor="purchase-add-line" className="invisible select-none">
                      Add line
                    </FieldLabel>
                    <Button
                      id="purchase-add-line"
                      type="button"
                      size="sm"
                      className="h-10 w-[70%] min-w-0 gap-1 px-2"
                      onClick={addLine}
                      disabled={!variants.length || !sku}
                    >
                      <RiAddLine className="size-4 shrink-0" aria-hidden />
                      <span className="truncate">Add</span>
                    </Button>
                  </div>
                </div>
              </div>

              <div className="min-w-0 space-y-3">
                <div className="overflow-x-auto rounded-xl border border-border/60 shadow-sm">
                  <table className="w-full min-w-[700px] text-sm">
                    <thead>
                      <tr className="border-b border-border/60 bg-muted/40 text-left text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                        <th className="px-3 py-2">#</th>
                        <th className="px-3 py-2">Product / SKU</th>
                        <th className="px-3 py-2 text-right">Qty</th>
                        <th className="px-3 py-2 text-right">Rate</th>
                        <th className="px-3 py-2 text-right">Disc</th>
                        <th className="px-3 py-2 text-right">VAT</th>
                        <th className="px-3 py-2 text-right">Value</th>
                        <th className="w-[1%] px-3 py-2" />
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border/40">
                      {lines.map((l, idx) => {
                        const value = round2(l.qty * l.unitPrice * (1 - l.discountPct / 100))
                        return (
                          <tr key={`${l.sku}-${idx}`} className="bg-card transition-colors hover:bg-muted/20">
                            <td className="px-3 py-2 font-mono text-xs tabular-nums text-muted-foreground">{(idx + 1) * 10}</td>
                            <td className="px-3 py-2">
                              <span className="font-medium">{l.productName}</span>
                              <span className="mt-0.5 block font-mono text-xs text-muted-foreground">{l.sku}</span>
                            </td>
                            <td className="px-3 py-2 text-right font-medium tabular-nums">{l.qty}</td>
                            <td className="px-3 py-2 text-right tabular-nums text-muted-foreground">{l.unitPrice.toFixed(2)}</td>
                            <td className="px-3 py-2 text-right tabular-nums">
                              {l.discountPct > 0 ? (
                                <span className="rounded-full bg-amber-500/10 px-1.5 py-0.5 text-[11px] font-medium text-amber-700 dark:text-amber-300">
                                  {l.discountPct}%
                                </span>
                              ) : (
                                <span className="text-muted-foreground/50">—</span>
                              )}
                            </td>
                            <td className="px-3 py-2 text-right tabular-nums text-muted-foreground">{l.vatPct}%</td>
                            <td className="px-3 py-2 text-right font-semibold tabular-nums">
                              {value.toFixed(2)}{" "}
                              <span className="ml-0.5 text-[11px] font-normal text-muted-foreground">{currency}</span>
                            </td>
                            <td className="px-3 py-2">
                              <Button type="button" variant="ghost" size="sm" className="size-7 p-0 text-muted-foreground hover:text-destructive" onClick={() => removeLine(idx)}>
                                <RiCloseLine className="size-3.5" aria-hidden />
                              </Button>
                            </td>
                          </tr>
                        )
                      })}
                      {lines.length === 0 && (
                        <tr>
                          <td className="py-8 text-center text-sm text-muted-foreground" colSpan={8}>
                            <span className="mb-1 block text-2xl opacity-20">📦</span>
                            No products yet — use the form above.
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>

                {lines.length > 0 && (
                  <div className="grid gap-2 rounded-xl border border-border/50 bg-linear-to-r from-primary/5 via-muted/20 to-muted/10 px-4 py-3 sm:grid-cols-5">
                    {[
                      { label: "Total qty", value: String(totals.qtyTotal), suffix: "" },
                      { label: "Subtotal", value: totals.gross.toFixed(2), suffix: currency },
                      { label: "After disc", value: totals.discounted.toFixed(2), suffix: currency },
                      { label: "VAT", value: totals.vat.toFixed(2), suffix: currency },
                    ].map(({ label, value, suffix }) => (
                      <div key={label} className="text-center">
                        <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">{label}</p>
                        <p className="mt-0.5 text-lg font-bold tabular-nums">
                          {value}
                          {suffix && <span className="ml-1 text-xs font-normal text-muted-foreground">{suffix}</span>}
                        </p>
                      </div>
                    ))}
                    <div className="rounded-lg bg-primary/10 px-3 py-2 text-center ring-1 ring-primary/20">
                      <p className="text-[10px] font-semibold uppercase tracking-wide text-primary/80">Net total</p>
                      <p className="mt-0.5 text-xl font-extrabold tabular-nums text-primary">
                        {totals.net.toFixed(2)} <span className="text-sm font-normal">{currency}</span>
                      </p>
                    </div>
                  </div>
                )}
              </div>
            </section>

            {/* ── Retailer (left) + Order header (right), half width each on large screens ── */}
            <div className="grid divide-y divide-border/60 lg:grid-cols-2 lg:items-stretch lg:divide-x lg:divide-y-0 lg:divide-border/60">
            {/* ── Retailer section ── */}
            <section className="flex min-h-0 min-w-0 flex-col p-0 lg:h-full">
              <div className="flex shrink-0 items-center gap-3 border-b border-border/50  px-4 py-3 sm:px-5">
                <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-primary/15 text-primary">
                  <RiStore2Line className="size-4" aria-hidden />
                </span>
                <div className="min-w-0 flex-1">
                  <SectionTitle>Retailer</SectionTitle>
                  <p className="text-[11px] text-muted-foreground">Select retailer &amp; manage their order template</p>
                </div>
                {/* {source === "odoo" ? (
                  <span className="inline-flex items-center rounded-full border border-emerald-500/30 bg-emerald-500/10 px-2.5 py-0.5 text-[11px] font-medium text-emerald-800 dark:text-emerald-200">
                    Live · Odoo
                  </span>
                ) : (
                  <span className="inline-flex items-center rounded-full border border-border/60 bg-muted/40 px-2.5 py-0.5 text-[11px] font-medium text-muted-foreground">
                    Sample data
                  </span>
                )} */}
              </div>

              <div className="flex flex-1 flex-col space-y-3 p-4 sm:p-5">
                <div>
                  <FieldLabel htmlFor="purchase-retailer-select">Select retailer</FieldLabel>
                  <div className="flex gap-2">
                    <select
                      id="purchase-retailer-select"
                      className={cn(
                        "h-10 min-w-0 flex-1 cursor-pointer rounded-xl border border-border/70 bg-background px-3 text-sm shadow-sm transition-colors",
                        "hover:border-primary/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/25"
                      )}
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
                      <option value="">Select a retailer…</option>
                      {retailers.map((r) => (
                        <option key={r.id} value={r.id}>
                          {`${r.name} · ${RETAILER_AREA_LABELS[normalizeRetailerArea(r.area)]}${
                            r.template ? " · custom template" : r.useDefaultMasterSheet ? " · default template" : ""
                          }`}
                        </option>
                      ))}
                    </select>
                    {selectedRetailerId && (
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        className="h-10 shrink-0 text-muted-foreground hover:text-destructive"
                        onClick={() => removeRetailer(selectedRetailerId)}
                      >
                        Remove
                      </Button>
                    )}
                  </div>
                </div>

                {selectedRetailerId ? (
                  <>
                    <div className={cn(
                      "flex flex-wrap items-center justify-between gap-3 rounded-xl border px-4 py-3 transition-colors",
                      selectedRetailer?.template
                        ? "border-emerald-500/30 bg-emerald-500/5"
                        : selectedRetailer?.useDefaultMasterSheet
                          ? "border-primary/25 bg-primary/5"
                          : "border-dashed border-amber-500/40 bg-amber-500/5"
                    )}>
                      <div className="min-w-0">
                        <p className={cn(
                          "text-sm font-medium",
                          selectedRetailer?.template ? "text-emerald-800 dark:text-emerald-200"
                            : selectedRetailer?.useDefaultMasterSheet ? "text-primary"
                              : "text-amber-800 dark:text-amber-200"
                        )}>
                          {selectedRetailer?.template
                            ? "Custom template attached"
                            : selectedRetailer?.useDefaultMasterSheet
                              ? "Using default master sheet"
                              : "No template — upload or use default"}
                        </p>
                        {selectedRetailer?.template && (
                          <p className="mt-0.5 font-mono text-xs text-muted-foreground">{selectedRetailer.template.fileName}</p>
                        )}
                      </div>
                      <div className="flex gap-2">
                        <input ref={fileInputRef} type="file" className="hidden" accept=".xlsx,.xls,.pdf,.csv,.doc,.docx,application/*" onChange={(e) => void onTemplateFile(e)} />
                        <Button type="button" variant="secondary" size="sm" className="gap-1.5" disabled={!selectedRetailerId} onClick={() => fileInputRef.current?.click()}>
                          <RiUploadCloud2Line className="size-3.5" aria-hidden />
                          {selectedRetailer?.template ? "Replace" : "Upload"}
                        </Button>
                        {selectedRetailer?.template && (
                          <Button type="button" variant="outline" size="sm" className="gap-1.5" onClick={downloadStoredTemplate}>
                            <RiDownloadLine className="size-3.5" aria-hidden />
                            Download
                          </Button>
                        )}
                      </div>
                    </div>
                    <OrderTemplatePreviewBlock
                      orderRef={orderRef}
                      retailerName={retailerDisplayName}
                      deliverTo={deliverTo}
                      currency={currency}
                      templateFileName={selectedRetailer?.template?.fileName ?? null}
                      templateKind={
                        selectedRetailer?.template
                          ? "custom"
                          : selectedRetailer?.useDefaultMasterSheet
                            ? "default"
                            : "none"
                      }
                    />
                  </>
                ) : retailers.length === 0 ? (
                  <div className="rounded-xl border border-dashed border-border/60 bg-muted/10 px-4 py-5 text-center">
                    <p className="text-sm font-medium">No retailers yet</p>
                    <p className="mt-1 text-xs text-muted-foreground">Add a retailer to manage their template and build orders.</p>
                    <Button type="button" size="sm" className="mt-3 gap-1.5" onClick={() => setAddRetailerOpen(true)}>
                      <RiAddLine className="size-4" aria-hidden />
                      Add first retailer
                    </Button>
                  </div>
                ) : null}
              </div>
            </section>

            {/* ── Order header — always visible (matches retailer column height) ── */}
            <section className="flex min-h-0 min-w-0 flex-col p-0 lg:h-full">
              <div className="shrink-0 border-b border-border/50 bg-muted/15 px-4 py-3 sm:px-5">
                <SectionTitle>Order header</SectionTitle>
                <p className="mt-0.5 text-[11px] text-muted-foreground">
                  Reference, dates, and terms merged into the template ·{" "}
                  {/* <span className="font-mono tabular-nums text-foreground/80">
                    {orderRef} · {orderDate} → {deliveryDate} · {currency}
                  </span> */}
                </p>
              </div>
              <div className="flex min-h-0 flex-1 flex-col overflow-y-auto">
                <div className="grid flex-1 grid-cols-1 gap-2 bg-muted/10 px-4 py-3 sm:grid-cols-2 sm:px-5 sm:py-3">
                  <div><FieldLabel>Reference</FieldLabel><Input className="h-10" value={orderRef} onChange={(e) => setOrderRef(e.target.value)} /></div>
                  <div><FieldLabel>Order date</FieldLabel><Input className="h-10" type="date" value={orderDate} onChange={(e) => setOrderDate(e.target.value)} /></div>
                  <div><FieldLabel>Delivery date</FieldLabel><Input className="h-10" type="date" value={deliveryDate} onChange={(e) => setDeliveryDate(e.target.value)} /></div>
                  <div><FieldLabel>Retailer code</FieldLabel><Input className="h-10" value={retailerCode} onChange={(e) => setRetailerCode(e.target.value)} placeholder="Optional" /></div>
                  <div className="sm:col-span-2"><FieldLabel>Deliver to</FieldLabel><Input className="h-10" value={deliverTo} onChange={(e) => setDeliverTo(e.target.value)} /></div>
                  <div><FieldLabel>Currency</FieldLabel><Input className="h-10" value={currency} onChange={(e) => setCurrency(e.target.value)} /></div>
                  <div><FieldLabel>Payment terms</FieldLabel><Input className="h-10" value={paymentTerms} onChange={(e) => setPaymentTerms(e.target.value)} /></div>
                  <div className="sm:col-span-2"><FieldLabel>Notes on printed form</FieldLabel><Input className="h-10" value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Optional" /></div>
                </div>
              </div>
            </section>
            </div>
          </Panel>
        </div>

        <div className="flex min-h-0 flex-col gap-3 lg:col-span-4 lg:sticky lg:top-4 lg:max-h-[calc(100dvh-5rem)] lg:self-start">
          <div className="shrink-0">
            <RetailerOrderAiSuggestions
              retailerId={selectedRetailerId}
              retailerName={selectedRetailer?.name ?? ""}
              retailerArea={selectedRetailer?.area}
              lineSkus={lineSkus}
              variants={variants}
              onAddSuggested={addSuggestedLine}
              compact
              sidebar
            />
          </div>
          <PurchasePreviousOrdersPanel
            retailerId={selectedRetailerId}
            retailerName={selectedRetailer?.name ?? ""}
          />

          {lines.length > 0 && stock.length > 0 && (
            <Panel className="shrink-0 overflow-hidden border-border/60 p-0 shadow-sm">
              <div className="border-b border-border/50 bg-muted/25 px-4 py-2.5">
                <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Stock vs order</p>
              </div>
              <ul className="divide-y divide-border/40">
                {stock.map((s) => (
                  <li key={s.sku} className={cn("flex items-center justify-between gap-2 px-4 py-2 text-xs", s.ok ? "bg-emerald-500/3" : "bg-rose-500/3")}>
                    <span className="font-mono text-[11px] text-foreground">{s.sku}</span>
                    <span className={cn("rounded-full px-2 py-0.5 text-[11px] font-semibold tabular-nums", s.ok ? "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300" : "bg-rose-500/15 text-rose-700 dark:text-rose-300")}>
                      {s.ok ? `✓ ${s.available}` : `−${s.requested - s.available}`}
                    </span>
                  </li>
                ))}
              </ul>
            </Panel>
          )}
        </div>
      </div>

      <Dialog.Root
        open={addRetailerOpen}
        onOpenChange={(open) => {
          setAddRetailerOpen(open)
          if (!open) resetAddRetailerForm()
        }}
      >
        <Dialog.Portal>
          <Dialog.Overlay className="data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 fixed inset-0 z-50 bg-black/50 backdrop-blur-[1px] data-[state=closed]:animate-out data-[state=open]:animate-in" />
          <Dialog.Content className="data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95 fixed left-1/2 top-1/2 z-50 max-h-[min(90vh,calc(100dvh-2rem))] w-[calc(100%-1.5rem)] max-w-lg -translate-x-1/2 -translate-y-1/2 overflow-y-auto rounded-2xl border border-border/80 bg-card p-5 shadow-xl duration-200 data-[state=closed]:animate-out data-[state=open]:animate-in sm:p-6">
            <div className="flex items-start justify-between gap-3">
              <Dialog.Title className="text-lg font-semibold tracking-tight text-foreground">Add retailer</Dialog.Title>
              <Dialog.Close asChild>
                <Button type="button" variant="ghost" size="icon" className="size-9 shrink-0 rounded-xl" aria-label="Close">
                  <RiCloseLine className="size-5" aria-hidden />
                </Button>
              </Dialog.Close>
            </div>
            <Dialog.Description className="mt-1 text-sm text-muted-foreground">
              Name this retailer and attach their order template, or use the default master sheet.
            </Dialog.Description>

            <div className="mt-5 space-y-4">
              <div>
                <FieldLabel htmlFor="add-retailer-name">Retailer name</FieldLabel>
                <Input
                  id="add-retailer-name"
                  autoComplete="organization"
                  placeholder="e.g. City Toys — Marina"
                  className="h-11 rounded-xl"
                  value={newRetailerName}
                  onChange={(e) => setNewRetailerName(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") { e.preventDefault(); void submitAddRetailer() }
                  }}
                />
              </div>

              <div>
                <FieldLabel htmlFor="add-retailer-area">Retailer area</FieldLabel>
                <select
                  id="add-retailer-area"
                  className="h-11 w-full cursor-pointer rounded-xl border border-border/70 bg-background px-3 text-sm shadow-sm outline-none focus-visible:ring-2 focus-visible:ring-primary/25"
                  value={newRetailerArea}
                  onChange={(e) => setNewRetailerArea(e.target.value as RetailerArea)}
                >
                  {(Object.keys(RETAILER_AREA_LABELS) as RetailerArea[]).map((key) => (
                    <option key={key} value={key}>
                      {RETAILER_AREA_LABELS[key]}
                    </option>
                  ))}
                </select>
                <p className="mt-1 text-[11px] text-muted-foreground">
                  Matches RSP channels (UAE shelf, Region, or Saudi) for quotes and planning.
                </p>
              </div>

              <label
                className={cn(
                  "flex cursor-pointer items-start gap-3 rounded-xl border p-3.5 text-sm transition-colors",
                  addRetailerUseDefault ? "border-primary/45 bg-primary/8 ring-1 ring-primary/15" : "border-border/70 bg-muted/10 hover:bg-muted/20"
                )}
              >
                <input
                  type="checkbox"
                  checked={addRetailerUseDefault}
                  onChange={(e) => {
                    const on = e.target.checked
                    setAddRetailerUseDefault(on)
                    if (on) {
                      setAddRetailerTemplateFile(null)
                      setDialogTemplateDrag(false)
                      if (addRetailerTemplateInputRef.current) addRetailerTemplateInputRef.current.value = ""
                    }
                  }}
                  className="mt-0.5 size-4 shrink-0 rounded border-input accent-primary"
                />
                <span className="min-w-0">
                  <span className="font-medium text-foreground">Use default master sheet</span>
                  <span className="mt-1 block text-xs leading-relaxed text-muted-foreground">
                    Use if they don&apos;t have their own file — orders merge into{" "}
                    <span className="font-medium text-foreground">{DEFAULT_MASTER_SHEET_NAME}</span>.
                  </span>
                </span>
              </label>

              <div className={cn(addRetailerUseDefault && "pointer-events-none opacity-50")}>
                <FieldLabel>Their order template</FieldLabel>
                <input
                  ref={addRetailerTemplateInputRef}
                  type="file"
                  className="hidden"
                  accept=".xlsx,.xls,.pdf,.csv,.doc,.docx,application/*"
                  disabled={addRetailerUseDefault}
                  onChange={(e) => { const f = e.target.files?.[0] ?? null; e.target.value = ""; ingestAddRetailerTemplateFile(f) }}
                />
                <div
                  role="button"
                  tabIndex={addRetailerUseDefault ? -1 : 0}
                  aria-disabled={addRetailerUseDefault}
                  onKeyDown={(e) => { if (addRetailerUseDefault) return; if (e.key === "Enter" || e.key === " ") { e.preventDefault(); addRetailerTemplateInputRef.current?.click() } }}
                  onDragEnter={(e) => { e.preventDefault(); if (!addRetailerUseDefault) setDialogTemplateDrag(true) }}
                  onDragOver={(e) => { e.preventDefault(); if (!addRetailerUseDefault) setDialogTemplateDrag(true) }}
                  onDragLeave={(e) => { e.preventDefault(); if (!e.currentTarget.contains(e.relatedTarget as Node)) setDialogTemplateDrag(false) }}
                  onDrop={(e) => { e.preventDefault(); setDialogTemplateDrag(false); if (addRetailerUseDefault) return; const f = e.dataTransfer.files?.[0] ?? null; ingestAddRetailerTemplateFile(f) }}
                  onClick={() => !addRetailerUseDefault && addRetailerTemplateInputRef.current?.click()}
                  className={cn(
                    "group cursor-pointer rounded-2xl border-2 border-dashed px-3 py-5 text-center transition-all duration-200",
                    addRetailerUseDefault
                      ? "cursor-not-allowed border-border/40 bg-muted/10"
                      : dialogTemplateDrag
                        ? "border-primary/55 bg-primary/8 shadow-md ring-2 ring-primary/20"
                        : "border-border/70 bg-linear-to-b from-muted/25 to-muted/10 hover:border-primary/40 hover:shadow-sm"
                  )}
                >
                  <span className="mx-auto flex size-12 items-center justify-center rounded-xl bg-background/80 shadow-sm ring-1 ring-border/50 transition-transform group-hover:scale-[1.02]">
                    {addRetailerBusy ? (
                      <RiLoader4Line className="size-7 animate-spin text-primary" aria-hidden />
                    ) : (
                      <RiUploadCloud2Line className="size-7 text-primary/80" aria-hidden />
                    )}
                  </span>
                  <p className="mt-3 text-xs font-semibold text-foreground">
                    {addRetailerTemplateFile ? addRetailerTemplateFile.name : "Drop order template here"}
                  </p>
                  <p className="mt-1 text-[11px] text-muted-foreground">PDF, Excel, or CSV · same file they send you</p>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="mt-3 h-8 border-border/80 bg-background/90 text-xs"
                    disabled={addRetailerUseDefault || addRetailerBusy}
                    onClick={(e) => { e.stopPropagation(); addRetailerTemplateInputRef.current?.click() }}
                  >
                    Browse files
                  </Button>
                </div>
              </div>
            </div>

            <div className="mt-6 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end sm:gap-3">
              <Dialog.Close asChild>
                <Button type="button" variant="outline" className="rounded-xl sm:min-w-[100px]">Cancel</Button>
              </Dialog.Close>
              <Button type="button" className="gap-2 rounded-xl sm:min-w-[120px]" disabled={addRetailerBusy} onClick={() => void submitAddRetailer()}>
                {addRetailerBusy ? (
                  <><RiLoader4Line className="size-4 shrink-0 animate-spin" aria-hidden />Saving…</>
                ) : "Save retailer"}
              </Button>
            </div>
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog.Root>
    </div>
  )
}

export default Purchase
