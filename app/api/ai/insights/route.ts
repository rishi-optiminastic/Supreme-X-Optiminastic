import { openRouterChat } from "@/lib/openrouter"

type Body = {
  mode?: "trends" | "signals" | "overview"
  payload?: {
    variantCount?: number
    lowCoverCount?: number
    totalOnHand?: number
    openSignals?: number
    trendSourceCount?: number
    sampleSkus?: string[]
    dataSource?: "odoo" | "demo"
  }
}

export async function POST(req: Request) {
  let body: Body = {}
  try {
    body = (await req.json()) as Body
  } catch {
    return Response.json({ error: "Invalid JSON" }, { status: 400 })
  }

  const mode = body.mode ?? "overview"
  const p = body.payload ?? {}

  const system = `You are a supply-chain analyst for a merchant using Odoo. 
Respond with ONLY valid JSON (no markdown) in this shape:
{"summary":"2-3 sentences","bullets":["short point 1","point 2","point 3"],"actions":["concrete next step 1","step 2"]}
Optionally include "purchaseHints":[{"sku":"string or UNKNOWN","reason":"string","urgency":"low"|"medium"|"high"}] with 0-4 items when mode is signals or overview.
Use the stats provided; if dataSource is demo, say insights are illustrative until Odoo is connected.`

  const user = `mode=${mode}
dataSource=${p.dataSource ?? "demo"}
variants=${p.variantCount ?? 0}
lowCoverUnder1_5wk=${p.lowCoverCount ?? 0}
totalOnHand=${p.totalOnHand ?? 0}
openPurchaseSignals=${p.openSignals ?? 0}
enabledTrendSources=${p.trendSourceCount ?? 0}
sampleSkus=${(p.sampleSkus ?? []).slice(0, 12).join(", ")}`

  try {
    const raw = await openRouterChat(user, system)
    let parsed: unknown
    try {
      const cleaned = raw.replace(/```json\n?|\n?```/g, "").trim()
      parsed = JSON.parse(cleaned)
    } catch {
      return Response.json({
        summary: raw.slice(0, 600),
        bullets: [],
        actions: [],
        purchaseHints: [],
        parseWarning: "Model returned non-JSON; showing raw summary.",
      })
    }
    return Response.json(parsed)
  } catch (e) {
    const message = e instanceof Error ? e.message : "AI error"
    return Response.json({ error: message }, { status: 502 })
  }
}
