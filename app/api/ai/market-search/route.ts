import { openRouterChat } from "@/lib/openrouter"
import { heuristicSearchMarket } from "@/lib/market-signals"

type Body = { query?: string }

export async function POST(req: Request) {
  let body: Body = {}
  try {
    body = (await req.json()) as Body
  } catch {
    return Response.json({ error: "Invalid JSON" }, { status: 400 })
  }

  const query = (body.query ?? "").trim()
  if (!query) {
    return Response.json({
      source: "empty" as const,
      momentumPct: 0,
      confidence: 0,
      summary: "Type a product or category to analyze.",
    })
  }

  const system = `You are a retail market analyst for India. The user searches for a product or category they may want to stock.
Respond with ONLY valid JSON (no markdown):
{
  "momentumPct": number from -60 to 60 (negative = market cooling, positive = heating up),
  "confidence": number from 40 to 92 (how sure you are given only the search text),
  "summary": "2 short sentences on what this implies for a merchant"
}
Use general knowledge; if you know nothing specific, give mild numbers (near 0 momentum, confidence 45-55) and say uncertainty in summary.`

  try {
    const raw = await openRouterChat(
      `Search / product focus: "${query}"`,
      system
    )
    const cleaned = raw.replace(/```json\n?|\n?```/g, "").trim()
    const parsed = JSON.parse(cleaned) as {
      momentumPct?: number
      confidence?: number
      summary?: string
    }
    const momentumPct = Math.max(
      -60,
      Math.min(60, Math.round(Number(parsed.momentumPct) || 0))
    )
    const confidence = Math.max(
      40,
      Math.min(92, Math.round(Number(parsed.confidence) || 50))
    )
    return Response.json({
      source: "ai" as const,
      momentumPct,
      confidence,
      summary:
        typeof parsed.summary === "string"
          ? parsed.summary
          : "No summary returned.",
    })
  } catch {
    const h = heuristicSearchMarket(query)
    return Response.json({
      source: "heuristic" as const,
      momentumPct: h.momentumPct,
      confidence: h.confidence,
      summary: h.summary,
    })
  }
}
