/** DTO aligned with client `InventoryVariant` — keep server free of "use client" imports */

export type OdooVariantDTO = {
  id: string
  productName: string
  sku: string
  attributes: string
  onHand: number
  reserved: number
  inbound: number
  weeksCover: number
  trendScore: number
  /** Odoo `image_128` as data URL, or omitted when missing */
  imageUrl?: string
}

export type OdooOrderDTO = {
  id: string
  customer: string
  amount: string
  status: string
}
