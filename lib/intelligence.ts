import type { InventoryVariant } from "@/lib/inventory-types"
import { reorderBreakdown, reorderRows, weeklyDemand } from "@/lib/planning-math"

/** User-tunable extra demand (0 = off, 100 = strong). */
export type ExternalSignals = {
  googleTrends: number
  marketplace: number
  social: number
}

export const defaultExternalSignals: ExternalSignals = {
  googleTrends: 35,
  marketplace: 40,
  social: 25,
}

export type ProbabilityPart = {
  id: string
  label: string
  points: number
  detail: string
}

export type DemandProbabilityBreakdown = {
  /** Clamped 12–94 */
  total: number
  /** Rough uncertainty band (same scale) */
  bandLow: number
  bandHigh: number
  parts: ProbabilityPart[]
  rawBeforeClamp: number
}

/**
 * Full breakdown for UI. Sum of `parts[].points` equals `rawBeforeClamp` before clamp.
 */
export function demandProbabilityBreakdown(
  v: InventoryVariant,
  external: ExternalSignals = defaultExternalSignals,
  opts?: { regionHeat?: number; categoryHeat?: number }
): DemandProbabilityBreakdown {
  const parts: ProbabilityPart[] = []

  const base = v.trendScore * 0.55 + 18
  parts.push({
    id: "trend",
    label: "Trend score",
    points: base,
    detail: `Starting point from trend score ${v.trendScore}.`,
  })

  let coverPts = 0
  let coverNote = `${v.weeksCover} weeks of stock on hand`
  if (v.weeksCover < 1.2) {
    coverPts += 12
    coverNote = "Very little stock left — pushes the score up"
  } else if (v.weeksCover < 2) {
    coverPts += 6
    coverNote = "Under 2 weeks of stock — small push up"
  }
  if (v.weeksCover > 10) {
    coverPts -= 10
    coverNote = "Lots of weeks of stock — pulls the score down a bit"
  }
  if (coverPts !== 0) {
    parts.push({
      id: "cover",
      label: "Stock on hand",
      points: coverPts,
      detail: coverNote,
    })
  }

  const sales = v.salesQty90d
  if (sales != null && sales > 0) {
    const bump = Math.min(18, Math.log10(sales + 10) * 8)
    parts.push({
      id: "sales",
      label: "Recent sales",
      points: bump,
      detail: `${sales} units sold in about the last 90 days.`,
    })
  } else {
    parts.push({
      id: "sales",
      label: "Recent sales",
      points: 0,
      detail: "No recent sales total yet — link Odoo or wait for orders.",
    })
  }

  const extAvg =
    (external.googleTrends + external.marketplace + external.social) / 3
  const extPts = (extAvg / 100) * 14
  parts.push({
    id: "external",
    label: "Demand sliders",
    points: extPts,
    detail: `Average of the three sliders is ${Math.round(extAvg)}%.`,
  })

  const reg = opts?.regionHeat
  if (reg != null) {
    const r = (reg / 100) * 8
    parts.push({
      id: "region",
      label: "Your region",
      points: r,
      detail: `Strength set to ${reg}%.`,
    })
  }

  const cat = opts?.categoryHeat
  if (cat != null) {
    const c = (cat / 100) * 6
    parts.push({
      id: "category",
      label: "Category",
      points: c,
      detail: `Strength set to ${cat}%.`,
    })
  }

  const rawBeforeClamp = parts.reduce((a, p) => a + p.points, 0)
  const total = Math.min(94, Math.max(12, Math.round(rawBeforeClamp)))
  const spread = 6 + Math.round((100 - v.trendScore) / 25)
  const bandLow = Math.max(12, Math.round(rawBeforeClamp - spread))
  const bandHigh = Math.min(94, Math.round(rawBeforeClamp + spread))

  return { total, bandLow, bandHigh, parts, rawBeforeClamp }
}

/** Plain-language reasons for the demand card: calendar season + SKU facts. */
export type DemandNarrativeGroups = {
  seasonLines: string[]
  skuLines: string[]
}

function catalogSeasonLine(v: InventoryVariant): string | null {
  const t = `${v.productName} ${v.attributes}`.toLowerCase()
  if (
    /christmas|xmas|santa|holiday|advent|nutcracker|ornament|snowflake|reindeer|noel|nativity/.test(
      t
    )
  ) {
    return `${v.productName} reads gift- and winter-holiday-heavy: demand usually concentrates in Q4, so off-peak months lean more on stock weeks, trend, and your sliders than on seasonal lift.`
  }
  if (/halloween|spooky|pumpkin|costume|trick|haunted|witch|skeleton/.test(t)) {
    return `${v.productName} looks Halloween-adjacent: most channels spike late September through October; other months are quieter unless you clearance or ship early.`
  }
  if (/summer|beach|pool|water|splash|sand|sun|inflatable|swim|sprinkler/.test(t)) {
    return `${v.productName} reads summer / outdoor: strongest sell-through is often May–August in temperate markets; shoulder months depend more on weather and promos.`
  }
  if (/back\s*to\s*school|school|backpack|lunch\s*box|notebook|study|classroom|eraser|pencil\b/.test(t)) {
    return `${v.productName} reads back-to-school: typical lift runs late July through September depending on region and retailer buy calendars.`
  }
  if (/bike|bicycle|scooter|skate|kickboard|helmet\b|sport\b|soccer|football\b|basketball/.test(t)) {
    return `${v.productName} reads ride-on or sports: warmer months usually help; winter is slower except around gifting unless you indoor-pitch.`
  }
  if (/chair|desk|office|furniture|ergo|furn-|shelf|table\b|cabinet/.test(t)) {
    return `${v.productName} reads home or office furniture: demand is steadier year-round, with a modest Q4 gifting bump and January refresh in many markets.`
  }
  if (/doll|plush|stuffed|action figure|lego|puzzle|board game|rc car|nerf/.test(t)) {
    return `${v.productName} reads classic toy assortment: Q4 is the big peak, but birthdays and mid-year movie tie-ins can move units any month.`
  }
  return null
}

function retailCalendarLine(at: Date): string {
  const long = at.toLocaleDateString("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric",
  })
  const m = at.getMonth()
  const d = at.getDate()
  switch (m) {
    case 0:
      return `As of ${long}: post-holiday retail. Broad toy demand is softer; buyers focus on clearance, cash flow, and early-year resets rather than seasonal peaks.`
    case 1:
      return `As of ${long}: still a low seasonal tide for mass-market toys. Late February can see the first spring outdoor previews in some chains.`
    case 2:
      return `As of ${long}: spring shelf work and Easter-adjacent gifting (dates vary) start shifting attention to outdoor and novelty lines.`
    case 3:
      return `As of ${long}: spring restock window. Summer and outdoor assortments get firmer orders ahead of May and school breaks in many regions.`
    case 4:
      return `As of ${long}: late spring build. Outdoor, travel, and “summer play” sets usually accelerate before June holidays.`
    case 5:
      return `As of ${long}: early summer. Warm-weather and outdoor categories are in their natural high season in the northern hemisphere.`
    case 6:
      return `As of ${long}: mid-summer peak for pools, outdoor toys, and travel retail in many markets; back-to-school planning starts for buyers.`
    case 7:
      return `As of ${long}: late summer. Clearance meets early back-to-school sets; seasonal mix shifts quickly by channel.`
    case 8:
      return `As of ${long}: back-to-school is live for many families and retailers; indoor learning and lunch gear often peaks now.`
    case 9:
      return `As of ${long}: early autumn. Halloween and harvest themes ramp; holiday inbound planning intensifies for November receipts.`
    case 10:
      return d < 12
        ? `As of ${long}: Halloween build phase; costume and décor SKUs accelerate before month-end. Holiday inbound is already on planners’ minds.`
        : `As of ${long}: late Halloween into early holiday set-up. Seasonal spikes are concentrated; non-seasonal SKUs lean on inventory math.`
    case 11:
      return d < 15
        ? `As of ${long}: core holiday selling window. Giftable items and impulse toys see the strongest natural demand of the year.`
        : `As of ${long}: peak gifting crunch. In-stock position and ship dates matter more than long-range trend for many SKUs.`
    default:
      return `As of ${long}: calendar context is blended into how we talk about seasonality versus inventory and trend signals.`
  }
}

/**
 * Human-readable demand reasons: retail calendar, inferred catalog seasonality,
 * and concrete numbers (stock, reorder math, history, sliders).
 */
export function demandScoreNarrativeReasons(params: {
  v: InventoryVariant
  external: ExternalSignals
  regionHeat: number
  categoryHeat: number
  leadW: number
  safetyW: number
  targetW: number
  at?: Date
}): DemandNarrativeGroups {
  const {
    v,
    external,
    regionHeat,
    categoryHeat,
    leadW,
    safetyW,
    targetW,
  } = params
  const at = params.at ?? new Date()
  const w = weeklyDemand(v)
  const wRound = Math.round(w * 10) / 10
  const coverR = Math.round(v.weeksCover * 10) / 10
  const rb = reorderBreakdown(v, leadW, safetyW, targetW)
  const demandWeeks = targetW + leadW + safetyW

  const seasonLines: string[] = [retailCalendarLine(at)]
  const cat = catalogSeasonLine(v)
  if (cat) seasonLines.push(cat)
  else {
    seasonLines.push(
      `${v.productName}: nothing in the name screams a sharp single-season spike, so the score leans on trend, weeks of cover, history (if present), and your slider settings.`
    )
  }

  const skuLines: string[] = [
    `Stock: ${v.onHand} on hand + ${v.inbound} inbound → about ${coverR} weeks cover at ~${wRound} units/week (from on-hand ÷ weeks of cover).`,
    `Reorder math: ${targetW}w target + ${leadW}w lead + ${safetyW}w safety = ${demandWeeks} demand-weeks of flow. Pipeline target ~${Math.round(rb.targetUnits)} units vs ${rb.available} available → ${rb.suggestQty} units suggested.`,
  ]

  if (v.salesQty90d != null && v.salesQty90d > 0) {
    skuLines.push(
      `Recent velocity: ${v.salesQty90d} units in roughly the last 90 days (from Odoo) supports a stronger demand read when blended into the model.`
    )
  } else {
    skuLines.push(
      `Recent velocity: no 90-day sales total on this row yet, so the model does not get an extra lift from shipped history until Odoo data is linked.`
    )
  }

  const extAvg =
    (external.googleTrends + external.marketplace + external.social) / 3
  skuLines.push(
    `Your demand sliders: search ${external.googleTrends}%, marketplaces ${external.marketplace}%, social ${external.social}% (average ${Math.round(extAvg)}%); region heat ${regionHeat}% and category heat ${categoryHeat}% are also folded in.`
  )

  return { seasonLines, skuLines }
}

export function suggestedReorderQty(
  v: InventoryVariant,
  leadWeeks = 2,
  safetyWeeks = 1,
  targetWeeks = 4
): number {
  const [row] = reorderRows([v], leadWeeks, safetyWeeks, targetWeeks)
  return row?.suggestQty ?? 0
}

export type OrderTiming = {
  action: "order_now" | "delay" | "hold"
  delayDays: number
  reason: string
}

export function orderTimingAdvice(
  v: InventoryVariant,
  suggestQty: number,
  leadWeeks = 2
): OrderTiming {
  const w = weeklyDemand(v)
  const projectedWeeks = w > 0 ? (v.onHand + v.inbound) / w : v.weeksCover

  if (suggestQty > 0 && v.weeksCover < 2.5) {
    return {
      action: "order_now",
      delayDays: 0,
      reason: "Low weeks of cover and a buy quantity is suggested.",
    }
  }
  if (suggestQty === 0 && projectedWeeks > leadWeeks + 6) {
    const delay = Math.min(14, Math.round((projectedWeeks - leadWeeks - 4) * 5))
    return {
      action: "delay",
      delayDays: delay,
      reason: `You already have plenty of stock; waiting about ${delay} days helps avoid piling up more.`,
    }
  }
  if (suggestQty === 0) {
    return {
      action: "hold",
      delayDays: 0,
      reason: "No buy needed for the stock level you asked for.",
    }
  }
  return {
    action: "order_now",
    delayDays: 0,
    reason: "A buy quantity is suggested.",
  }
}

/**
 * Adjust base reorder qty by template (promo lift or slow-MOQ cap).
 * Timing logic should use `finalQty`.
 */
export function applyTemplateToOrderQty(
  baseQty: number,
  template: string,
  v: InventoryVariant
): { finalQty: number; adjustmentNote: string | null } {
  if (template.startsWith("Standard")) {
    return { finalQty: baseQty, adjustmentNote: null }
  }
  if (template.startsWith("Promo")) {
    if (baseQty <= 0) return { finalQty: 0, adjustmentNote: null }
    const mult = v.trendScore >= 68 ? 1.12 : 1.06
    return {
      finalQty: Math.ceil(baseQty * mult),
      adjustmentNote:
        mult >= 1.1 ? "Busy season: +12% for strong sellers" : "Busy season: +6%",
    }
  }
  if (template.startsWith("Slow")) {
    if (baseQty <= 0) return { finalQty: 0, adjustmentNote: null }
    const w = weeklyDemand(v)
    const cap = Math.max(8, Math.ceil(w * 2.5))
    const final = Math.min(baseQty, cap)
    return {
      finalQty: final,
      adjustmentNote:
        final < baseQty ? `Small-order cap: about 2.5 weeks of sales (${cap} units max)` : null,
    }
  }
  if (template.startsWith("New supplier")) {
    if (baseQty <= 0) return { finalQty: 0, adjustmentNote: null }
    const w = weeklyDemand(v)
    const cap = Math.max(6, Math.ceil(w * 1.5))
    const final = Math.min(baseQty, cap)
    return {
      finalQty: final,
      adjustmentNote:
        final < baseQty
          ? `New-line trial cap: about 1.5 weeks of sales (${cap} units max)`
          : null,
    }
  }
  if (template.startsWith("Spot")) {
    if (baseQty <= 0) return { finalQty: 0, adjustmentNote: null }
    if (v.weeksCover < 2) {
      return {
        finalQty: Math.ceil(baseQty * 1.08),
        adjustmentNote: "Thin weeks of cover: +8% on the buy qty",
      }
    }
    return { finalQty: baseQty, adjustmentNote: null }
  }
  if (template.startsWith("After RSP")) {
    if (baseQty <= 0) return { finalQty: 0, adjustmentNote: null }
    return {
      finalQty: Math.ceil(baseQty * 1.05),
      adjustmentNote: "After approved shelf price: +5% on the buy qty",
    }
  }
  return { finalQty: baseQty, adjustmentNote: null }
}

export type RspScenario = {
  label: string
  price: number
  marginPct: number
  note: string
}

export type RspInput = {
  landedCost: number
  competitorPrice: number
  demandScore: number
  targetMarginPct: number
  /** 0 = chase volume, 100 = chase margin */
  scenarioSlider: number
}

export type RspStep = {
  id: string
  title: string
  detail: string
  amountInr?: number
}

export type RspAnalysis = {
  suggested: number
  suggestedMarginPct: number
  profitPerUnit: number
  /** vs competitor list price; null if no competitor */
  vsCompetitorPct: number | null
  demandMultiplier: number
  scenarios: RspScenario[]
  steps: RspStep[]
  /** Volume / margin anchor prices before demand tweak */
  lowPrice: number
  highPrice: number
  blendedBeforeDemand: number
  impliedMarginRate: number
}

function marginAtPrice(price: number, landedCost: number) {
  return price > 0
    ? Math.round(((price - landedCost) / price) * 1000) / 10
    : 0
}

/**
 * Full RSP math: cost + target margin, competitor cap, 55/45 blend, demand multiplier,
 * plus volume vs margin scenario prices.
 */
export function computeRspAnalysis(input: RspInput): RspAnalysis | null {
  const { landedCost, competitorPrice, demandScore, targetMarginPct, scenarioSlider } =
    input
  if (landedCost <= 0) return null

  const demandAdj = 0.92 + (demandScore / 100) * 0.2
  const volBias = (100 - scenarioSlider) / 100
  const marginBias = scenarioSlider / 100

  const targetM = Math.min(
    0.55,
    Math.max(0.08, (targetMarginPct / 100) * (0.85 + marginBias * 0.25))
  )
  const volM = Math.min(
    0.45,
    Math.max(0.06, targetM * (0.78 + volBias * 0.15))
  )

  const fromCost = landedCost / (1 - targetM)
  const fromComp =
    competitorPrice > 0 ? competitorPrice * 0.98 : fromCost
  const blended = fromCost * 0.55 + fromComp * 0.45
  const suggested = Math.round(blended * demandAdj)

  const lowPrice = Math.round((landedCost / (1 - volM)) * demandAdj)
  const highPrice = Math.round((landedCost / (1 - targetM * 1.08)) * demandAdj)

  const suggestedMarginPct = marginAtPrice(suggested, landedCost)
  const profitPerUnit = Math.round((suggested - landedCost) * 100) / 100

  const vsCompetitorPct =
    competitorPrice > 0
      ? Math.round(((suggested - competitorPrice) / competitorPrice) * 1000) / 10
      : null

  const steps: RspStep[] = [
    {
      id: "cost",
      title: "From your cost",
      detail: `Landed cost ₹${landedCost}, aiming near ${(targetM * 100).toFixed(1)}% margin (the strategy slider moves this).`,
      amountInr: Math.round(fromCost),
    },
    {
      id: "comp",
      title: competitorPrice > 0 ? "Vs competitor" : "No competitor price",
      detail:
        competitorPrice > 0
          ? `Uses 98% of their ₹${competitorPrice} so you stay close to the market.`
          : "We only use your cost when there is no competitor price.",
      amountInr: Math.round(fromComp),
    },
    {
      id: "blend",
      title: "Mix the two",
      detail: "About half from cost math, half from competitor (or all cost if no competitor).",
      amountInr: Math.round(blended),
    },
    {
      id: "demand",
      title: "Trend tweak",
      detail: `Multiply by ${demandAdj.toFixed(2)} from trend score ${demandScore} — stronger trend raises price a little.`,
      amountInr: suggested,
    },
  ]

  const scenarios: RspScenario[] = [
    {
      label: `₹${lowPrice} — move units`,
      price: lowPrice,
      marginPct: marginAtPrice(lowPrice, landedCost),
      note: "Lower margin; better when you want to sell faster or clear stock.",
    },
    {
      label: `₹${highPrice} — keep margin`,
      price: highPrice,
      marginPct: marginAtPrice(highPrice, landedCost),
      note: "Higher margin per piece; usually slower sales.",
    },
  ]

  return {
    suggested,
    suggestedMarginPct,
    profitPerUnit,
    vsCompetitorPct,
    demandMultiplier: demandAdj,
    scenarios,
    steps,
    lowPrice,
    highPrice,
    blendedBeforeDemand: Math.round(blended),
    impliedMarginRate: targetM,
  }
}


/** Short copy for the pricing UI from stock + trend. */
export function pricingPowerHint(v: InventoryVariant): string {
  if (v.trendScore >= 78 && v.weeksCover < 2)
    return "Selling fast with little stock — you can try the higher price option."
  if (v.trendScore >= 70 && v.weeksCover < 3)
    return "Good movement and okay stock — the middle suggestion is a fair default."
  if (v.trendScore < 40)
    return "Quiet trend — a lower price or a promo will help shift units."
  if (v.weeksCover > 10)
    return "You hold a lot of weeks of stock — a lower price helps turn it over."
  return "Compare the lower and higher prices and pick what fits your goal."
}

export type StockSegment =
  | "fast"
  | "slow"
  | "overstock"
  | "dead"
  | "stockout_risk"
  | "ok"

export type StockHealthRow = {
  sku: string
  productName: string
  segment: StockSegment
  daysToStockout: number | null
  weeklyDemand: number
  onHand: number
  note: string
}

const DEAD_WEEKS = 10
const OVERSTOCK_WEEKS = 8
const FAST_RATIO = 1.25

export function stockHealthRow(v: InventoryVariant): StockHealthRow {
  const w = weeklyDemand(v)
  const daysToStockout =
    w > 0.01 ? Math.max(0, Math.round((v.onHand / w) * 7)) : null

  let segment: StockSegment = "ok"
  let note = "Looks fine for this sample."

  if (v.weeksCover < 1 && w > 0.5) {
    segment = "stockout_risk"
    note = daysToStockout != null ? `About ${daysToStockout} days of stock left.` : "Very low stock."
  } else if (v.trendScore >= 72 && v.weeksCover < 3) {
    segment = "fast"
    note = "Selling well — easy to run out."
  } else if (v.trendScore < 38 && v.onHand > 40) {
    segment = "dead"
    note = "Low interest and lots on hand — consider a deal or bundle."
  } else if (v.weeksCover >= OVERSTOCK_WEEKS && v.onHand > 30) {
    segment = "overstock"
    note = "Many weeks of stock — ease off new orders."
  } else if (v.trendScore < 45 && v.weeksCover > DEAD_WEEKS) {
    segment = "slow"
    note = "Slow seller with a long runway of stock."
  } else if (w > 0 && v.onHand / w > v.weeksCover * FAST_RATIO && v.trendScore >= 65) {
    segment = "fast"
    note = "Moving faster than similar SKUs."
  }

  return {
    sku: v.sku,
    productName: v.productName,
    segment,
    daysToStockout,
    weeklyDemand: Math.round(w * 10) / 10,
    onHand: v.onHand,
    note,
  }
}

export function deadStockValueHint(variants: InventoryVariant[], unitCostGuess = 500): string {
  const dead = variants.filter(
    (v) => v.trendScore < 40 && v.weeksCover >= DEAD_WEEKS && v.onHand > 20
  )
  const units = dead.reduce((a, v) => a + v.onHand, 0)
  const inr = units * unitCostGuess
  if (units === 0) return "Nothing in this list looks both slow and heavy on stock."
  return `About ${units.toLocaleString()} slow-looking units × ₹${unitCostGuess} guess ≈ ₹${(inr / 1e5).toFixed(2)}L — change the cost guess if yours differs.`
}

export type ConversionIdea = {
  title: string
  detail: string
  channel: string
}

export function purchaseToSalesIdeas(variants: InventoryVariant[]): ConversionIdea[] {
  const top = [...variants].sort((a, b) => b.trendScore - a.trendScore).slice(0, 3)
  const slow = [...variants]
    .filter((v) => v.trendScore < 45)
    .sort((a, b) => b.onHand - a.onHand)
    .slice(0, 2)

  const ideas: ConversionIdea[] = []

  if (top[0]) {
    ideas.push({
      title: `Bundle ${top[0].sku} with an add-on`,
      detail: "Put your strongest seller next to something extra in the cart.",
      channel: "Amazon + your site",
    })
  }
  if (top[1]) {
    ideas.push({
      title: `Short sale on ${top[1].sku}`,
      detail: `Try ~8% off for a week — helps before new stock lands.`,
      channel: "Flipkart / shop",
    })
  }
  if (slow[0]) {
    ideas.push({
      title: `Shift ${slow[0].sku}`,
      detail: "Buy-one-get-one or a lower price on one channel only.",
      channel: "Clearance / wholesale",
    })
  }

  ideas.push({
    title: "Where to push each type",
    detail: "Put stars on marketplaces; keep slow lines for shop or direct buyers.",
    channel: "Mix of online and offline",
  })

  return ideas
}
