/** Odoo `search_read` returns `false` or base64 PNG/JPEG bytes for image_* fields. */
export function odooImageFieldToDataUrl(value: unknown): string | undefined {
  if (value === false || value == null) return undefined
  if (typeof value !== "string") return undefined
  const b64 = value.trim()
  if (!b64) return undefined
  if (b64.startsWith("data:")) return b64
  return `data:image/png;base64,${b64}`
}
