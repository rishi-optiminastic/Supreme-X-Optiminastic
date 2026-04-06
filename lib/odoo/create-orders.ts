import { odooExecuteKw } from "@/lib/odoo/jsonrpc"
import type { OdooEnvConfig } from "@/lib/odoo/env"

export type PoLineInput = { productId: number; quantity: number }

export type SoLineInput = { productId: number; quantity: number }

/**
 * Create a draft purchase.order with one vendor and storable product lines.
 * @returns New `purchase.order` database id.
 */
export async function createPurchaseOrder(
  cfg: OdooEnvConfig,
  uid: number,
  partnerId: number,
  lines: PoLineInput[]
): Promise<number> {
  if (lines.length === 0) throw new Error("At least one line is required")
  const orderLine = lines.map(
    (l) =>
      [
        0,
        0,
        {
          product_id: l.productId,
          product_qty: l.quantity,
        },
      ] as const
  )
  const vals = {
    partner_id: partnerId,
    order_line: orderLine,
  }
  const id = await odooExecuteKw<number>(cfg.url, cfg.database, uid, cfg.apiKey, "purchase.order", "create", [
    vals,
  ])
  if (typeof id !== "number" || id <= 0) {
    throw new Error("Odoo did not return a purchase order id")
  }
  return id
}

/**
 * Create a draft sale.order with one customer and product lines.
 * @returns New `sale.order` database id.
 */
export async function createSaleOrder(
  cfg: OdooEnvConfig,
  uid: number,
  partnerId: number,
  lines: SoLineInput[]
): Promise<number> {
  if (lines.length === 0) throw new Error("At least one line is required")
  const orderLine = lines.map(
    (l) =>
      [
        0,
        0,
        {
          product_id: l.productId,
          product_uom_qty: l.quantity,
        },
      ] as const
  )
  const vals = {
    partner_id: partnerId,
    order_line: orderLine,
  }
  const id = await odooExecuteKw<number>(cfg.url, cfg.database, uid, cfg.apiKey, "sale.order", "create", [
    vals,
  ])
  if (typeof id !== "number" || id <= 0) {
    throw new Error("Odoo did not return a sales order id")
  }
  return id
}
