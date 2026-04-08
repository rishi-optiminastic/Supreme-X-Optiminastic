import { openRouterChat } from "@/lib/openrouter"

type Body = {
  sku?: string
  productName?: string
  trendScore?: number
  weeksCover?: number
  onHand?: number
  inbound?: number
  salesQty90d?: number
  weeklyDemand?: number
  demandScore?: number
  supplierContext?: "we_found_them" | "they_found_us" | "unknown"
}

export async function POST(req: Request) {
  let body: Body = {}
  try {
    body = (await req.json()) as Body
  } catch {
    return Response.json({ error: "Invalid JSON" }, { status: 400 })
  }

  const system = `You are a supply-chain trend analyst for an Indian merchant.
Analyze whether a product is worth buying/stocking based on the data provided.
Respond with ONLY valid JSON (no markdown) in this shape:
{
  "verdict": "strong_buy" | "buy" | "hold" | "caution" | "avoid",
  "confidence": number (0-100),
  "summary": "2-3 sentence analysis of demand outlook",
  "factors": [
    {"factor": "name", "impact": "positive" | "neutral" | "negative", "detail": "short explanation"}
  ],
  "actionItems": ["specific next step 1", "step 2"],
  "negotiationTip": "if supplier context is known, a negotiation insight"
}`

  const supplierNote = body.supplierContext === "we_found_them"
    ? "This merchant found the supplier (they have more leverage in negotiation)."
    : body.supplierContext === "they_found_us"
      ? "The supplier reached out to the merchant (supplier may be eager to sell — possible leverage on price)."
      : "No supplier context."

  const user = `Product: ${body.productName ?? body.sku ?? "Unknown"}
SKU: ${body.sku ?? "N/A"}
Trend Score (0-100): ${body.trendScore ?? 50}
Demand Probability Score: ${body.demandScore ?? 50}%
Weekly Demand (units): ${body.weeklyDemand ?? 0}
Weeks of Stock Cover: ${body.weeksCover ?? 0}
On Hand: ${body.onHand ?? 0} units
Inbound: ${body.inbound ?? 0} units
90-day Sales: ${body.salesQty90d ?? "unknown"}

Supplier context: ${supplierNote}

Analyze whether this product is worth buying more of, considering the trend, stock levels, and demand. Be specific about Indian market dynamics.`

  try {
    const raw = await openRouterChat(user, system)
    let parsed: unknown
    try {
      const cleaned = raw.replace(/```json\n?|\n?```/g, "").trim()
      parsed = JSON.parse(cleaned)
    } catch {
      return Response.json({
        verdict: "hold",
        confidence: 50,
        summary: raw.slice(0, 600),
        factors: [],
        actionItems: [],
        parseWarning: "AI returned non-JSON; showing raw text.",
      })
    }
    return Response.json(parsed)
  } catch (e) {
    const message = e instanceof Error ? e.message : "AI error"
    return Response.json({ error: message }, { status: 502 })
  }
}
