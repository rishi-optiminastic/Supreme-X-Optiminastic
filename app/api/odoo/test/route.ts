import { getOdooEnv } from "@/lib/odoo/env"
import { odooAuthenticate, odooExecuteKw } from "@/lib/odoo/jsonrpc"

export async function POST() {
  const cfg = getOdooEnv()
  if (!cfg.configured) {
    return Response.json(
      {
        ok: false,
        message:
          "Set ODOO_URL, ODOO_DATABASE, ODOO_USERNAME, and ODOO_API_KEY in .env",
      },
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
    let version = ""
    try {
      const v = await odooExecuteKw<unknown>(
        cfg.url,
        cfg.database,
        uid,
        cfg.apiKey,
        "ir.module.module",
        "search_read",
        [[["name", "=", "base"]]],
        { fields: ["latest_version"], limit: 1 }
      )
      if (Array.isArray(v) && v[0] && typeof v[0] === "object") {
        const row = v[0] as Record<string, unknown>
        version = String(row.latest_version ?? "")
      }
    } catch {
      /* optional */
    }

    return Response.json({
      ok: true,
      uid,
      message: "Connected to Odoo JSON-RPC.",
      odooVersion: version || undefined,
    })
  } catch (e) {
    const message = e instanceof Error ? e.message : "Connection failed"
    return Response.json({ ok: false, message }, { status: 502 })
  }
}
