"use client"

import * as React from "react"
import {
  RiAddLine,
  RiArrowDownSLine,
  RiCloseLine,
  RiDownloadLine,
  RiLoader4Line,
  RiMailLine,
  RiPrinterLine,
  RiStore2Line,
  RiUploadCloud2Line,
} from "@remixicon/react"
import { Dialog } from "radix-ui"

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
  const addRetailerTemplateInputRef = React.useRef<HTMLInputElement>(null)

  const [addRetailerOpen, setAddRetailerOpen] = React.useState(false)
  const [newRetailerName, setNewRetailerName] = React.useState("")
  const [addRetailerUseDefault, setAddRetailerUseDefault] = React.useState(false)
  const [addRetailerTemplateFile, setAddRetailerTemplateFile] = React.useState<File | null>(null)
  const [dialogTemplateDrag, setDialogTemplateDrag] = React.useState(false)
  const [addRetailerBusy, setAddRetailerBusy] = React.useState(false)

  const resetAddRetailerForm = React.useCallback(() => {
    setNewRetailerName("")
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
  const [orderHeaderOpen, setOrderHeaderOpen] = React.useState(false)

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

        {/* ─── Left: retailer + header + lines ─── */}
        <div className="space-y-4 lg:col-span-9">
          <Panel className="divide-y divide-border/60 overflow-hidden p-0 shadow-md ring-1 ring-black/5 dark:ring-white/5">

            {/* ── Retailer section ── */}
            <section className="p-0">
              <div className="flex items-center gap-3 border-b border-border/50 bg-gradient-to-r from-primary/8 via-primary/4 to-transparent px-5 py-3.5">
                <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-primary/15 text-primary">
                  <RiStore2Line className="size-4" aria-hidden />
                </span>
                <div className="min-w-0 flex-1">
                  <SectionTitle>Retailer</SectionTitle>
                  <p className="text-[11px] text-muted-foreground">Select retailer &amp; manage their order template</p>
                </div>
                {source === "odoo" ? (
                  <span className="inline-flex items-center rounded-full border border-emerald-500/30 bg-emerald-500/10 px-2.5 py-0.5 text-[11px] font-medium text-emerald-800 dark:text-emerald-200">
                    Live · Odoo
                  </span>
                ) : (
                  <span className="inline-flex items-center rounded-full border border-border/60 bg-muted/40 px-2.5 py-0.5 text-[11px] font-medium text-muted-foreground">
                    Sample data
                  </span>
                )}
              </div>

              <div className="space-y-3 p-4 sm:p-5">
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
                          {r.name}{r.template ? " · custom template" : r.useDefaultMasterSheet ? " · default template" : ""}
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

            {/* ── Order header — collapsible ── */}
            <section className="p-0">
              <button
                type="button"
                className="flex w-full items-center justify-between gap-3 px-5 py-3.5 text-left transition-colors hover:bg-muted/25"
                aria-expanded={orderHeaderOpen}
                onClick={() => setOrderHeaderOpen((o) => !o)}
              >
                <div className="flex items-center gap-3">
                  <div className={cn(
                    "flex size-6 shrink-0 items-center justify-center rounded-md text-xs font-bold transition-colors",
                    orderHeaderOpen ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"
                  )}>
                    {orderHeaderOpen ? "−" : "+"}
                  </div>
                  <div>
                    <SectionTitle>Order header</SectionTitle>
                    <p className="mt-0.5 text-[11px] text-muted-foreground">
                      {orderRef} · {orderDate} → {deliveryDate} · {currency}
                    </p>
                  </div>
                </div>
                <RiArrowDownSLine className={cn("size-5 shrink-0 text-muted-foreground transition-transform duration-200", orderHeaderOpen && "rotate-180")} aria-hidden />
              </button>
              {orderHeaderOpen && (
                <div className="grid gap-3 border-t border-border/60 bg-muted/10 px-5 pb-5 pt-4 sm:grid-cols-2 lg:grid-cols-4">
                  <div><FieldLabel>Reference</FieldLabel><Input className="h-10" value={orderRef} onChange={(e) => setOrderRef(e.target.value)} /></div>
                  <div><FieldLabel>Order date</FieldLabel><Input className="h-10" type="date" value={orderDate} onChange={(e) => setOrderDate(e.target.value)} /></div>
                  <div><FieldLabel>Delivery date</FieldLabel><Input className="h-10" type="date" value={deliveryDate} onChange={(e) => setDeliveryDate(e.target.value)} /></div>
                  <div><FieldLabel>Retailer code</FieldLabel><Input className="h-10" value={retailerCode} onChange={(e) => setRetailerCode(e.target.value)} placeholder="Optional" /></div>
                  <div className="sm:col-span-2"><FieldLabel>Deliver to</FieldLabel><Input className="h-10" value={deliverTo} onChange={(e) => setDeliverTo(e.target.value)} /></div>
                  <div><FieldLabel>Currency</FieldLabel><Input className="h-10" value={currency} onChange={(e) => setCurrency(e.target.value)} /></div>
                  <div><FieldLabel>Payment terms</FieldLabel><Input className="h-10" value={paymentTerms} onChange={(e) => setPaymentTerms(e.target.value)} /></div>
                  <div className="sm:col-span-2 lg:col-span-4"><FieldLabel>Notes on printed form</FieldLabel><Input className="h-10" value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Optional" /></div>
                </div>
              )}
            </section>

            {/* ── Line items ── */}
            <section className="space-y-4 p-4 sm:p-5">
              <div className="flex items-center justify-between">
                <div>
                  <SectionTitle>Line items</SectionTitle>
                  <p className="mt-0.5 text-[11px] text-muted-foreground">Add products — value is computed automatically per line</p>
                </div>
                {lines.length > 0 && (
                  <span className="rounded-full bg-primary/10 px-2.5 py-0.5 text-xs font-semibold tabular-nums text-primary">
                    {lines.length} line{lines.length === 1 ? "" : "s"}
                  </span>
                )}
              </div>

              {/* Add-a-line form */}
              <div className="rounded-xl border border-border/60 bg-gradient-to-b from-muted/20 to-muted/5 p-4">
                <p className="mb-3 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Add product</p>
                <div className="grid gap-3 md:grid-cols-12 md:items-end">
                  <div className="md:col-span-5">
                    <FieldLabel>Product</FieldLabel>
                    <select
                      className="h-10 w-full rounded-lg border border-input bg-background px-3 text-sm shadow-sm transition-colors hover:border-primary/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/25"
                      value={sku}
                      onChange={(e) => setSku(e.target.value)}
                    >
                      {variants.map((v) => (
                        <option key={v.id} value={v.sku}>{v.sku} — {v.productName}</option>
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
                  <div className="md:col-span-1">
                    <Button type="button" size="sm" className="h-10 w-full gap-1" onClick={addLine}>
                      <RiAddLine className="size-4" aria-hidden />
                      Add
                    </Button>
                  </div>
                </div>
              </div>

              {/* Lines table */}
              <div className="overflow-x-auto rounded-xl border border-border/60 shadow-sm">
                <table className="w-full min-w-[700px] text-sm">
                  <thead>
                    <tr className="border-b border-border/60 bg-muted/40 text-left text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                      <th className="px-3 py-2.5">#</th>
                      <th className="px-3 py-2.5">Product / SKU</th>
                      <th className="px-3 py-2.5 text-right">Qty</th>
                      <th className="px-3 py-2.5 text-right">Rate</th>
                      <th className="px-3 py-2.5 text-right">Disc</th>
                      <th className="px-3 py-2.5 text-right">VAT</th>
                      <th className="px-3 py-2.5 text-right">Value</th>
                      <th className="w-[1%] px-3 py-2.5" />
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border/40">
                    {lines.map((l, idx) => {
                      const value = round2(l.qty * l.unitPrice * (1 - l.discountPct / 100))
                      return (
                        <tr key={`${l.sku}-${idx}`} className="bg-card transition-colors hover:bg-muted/20">
                          <td className="px-3 py-2.5 font-mono text-xs tabular-nums text-muted-foreground">{(idx + 1) * 10}</td>
                          <td className="px-3 py-2.5">
                            <span className="font-medium">{l.productName}</span>
                            <span className="mt-0.5 block font-mono text-xs text-muted-foreground">{l.sku}</span>
                          </td>
                          <td className="px-3 py-2.5 text-right font-medium tabular-nums">{l.qty}</td>
                          <td className="px-3 py-2.5 text-right tabular-nums text-muted-foreground">{l.unitPrice.toFixed(2)}</td>
                          <td className="px-3 py-2.5 text-right tabular-nums">
                            {l.discountPct > 0 ? (
                              <span className="rounded-full bg-amber-500/10 px-1.5 py-0.5 text-[11px] font-medium text-amber-700 dark:text-amber-300">
                                {l.discountPct}%
                              </span>
                            ) : <span className="text-muted-foreground/50">—</span>}
                          </td>
                          <td className="px-3 py-2.5 text-right tabular-nums text-muted-foreground">{l.vatPct}%</td>
                          <td className="px-3 py-2.5 text-right font-semibold tabular-nums">
                            {value.toFixed(2)} <span className="ml-0.5 text-[11px] font-normal text-muted-foreground">{currency}</span>
                          </td>
                          <td className="px-3 py-2.5">
                            <Button type="button" variant="ghost" size="sm" className="size-7 p-0 text-muted-foreground hover:text-destructive" onClick={() => removeLine(idx)}>
                              <RiCloseLine className="size-3.5" aria-hidden />
                            </Button>
                          </td>
                        </tr>
                      )
                    })}
                    {lines.length === 0 && (
                      <tr>
                        <td className="py-12 text-center text-sm text-muted-foreground" colSpan={8}>
                          <span className="block text-3xl opacity-20 mb-2">📦</span>
                          No products yet — use the form above to add line items.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>

              {/* Totals bar */}
              {lines.length > 0 && (
                <div className="grid gap-2 rounded-xl border border-border/50 bg-gradient-to-r from-primary/5 via-muted/20 to-muted/10 px-4 py-3 sm:grid-cols-5">
                  {[
                    { label: "Total qty", value: String(totals.qtyTotal), suffix: "" },
                    { label: "Subtotal", value: totals.gross.toFixed(2), suffix: currency },
                    { label: "After disc", value: totals.discounted.toFixed(2), suffix: currency },
                    { label: "VAT", value: totals.vat.toFixed(2), suffix: currency },
                  ].map(({ label, value, suffix }) => (
                    <div key={label} className="text-center">
                      <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">{label}</p>
                      <p className="mt-0.5 text-lg font-bold tabular-nums">
                        {value}{suffix && <span className="ml-1 text-xs font-normal text-muted-foreground">{suffix}</span>}
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
            </section>
          </Panel>
        </div>

        {/* ─── Right: finish order sidebar ─── */}
        <div className="space-y-3 lg:col-span-3">
          <Panel className="overflow-hidden border-border/60 p-0 shadow-md ring-1 ring-black/5 dark:ring-white/5 lg:sticky lg:top-4">
            <div className="border-b border-border/50 bg-gradient-to-r from-primary/8 to-transparent px-4 py-3">
              <h2 className="text-sm font-semibold">Finish order</h2>
              <p className="text-[11px] text-muted-foreground">
                {selectedRetailer ? selectedRetailer.name : "Select a retailer first"}
                {lines.length > 0 ? ` · ${lines.length} line${lines.length === 1 ? "" : "s"}` : ""}
              </p>
            </div>
            <div className="space-y-2 p-3">
              {([
                {
                  icon: <RiMailLine className="size-4" aria-hidden />,
                  label: "Mail summary",
                  detail: "Send order details via email",
                  onClick: mailOrderSummary,
                  active: canMail,
                  accent: true,
                },
                {
                  icon: <RiDownloadLine className="size-4" aria-hidden />,
                  label: outputBusy ? "Working…" : "Download filled file",
                  detail: "Merged into retailer template",
                  onClick: () => void downloadFilledFromTemplate(),
                  active: Boolean(lines.length && hasTemplateForOutput && !outputBusy),
                  accent: false,
                },
                {
                  icon: <RiPrinterLine className="size-4" aria-hidden />,
                  label: outputBusy ? "Working…" : "Print / Save PDF",
                  detail: "Open print dialog or save PDF",
                  onClick: () => void printOrSaveFilledPdf(),
                  active: Boolean(lines.length && hasTemplateForOutput && !outputBusy),
                  accent: false,
                },
              ] as Array<{ icon: React.ReactNode; label: string; detail: string; onClick: () => void; active: boolean; accent: boolean }>).map(({ icon, label, detail, onClick, active, accent }) => (
                <button
                  key={label}
                  type="button"
                  disabled={!active}
                  onClick={onClick}
                  className={cn(
                    "flex w-full items-center gap-3 rounded-xl border px-4 py-3 text-left transition-all",
                    active
                      ? accent
                        ? "cursor-pointer border-primary/25 bg-primary/8 hover:bg-primary/12"
                        : "cursor-pointer border-border/60 bg-card hover:bg-muted/25"
                      : "cursor-not-allowed border-border/40 bg-muted/10 opacity-50"
                  )}
                >
                  <span className={cn(
                    "flex size-9 shrink-0 items-center justify-center rounded-lg",
                    active && accent ? "bg-primary/15 text-primary" : "bg-muted text-muted-foreground"
                  )}>
                    {icon}
                  </span>
                  <div className="min-w-0">
                    <p className="text-sm font-medium">{label}</p>
                    <p className="text-[11px] text-muted-foreground">{detail}</p>
                  </div>
                </button>
              ))}
            </div>

            {(!selectedRetailerId || !hasTemplateForOutput || !lines.length) && (
              <div className="border-t border-border/50 px-4 py-3">
                <p className="text-[11px] text-muted-foreground">
                  {!selectedRetailerId
                    ? "① Select a retailer to enable mail and download."
                    : !hasTemplateForOutput
                      ? "② Add a template to this retailer (or use default master) to enable download."
                      : "③ Add at least one line to enable output."}
                </p>
              </div>
            )}

            {lines.length > 0 && (
              <div className="border-t border-border/50 p-3">
                <p className="mb-2 text-[11px] font-medium text-muted-foreground">No template? Use our layout:</p>
                <Button type="button" variant="ghost" size="sm" className="h-8 w-full justify-center gap-1.5 text-xs" onClick={downloadFallbackSupremeHtml}>
                  <RiDownloadLine className="mr-1.5 size-3.5" aria-hidden />
                  Supreme HTML order
                </Button>
              </div>
            )}
          </Panel>

          {lines.length > 0 && stock.length > 0 && (
            <Panel className="overflow-hidden border-border/60 p-0 shadow-sm">
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

      {/* ── Add Retailer dialog ── */}
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
