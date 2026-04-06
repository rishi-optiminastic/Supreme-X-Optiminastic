import { odooImageFieldToDataUrl } from "@/lib/odoo/image"
import type { OdooOrderDTO, OdooVariantDTO } from "@/lib/odoo/types"

type OdooProduct = Record<string, unknown>

export function mapOdooProductToVariant(
  p: OdooProduct,
  index: number
): OdooVariantDTO {
  const numericId =
    typeof p.id === "number" ? p.id : Number.parseInt(String(p.id ?? ""), 10)
  const id = String(p.id ?? index)
  const name = String(p.name ?? "Product").split("\n")[0]?.slice(0, 120) ?? "Product"
  const sku =
    String(p.default_code ?? p.barcode ?? "").trim() || `ID-${p.id ?? index}`

  const qty = toNum(p.qty_available ?? p.free_qty ?? 0)
  const incoming = toNum(p.incoming_qty ?? 0)
  const outgoing = toNum(p.outgoing_qty ?? 0)
  const reserved = Math.max(0, Math.round(outgoing))
  const onHand = Math.max(0, Math.round(qty))

  const denom = Math.max(6, reserved + 10)
  const weeksCover =
    onHand > 0
      ? Math.min(12, Math.max(0.2, Math.round((onHand / denom) * 10) / 10))
      : 0.4

  const trendScore = Math.min(
    100,
    Math.max(
      22,
      Math.round(
        38 +
          (onHand % 41) +
          (incoming > 0 ? 12 : 0) -
          (weeksCover < 1 ? 0 : 0) +
          (weeksCover < 1.2 ? 18 : 0)
      )
    )
  )

  const attr =
    typeof p.description_sale === "string" && p.description_sale.trim()
      ? String(p.description_sale).slice(0, 72)
      : "Stockable"

  const imageUrl = odooImageFieldToDataUrl(p.image_128 ?? p.image_variant_128)

  const dto: OdooVariantDTO = {
    id: `odoo-${id}`,
    productName: name,
    sku,
    attributes: attr,
    onHand,
    reserved,
    inbound: Math.max(0, Math.round(incoming)),
    weeksCover,
    trendScore,
  }
  if (imageUrl) dto.imageUrl = imageUrl
  if (Number.isFinite(numericId) && numericId > 0) dto.odooProductId = numericId
  return dto
}

function toNum(v: unknown): number {
  if (typeof v === "number" && !Number.isNaN(v)) return v
  if (typeof v === "string") {
    const n = parseFloat(v)
    return Number.isNaN(n) ? 0 : n
  }
  return 0
}

export function mapOdooSaleOrder(o: Record<string, unknown>): OdooOrderDTO {
  const name = String(o.name ?? "SO")
  const partner = o.partner_id
  let customer = "Customer"
  if (Array.isArray(partner) && partner[1]) {
    customer = String(partner[1])
  } else if (typeof partner === "string") {
    customer = partner
  }
  const total = toNum(o.amount_total)
  const state = String(o.state ?? "draft")
  const status =
    state === "done"
      ? "Shipped"
      : state === "sale"
        ? "Confirmed"
        : state === "sent"
          ? "Quoted"
          : state === "cancel"
            ? "Cancelled"
            : "Draft"

  return {
    id: name,
    customer: customer.slice(0, 80),
    amount:
      total > 0
        ? new Intl.NumberFormat(undefined, {
            style: "currency",
            currency: "USD",
            maximumFractionDigits: 0,
          }).format(total)
        : "—",
    status,
  }
}
