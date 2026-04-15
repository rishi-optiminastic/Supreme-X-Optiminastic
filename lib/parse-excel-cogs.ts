import * as XLSX from "xlsx"

/**
 * Reads COGS from the first worksheet: looks for a column named like COGS/cost,
 * or falls back to the first numeric column per row.
 */
export function parseExcelCogs(buffer: ArrayBuffer): { label: string; cogs: number }[] {
  const wb = XLSX.read(buffer, { type: "array" })
  const name = wb.SheetNames[0]
  if (!name) return []
  const sheet = wb.Sheets[name]
  const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, { defval: "" })
  const out: { label: string; cogs: number }[] = []
  const cogsKeyRe = /^(cogs?|cost|unit\s*cost|ex[.\s-]?factory|cogs\s*\(inr\))/i

  for (const row of rows) {
    const keys = Object.keys(row)
    let cogsKey = keys.find((k) => cogsKeyRe.test(k.trim()))
    if (!cogsKey) {
      for (const k of keys) {
        const v = row[k]
        const n = toNum(v)
        if (n != null && n > 0) {
          cogsKey = k
          break
        }
      }
    }
    if (!cogsKey) continue
    const n = toNum(row[cogsKey])
    if (n == null || n <= 0) continue
    const labelKey = keys.find((k) => /^(name|label|sku|product|item)/i.test(k.trim()))
    const label = labelKey ? String(row[labelKey] ?? "").trim() : ""
    out.push({ label: label || `Line ${out.length + 1}`, cogs: n })
  }
  return out
}

function toNum(v: unknown): number | null {
  if (typeof v === "number" && Number.isFinite(v)) return v
  if (typeof v === "string") {
    const t = v.replace(/,/g, "").trim()
    if (!t) return null
    const n = Number.parseFloat(t)
    return Number.isFinite(n) ? n : null
  }
  return null
}
