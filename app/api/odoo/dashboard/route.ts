import { getOdooEnv } from "@/lib/odoo/env"
import { mapOdooProductToVariant, mapOdooSaleOrder } from "@/lib/odoo/map"
import { odooAuthenticate, odooExecuteKw } from "@/lib/odoo/jsonrpc"

export async function GET() {
  const cfg = getOdooEnv()
  if (!cfg.configured) {
    return Response.json({
      connected: false,
      variants: [],
      orders: [],
      message: "Odoo not configured in .env — showing demo data in the app.",
    })
  }

  try {
    const uid = await odooAuthenticate(
      cfg.url,
      cfg.database,
      cfg.username,
      cfg.apiKey
    )

    const productFieldsBase = [
      "id",
      "name",
      "default_code",
      "barcode",
      "qty_available",
      "free_qty",
      "incoming_qty",
      "outgoing_qty",
      "description_sale",
    ]
    const productFieldsWithImage = [...productFieldsBase, "image_128"]

    const stockableDomain = [[["type", "=", "product"], ["active", "=", true]]]

    let raw: Record<string, unknown>[] = []
    try {
      raw = (await odooExecuteKw<Record<string, unknown>[]>(
        cfg.url,
        cfg.database,
        uid,
        cfg.apiKey,
        "product.product",
        "search_read",
        stockableDomain,
        {
          fields: productFieldsWithImage,
          limit: 80,
          order: "id desc",
        }
      )) as Record<string, unknown>[]
    } catch {
      try {
        raw = (await odooExecuteKw<Record<string, unknown>[]>(
          cfg.url,
          cfg.database,
          uid,
          cfg.apiKey,
          "product.product",
          "search_read",
          stockableDomain,
          {
            fields: productFieldsBase,
            limit: 80,
            order: "id desc",
          }
        )) as Record<string, unknown>[]
      } catch {
        raw = (await odooExecuteKw<Record<string, unknown>[]>(
          cfg.url,
          cfg.database,
          uid,
          cfg.apiKey,
          "product.product",
          "search_read",
          [[["active", "=", true]]],
          {
            fields: ["id", "name", "default_code", "barcode"],
            limit: 80,
            order: "id desc",
          }
        )) as Record<string, unknown>[]
        raw = raw.map((r) => ({
          ...r,
          qty_available: 0,
          incoming_qty: 0,
          outgoing_qty: 0,
        }))
      }
    }

    let variants = raw.map((p, i) => mapOdooProductToVariant(p, i))

    const qtyByProductId: Record<string, number> = {}
    try {
      const since = new Date()
      since.setDate(since.getDate() - 90)
      const day = since.toISOString().slice(0, 10)
      const lines = (await odooExecuteKw<Record<string, unknown>[]>(
        cfg.url,
        cfg.database,
        uid,
        cfg.apiKey,
        "sale.order.line",
        "search_read",
        [
          [
            ["order_id.state", "in", ["sale", "done"]],
            ["order_id.date_order", ">=", day],
          ],
        ],
        {
          fields: ["product_id", "product_uom_qty"],
          limit: 5000,
        }
      )) as Record<string, unknown>[]
      for (const row of lines ?? []) {
        const pid = row.product_id
        const qty = Number(row.product_uom_qty ?? 0)
        if (!Array.isArray(pid) || pid[0] == null) continue
        const key = String(pid[0])
        qtyByProductId[key] = (qtyByProductId[key] ?? 0) + qty
      }
    } catch {
      /* optional: model/ACL/date format differs per Odoo */
    }

    variants = variants.map((v) => {
      const idPart = v.id.replace(/^odoo-/, "")
      const q = qtyByProductId[idPart]
      if (q == null || q <= 0) return v
      return { ...v, salesQty90d: Math.round(q) }
    })

    let orders: ReturnType<typeof mapOdooSaleOrder>[] = []
    try {
      const oraw = (await odooExecuteKw<Record<string, unknown>[]>(
        cfg.url,
        cfg.database,
        uid,
        cfg.apiKey,
        "sale.order",
        "search_read",
        [[]],
        {
          fields: ["name", "partner_id", "amount_total", "state"],
          limit: 8,
          order: "date_order desc",
        }
      )) as Record<string, unknown>[]
      orders = oraw.map(mapOdooSaleOrder)
    } catch {
      orders = []
    }

    return Response.json({
      connected: true,
      variants,
      orders,
      productCount: variants.length,
    })
  } catch (e) {
    const message = e instanceof Error ? e.message : "Odoo request failed"
    return Response.json(
      {
        connected: false,
        variants: [],
        orders: [],
        error: message,
      },
      { status: 200 }
    )
  }
}
