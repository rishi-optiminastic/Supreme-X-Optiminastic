const KEY = "supreme-odoo-po-draft-v1"

export type PoDraftLine = {
  sku: string
  productName: string
  odooProductId: number | null
  qty: number
}

export type PoDraft = {
  lines: PoDraftLine[]
  savedAtIso: string
  templateLabel?: string
}

export function loadPoDraft(): PoDraft | null {
  if (typeof window === "undefined") return null
  try {
    const raw = window.localStorage.getItem(KEY)
    if (!raw) return null
    const p = JSON.parse(raw) as PoDraft
    if (!p?.lines || !Array.isArray(p.lines)) return null
    return p
  } catch {
    return null
  }
}

export function savePoDraft(lines: PoDraftLine[], templateLabel?: string) {
  if (typeof window === "undefined") return
  const draft: PoDraft = {
    lines,
    savedAtIso: new Date().toISOString(),
    templateLabel,
  }
  try {
    window.localStorage.setItem(KEY, JSON.stringify(draft))
  } catch {
    /* ignore */
  }
}

export function clearPoDraft() {
  if (typeof window === "undefined") return
  try {
    window.localStorage.removeItem(KEY)
  } catch {
    /* ignore */
  }
}
