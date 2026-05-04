const KEY = "supreme-odoo-po-draft-v1"
const HISTORY_KEY = "supreme-odoo-retailer-order-history-v1"
const MAX_HISTORY_TOTAL = 400

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

export type RetailerOrderHistoryEntry = {
  id: string
  retailerId: string
  savedAtIso: string
  templateLabel?: string
  lines: PoDraftLine[]
}

type HistoryFile = {
  entries: RetailerOrderHistoryEntry[]
}

function newHistoryId() {
  try {
    if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
      return crypto.randomUUID()
    }
  } catch {
    /* ignore */
  }
  return `h-${Date.now()}-${Math.random().toString(36).slice(2, 11)}`
}

function loadHistoryFile(): HistoryFile {
  if (typeof window === "undefined") return { entries: [] }
  try {
    const raw = window.localStorage.getItem(HISTORY_KEY)
    if (!raw) return { entries: [] }
    const p = JSON.parse(raw) as HistoryFile
    if (!p?.entries || !Array.isArray(p.entries)) return { entries: [] }
    return { entries: p.entries.filter((e) => e && typeof e.retailerId === "string" && Array.isArray(e.lines)) }
  } catch {
    return { entries: [] }
  }
}

function persistHistoryFile(file: HistoryFile) {
  if (typeof window === "undefined") return
  const trimmed =
    file.entries.length > MAX_HISTORY_TOTAL
      ? file.entries.slice(file.entries.length - MAX_HISTORY_TOTAL)
      : file.entries
  try {
    window.localStorage.setItem(HISTORY_KEY, JSON.stringify({ entries: trimmed }))
  } catch {
    /* ignore */
  }
}

/** Saved orders for a retailer (newest first), from Order creation “Save draft”. */
export function loadRetailerOrderHistory(retailerId: string): RetailerOrderHistoryEntry[] {
  const { entries } = loadHistoryFile()
  return entries
    .filter((e) => e.retailerId === retailerId)
    .sort((a, b) => String(b.savedAtIso).localeCompare(String(a.savedAtIso)))
}

function appendHistoryEntry(entry: RetailerOrderHistoryEntry) {
  const { entries } = loadHistoryFile()
  entries.push(entry)
  persistHistoryFile({ entries })
  try {
    if (typeof window !== "undefined") {
      window.dispatchEvent(new CustomEvent("supreme-odoo-retailer-history-updated"))
    }
  } catch {
    /* ignore */
  }
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

export function savePoDraft(
  lines: PoDraftLine[],
  templateLabel?: string,
  /** When set, a copy is kept in per-retailer order history (RSP sidebar). */
  retailerId?: string | null
) {
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
  if (retailerId && lines.length > 0) {
    appendHistoryEntry({
      id: newHistoryId(),
      retailerId,
      savedAtIso: draft.savedAtIso,
      templateLabel,
      lines: lines.map((l) => ({ ...l })),
    })
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
