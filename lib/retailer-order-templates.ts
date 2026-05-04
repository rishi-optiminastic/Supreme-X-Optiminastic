const KEY = "supreme-odoo-retailer-order-templates-v1"

/** Trading / pricing region for the retailer (matches RSP channel columns). */
export type RetailerArea = "uae" | "region" | "saudi"

export const RETAILER_AREA_LABELS: Record<RetailerArea, string> = {
  uae: "UAE",
  region: "Region",
  saudi: "Saudi",
}

export function normalizeRetailerArea(v: unknown): RetailerArea {
  return v === "region" || v === "saudi" || v === "uae" ? v : "uae"
}

export type StoredTemplateFile = {
  fileName: string
  mimeType: string
  /** Base64 (no data: prefix) */
  dataBase64: string
  storedAtIso: string
}

export type RetailerOrderProfile = {
  id: string
  name: string
  /** Where they trade; defaults to UAE when missing (older saved profiles). */
  area?: RetailerArea
  createdAtIso: string
  template: StoredTemplateFile | null
  /** When true and template is null, filled exports use the built-in master workbook in /public. */
  useDefaultMasterSheet?: boolean
}

export type RetailerTemplatesState = {
  retailers: RetailerOrderProfile[]
  selectedRetailerId: string | null
}

const MAX_TEMPLATE_BYTES = 1_800_000

function safeParse(raw: string | null): RetailerTemplatesState | null {
  if (!raw) return null
  try {
    const p = JSON.parse(raw) as RetailerTemplatesState
    if (!p || !Array.isArray(p.retailers)) return null
    return p
  } catch {
    return null
  }
}

export function loadRetailerTemplatesState(): RetailerTemplatesState {
  if (typeof window === "undefined") {
    return { retailers: [], selectedRetailerId: null }
  }
  const parsed = safeParse(window.localStorage.getItem(KEY))
  const base = parsed ?? { retailers: [], selectedRetailerId: null }
  return {
    retailers: Array.isArray(base.retailers) ? base.retailers : [],
    selectedRetailerId:
      typeof base.selectedRetailerId === "string" || base.selectedRetailerId === null
        ? base.selectedRetailerId
        : null,
  }
}

export function persistRetailerTemplatesState(next: RetailerTemplatesState): boolean {
  if (typeof window === "undefined") return true
  try {
    window.localStorage.setItem(KEY, JSON.stringify(next))
    return true
  } catch {
    return false
  }
}

export function newRetailerId() {
  try {
    if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
      return crypto.randomUUID()
    }
  } catch {
    /* non-secure context or blocked API */
  }
  return `r-${Date.now()}-${Math.random().toString(36).slice(2, 11)}`
}

/** Returns error message or null if ok */
export function validateTemplateFile(file: File): string | null {
  if (file.size > MAX_TEMPLATE_BYTES) {
    return `File is too large for browser storage (max ~${Math.round(MAX_TEMPLATE_BYTES / 1024)} KB). Use a smaller file or store it elsewhere.`
  }
  return null
}

export async function fileToStoredTemplate(file: File): Promise<StoredTemplateFile> {
  const buf = await file.arrayBuffer()
  let binary = ""
  const bytes = new Uint8Array(buf)
  const chunk = 8192
  for (let i = 0; i < bytes.length; i += chunk) {
    const slice = bytes.subarray(i, i + chunk)
    binary += String.fromCharCode.apply(null, slice as unknown as number[])
  }
  const dataBase64 = btoa(binary)
  return {
    fileName: file.name,
    mimeType: file.type || "application/octet-stream",
    dataBase64,
    storedAtIso: new Date().toISOString(),
  }
}

export function storedTemplateToBlob(t: StoredTemplateFile): Blob {
  const bin = atob(t.dataBase64)
  const arr = new Uint8Array(bin.length)
  for (let i = 0; i < bin.length; i++) arr[i] = bin.charCodeAt(i)
  return new Blob([arr], { type: t.mimeType })
}
