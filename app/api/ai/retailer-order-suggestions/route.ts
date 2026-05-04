import { openRouterChat } from "@/lib/openrouter"
import { heuristicReasonForStat, type RetailerHistorySkuStat } from "@/lib/retailer-order-history-stats"

type CatalogRow = { sku: string; productName: string }

type Body = {
  retailerName?: string
  retailerAreaLabel?: string
  currentLineSkus?: string[]
  catalog?: CatalogRow[]
  historyStats?: RetailerHistorySkuStat[]
}

type RetailerOrderSuggestionRow = {
  sku: string
  productName: string
  suggestedQty: number
  reason: string
}

type OkResponse = {
  source: "ai" | "history-only"
  aiAvailable: boolean
  suggestions: RetailerOrderSuggestionRow[]
  note?: string
}

const MAX_CATALOG = 120
const MAX_SUGGESTIONS = 6

function allowedSkuSet(catalog: CatalogRow[], history: RetailerHistorySkuStat[]) {
  const s = new Set<string>()
  for (const c of catalog) {
    if (c.sku?.trim()) s.add(c.sku.trim())
  }
  for (const h of history) {
    if (h.sku?.trim()) s.add(h.sku.trim())
  }
  return s
}

function heuristicSuggestions(
  stats: RetailerHistorySkuStat[],
  catalogBySku: Map<string, string>,
  currentSkus: Set<string>
): RetailerOrderSuggestionRow[] {
  const out: RetailerOrderSuggestionRow[] = []
  for (const s of stats) {
    if (currentSkus.has(s.sku)) continue
    const name = catalogBySku.get(s.sku) ?? s.productName
    out.push({
      sku: s.sku,
      productName: name,
      suggestedQty: s.typicalQty,
      reason: heuristicReasonForStat(s),
    })
    if (out.length >= MAX_SUGGESTIONS) break
  }
  return out
}

function parseAiSuggestions(raw: string, allowed: Set<string>): { sku: string; suggestedQty: number; reason: string }[] {
  const cleaned = raw.replace(/```json\n?|\n?```/g, "").trim()
  const parsed = JSON.parse(cleaned) as { suggestions?: unknown }
  const list = Array.isArray(parsed.suggestions) ? parsed.suggestions : []
  const out: { sku: string; suggestedQty: number; reason: string }[] = []
  for (const item of list) {
    if (!item || typeof item !== "object") continue
    const rec = item as Record<string, unknown>
    const sku = typeof rec.sku === "string" ? rec.sku.trim() : ""
    if (!sku || !allowed.has(sku)) continue
    const suggestedQty = Math.max(1, Math.floor(Number(rec.suggestedQty)) || 1)
    const reason = typeof rec.reason === "string" ? rec.reason.trim() : ""
    if (!reason) continue
    out.push({ sku, suggestedQty, reason: reason.slice(0, 400) })
    if (out.length >= MAX_SUGGESTIONS) break
  }
  return out
}

export async function POST(req: Request) {
  let body: Body = {}
  try {
    body = (await req.json()) as Body
  } catch {
    return Response.json({ error: "Invalid JSON" }, { status: 400 })
  }

  const retailerName = (body.retailerName ?? "").trim() || "Retailer"
  const retailerAreaLabel = (body.retailerAreaLabel ?? "").trim() || "Unknown"
  const currentLineSkus = new Set(
    (body.currentLineSkus ?? []).map((s) => (typeof s === "string" ? s.trim() : "")).filter(Boolean)
  )
  const catalog = (body.catalog ?? [])
    .filter((c) => c && typeof c.sku === "string" && c.sku.trim())
    .slice(0, MAX_CATALOG)
    .map((c) => ({ sku: c.sku.trim(), productName: (c.productName ?? c.sku).trim() || c.sku.trim() }))

  const historyStats = Array.isArray(body.historyStats)
    ? body.historyStats.filter((h) => h && typeof h.sku === "string" && h.sku.trim())
    : []

  const catalogBySku = new Map(catalog.map((c) => [c.sku, c.productName] as const))
  const allowed = allowedSkuSet(catalog, historyStats)
  const hasKey = Boolean((process.env.OPENROUTER_API_KEY ?? "").trim())

  const baseHeuristic = heuristicSuggestions(historyStats, catalogBySku, currentLineSkus)

  if (!hasKey) {
    const res: OkResponse = {
      source: "history-only",
      aiAvailable: false,
      suggestions: baseHeuristic,
      note:
        baseHeuristic.length > 0
          ? "Connect OpenRouter (OPENROUTER_API_KEY) for richer, AI-written reasons alongside these patterns."
          : "Save a few drafts for this retailer to unlock pattern-based picks, or configure OPENROUTER_API_KEY for AI suggestions from the catalog.",
    }
    return Response.json(res)
  }

  const system = `You help wholesale buyers draft repeat purchase orders.
Respond with ONLY valid JSON (no markdown) in this exact shape:
{"suggestions":[{"sku":"string","suggestedQty":number,"reason":"1-2 short sentences"}]}
Rules:
- Suggest at most ${MAX_SUGGESTIONS} SKUs.
- Every sku MUST be copied exactly from the allowed SKU list in the user message.
- Ground reasons in the numeric history when provided (e.g. how often ordered, typical qty). Do not invent past orders.
- If no purchase history is provided, suggest a sensible starter mix for this retailer/area using only catalog SKUs, and say briefly why each fits (display, staples, margin, etc.).
- suggestedQty must be a positive integer.
- Keep reasons factual and professional; no markdown inside strings.`

  const allowedList = [...allowed].slice(0, 160).join(", ")
  const historyLines =
    historyStats.length > 0
      ? historyStats
          .slice(0, 14)
          .map(
            (h) =>
              `${h.sku} | ${h.productName} | in ${h.orderCount}/${h.totalDraftsConsidered} drafts | typicalQty ${h.typicalQty}`
          )
          .join("\n")
      : "(none — no saved drafts for this retailer yet)"

  const user = `retailerName=${JSON.stringify(retailerName)}
retailerArea=${JSON.stringify(retailerAreaLabel)}
currentLineSkusAlreadyOnOrder=${JSON.stringify([...currentLineSkus])}
allowedSkus=${JSON.stringify(allowedList)}
purchaseHistoryBySku=
${historyLines}
catalogSample=${JSON.stringify(catalog.slice(0, 40))}`

  try {
    const raw = await openRouterChat(user, system, { temperature: 0.25, maxTokens: 900 })
    let aiRows: { sku: string; suggestedQty: number; reason: string }[] = []
    try {
      aiRows = parseAiSuggestions(raw, allowed)
    } catch {
      /* fall through */
    }

    if (aiRows.length === 0) {
      const res: OkResponse = {
        source: "history-only",
        aiAvailable: true,
        suggestions: baseHeuristic,
        note: "Model returned no usable suggestions; showing pattern-based picks instead.",
      }
      return Response.json(res)
    }

    const suggestions: RetailerOrderSuggestionRow[] = aiRows
      .filter((r) => !currentLineSkus.has(r.sku))
      .map((r) => ({
        sku: r.sku,
        productName: catalogBySku.get(r.sku) ?? historyStats.find((h) => h.sku === r.sku)?.productName ?? r.sku,
        suggestedQty: r.suggestedQty,
        reason: r.reason,
      }))

    const res: OkResponse = {
      source: "ai",
      aiAvailable: true,
      suggestions,
    }
    return Response.json(res)
  } catch (e) {
    const message = e instanceof Error ? e.message : "AI error"
    const res: OkResponse = {
      source: "history-only",
      aiAvailable: true,
      suggestions: baseHeuristic,
      note: baseHeuristic.length ? `AI unavailable (${message}). Showing pattern-based suggestions.` : message,
    }
    return Response.json(res, { status: 200 })
  }
}
