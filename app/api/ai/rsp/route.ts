import { openRouterChat } from "@/lib/openrouter"

type Body = {
  sku?: string
  productName?: string
  landedCost?: number
  competitorPrice?: number
  suggestedPrice?: number
  marginPct?: number
  demandScore?: number
  weeksCover?: number
  onHand?: number
}

export async function POST(req: Request) {
  let body: Body = {}
  try {
    body = (await req.json()) as Body
  } catch {
    return Response.json({ error: "Invalid JSON" }, { status: 400 })
  }

  const system = `You are an expert retail pricing analyst for Indian market (prices in ₹ INR).
Given product data, provide pricing reasoning and strategy.
Respond with ONLY valid JSON (no markdown) in this shape:
{
  "reasoning": "2-3 sentence explanation of WHY this price makes sense",
  "strategies": [
    {"name": "Penetration", "price": number, "margin": number, "rationale": "short reason"},
    {"name": "Competitive", "price": number, "margin": number, "rationale": "short reason"},
    {"name": "Premium", "price": number, "margin": number, "rationale": "short reason"}
  ],
  "recommendation": "which strategy to use and why, based on demand and stock",
  "risks": ["risk 1", "risk 2"]
}`

  const user = `Product: ${body.productName ?? body.sku ?? "Unknown"}
SKU: ${body.sku ?? "N/A"}
Landed Cost: ₹${body.landedCost ?? 0}
Competitor Price: ₹${body.competitorPrice ?? 0}
Our Suggested Price: ₹${body.suggestedPrice ?? 0}
Margin: ${body.marginPct ?? 0}%
Demand Score (0-100): ${body.demandScore ?? 50}
Weeks of Stock Cover: ${body.weeksCover ?? 0}
On Hand Units: ${body.onHand ?? 0}

Generate pricing strategies. For Penetration, price should be 5-15% below competitor. For Competitive, near competitor. For Premium, above if demand supports it. All margins must be positive.`

  try {
    const raw = await openRouterChat(user, system)
    let parsed: unknown
    try {
      const cleaned = raw.replace(/```json\n?|\n?```/g, "").trim()
      parsed = JSON.parse(cleaned)
    } catch {
      return Response.json({
        reasoning: raw.slice(0, 600),
        strategies: [],
        recommendation: "",
        risks: [],
        parseWarning: "AI returned non-JSON; showing raw text.",
      })
    }
    return Response.json(parsed)
  } catch (e) {
    const message = e instanceof Error ? e.message : "AI error"
    return Response.json({ error: message }, { status: 502 })
  }
}
