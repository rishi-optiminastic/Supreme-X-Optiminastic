import { createPurchaseOrder } from "@/lib/odoo/create-orders"
import { getOdooEnv, getOdooWorkflowPartnerIds } from "@/lib/odoo/env"
import { odooAuthenticate } from "@/lib/odoo/jsonrpc"

type Line = { productId: number; quantity: number }

export async function POST(req: Request) {
  const cfg = getOdooEnv()
  if (!cfg.configured) {
    return Response.json(
      { ok: false, message: "Odoo is not configured in .env" },
      { status: 400 }
    )
  }

  let body: { partnerId?: number; lines?: Line[] }
  try {
    body = (await req.json()) as typeof body
  } catch {
    return Response.json({ ok: false, message: "Invalid JSON body" }, { status: 400 })
  }

  const defaults = getOdooWorkflowPartnerIds()
  const partnerId = body.partnerId ?? defaults.poPartnerId ?? 0
  if (!partnerId) {
    return Response.json(
      {
        ok: false,
        message:
          "Missing vendor: set partnerId in the request or ODOO_PO_PARTNER_ID in .env (Contacts → Internal ID).",
      },
      { status: 400 }
    )
  }

  const rawLines = Array.isArray(body.lines) ? body.lines : []
  const lines: Line[] = []
  for (const row of rawLines.slice(0, 80)) {
    const productId = Number(row.productId)
    const quantity = Math.floor(Number(row.quantity))
    if (!Number.isFinite(productId) || productId <= 0) continue
    if (!Number.isFinite(quantity) || quantity <= 0) continue
    lines.push({ productId, quantity })
  }

  if (lines.length === 0) {
    return Response.json(
      { ok: false, message: "No valid lines (need productId & quantity > 0)" },
      { status: 400 }
    )
  }

  try {
    const uid = await odooAuthenticate(
      cfg.url,
      cfg.database,
      cfg.username,
      cfg.apiKey
    )
    const purchaseOrderId = await createPurchaseOrder(cfg, uid, partnerId, lines)
    return Response.json({
      ok: true,
      purchaseOrderId,
      message: `Created purchase order #${purchaseOrderId} (draft in Odoo).`,
    })
  } catch (e) {
    const message = e instanceof Error ? e.message : "Odoo error"
    return Response.json({ ok: false, message }, { status: 502 })
  }
}
