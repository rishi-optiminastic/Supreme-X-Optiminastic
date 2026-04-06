/** Shared shape for demo + Odoo product rows in the UI. */
export type InventoryVariant = {
  id: string
  productName: string
  sku: string
  attributes: string
  onHand: number
  reserved: number
  inbound: number
  weeksCover: number
  trendScore: number
  imageUrl?: string
  /** Filled when Odoo returns 90d line totals. */
  salesQty90d?: number
  /** Set when row comes from Odoo `product.product` (for RPC create). */
  odooProductId?: number
}
