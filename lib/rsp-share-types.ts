export const RSP_SHARE_VERSION = 3 as const

export type RspFactor = {
  id: string
  label: string
  detail: string
}

export type RspSharePayload = {
  version: typeof RSP_SHARE_VERSION
  currency: "INR"
  title: string
  /** Factory / ex-works COGS (₹) */
  cogs: number
  /** % on running cost — import / input duty */
  inputDutyPct: number
  /** % allocation — marketing */
  marketingPct: number
  /** % — company overhead */
  companyOverheadPct: number
  /** % — payment, banking, FX handling */
  paymentHandlingPct: number
  marginMultiplier: number
  uaeVatPct: number
  regionFreightPct: number
  SaudiVatPct: number
  SaudiFreightPct: number
  marginBandLowPct: number
  marginBandHighPct: number
  factors: RspFactor[]
}

/** v2 — migration only */
type RspSharePayloadV2 = {
  version: 2
  currency: "INR"
  title: string
  cogs: number
  marginMultiplier: number
  uaeVatPct: number
  regionFreightPct: number
  SaudiVatPct: number
  SaudiFreightPct: number
  marginBandLowPct: number
  marginBandHighPct: number
  factors: RspFactor[]
}

/** v1 legacy — migration only */
type RspLineV1 = {
  id: string
  label: string
  cogs: number
  uaeRsp: number
  regionRsp: number
  SaudiRsp: number
}

type RspSharePayloadV1 = {
  version: 1
  currency: "INR"
  title: string
  marginMultiplier: number
  uaeVatPct: number
  regionFreightPct: number
  SaudiVatPct: number
  SaudiFreightPct: number
  lines: RspLineV1[]
}

function clampPct(p: number) {
  return Math.min(200, Math.max(-90, p))
}

function applyPctLayer(base: number, pct: number): number {
  return base * (1 + clampPct(pct) / 100)
}

export function defaultFactors(): RspFactor[] {
  return [
    {
      id: "f1",
      label: "COGS base",
      detail: "Ex-factory unit cost before duty, freight, and channel stack.",
    },
    {
      id: "f2",
      label: "Loaded cost stack",
      detail: "Duty, marketing, overhead, and payment % compound on COGS before regional freight and margin.",
    },
    {
      id: "f3",
      label: "Margin & VAT",
      detail: "Multiplier covers trading margin; UAE/ Saudi add VAT where applicable.",
    },
    {
      id: "f4",
      label: "Regional freight",
      detail: "Region and Saudi add inbound freight % on loaded cost before margin (Saudi then VAT).",
    },
  ]
}

export function defaultRspPayload(): RspSharePayload {
  return {
    version: RSP_SHARE_VERSION,
    currency: "INR",
    title: "",
    cogs: 0,
    inputDutyPct: 0,
    marketingPct: 0,
    companyOverheadPct: 0,
    paymentHandlingPct: 0,
    marginMultiplier: 1.35,
    uaeVatPct: 5,
    regionFreightPct: 15,
    SaudiVatPct: 15,
    SaudiFreightPct: 15,
    marginBandLowPct: 22,
    marginBandHighPct: 48,
    factors: defaultFactors(),
  }
}

export type DerivedRspNumbers = {
  factoryCogs: number
  afterInputDuty: number
  afterMarketing: number
  afterCompanyOverhead: number
  afterPaymentHandling: number
  /** Cost after all global % layers, before channel freight */
  loadedCost: number
  uaeBase: number
  uaeRsp: number
  regionLanded: number
  regionRsp: number
  SaudiAfterFreight: number
  SaudiAfterMargin: number
  SaudiRsp: number
  regionEffectiveCost: number
  marginBandLowShelf: number
  marginBandHighShelf: number
}

export function deriveRspNumbers(p: RspSharePayload): DerivedRspNumbers {
  const factoryCogs = Math.max(0, p.cogs)
  const m = Math.max(0.01, p.marginMultiplier)

  const afterInputDuty = applyPctLayer(factoryCogs, p.inputDutyPct)
  const afterMarketing = applyPctLayer(afterInputDuty, p.marketingPct)
  const afterCompanyOverhead = applyPctLayer(afterMarketing, p.companyOverheadPct)
  const afterPaymentHandling = applyPctLayer(afterCompanyOverhead, p.paymentHandlingPct)
  const loadedCost = afterPaymentHandling

  const uaeBase = loadedCost * m
  const uaeRsp = Math.round(uaeBase * (1 + p.uaeVatPct / 100))
  const regionLanded = loadedCost * (1 + p.regionFreightPct / 100)
  const regionRsp = Math.round(regionLanded * m)
  const SaudiAfterFreight = loadedCost * (1 + p.SaudiFreightPct / 100)
  const SaudiAfterMargin = SaudiAfterFreight * m
  const SaudiRsp = Math.round(SaudiAfterMargin * (1 + p.SaudiVatPct / 100))
  const regionEffectiveCost = regionLanded * m
  const low = marginBandShelf(regionEffectiveCost, p.marginBandLowPct)
  const high = marginBandShelf(regionEffectiveCost, p.marginBandHighPct)

  return {
    factoryCogs,
    afterInputDuty,
    afterMarketing,
    afterCompanyOverhead,
    afterPaymentHandling,
    loadedCost,
    uaeBase,
    uaeRsp,
    regionLanded,
    regionRsp,
    SaudiAfterFreight,
    SaudiAfterMargin,
    SaudiRsp,
    regionEffectiveCost,
    marginBandLowShelf: low,
    marginBandHighShelf: high,
  }
}

function marginBandShelf(effectiveCost: number, marginPct: number): number {
  const pct = Math.min(90, Math.max(1, marginPct))
  return Math.round(effectiveCost / (1 - pct / 100))
}

export function recomputePayload(p: RspSharePayload): RspSharePayload {
  return { ...p }
}

function isRspFactor(x: unknown): x is RspFactor {
  if (!x || typeof x !== "object") return false
  const o = x as Record<string, unknown>
  return (
    typeof o.id === "string" &&
    typeof o.label === "string" &&
    typeof o.detail === "string"
  )
}

export function isRspSharePayload(x: unknown): x is RspSharePayload {
  if (!x || typeof x !== "object") return false
  const o = x as Record<string, unknown>
  if (o.version !== RSP_SHARE_VERSION || o.currency !== "INR") return false
  return (
    typeof o.title === "string" &&
    typeof o.cogs === "number" &&
    typeof o.inputDutyPct === "number" &&
    typeof o.marketingPct === "number" &&
    typeof o.companyOverheadPct === "number" &&
    typeof o.paymentHandlingPct === "number" &&
    typeof o.marginMultiplier === "number" &&
    typeof o.uaeVatPct === "number" &&
    typeof o.regionFreightPct === "number" &&
    typeof o.SaudiVatPct === "number" &&
    typeof o.SaudiFreightPct === "number" &&
    typeof o.marginBandLowPct === "number" &&
    typeof o.marginBandHighPct === "number" &&
    Array.isArray(o.factors) &&
    o.factors.every((f) => isRspFactor(f))
  )
}

function isRspSharePayloadV2(x: unknown): x is RspSharePayloadV2 {
  if (!x || typeof x !== "object") return false
  const o = x as Record<string, unknown>
  return (
    o.version === 2 &&
    o.currency === "INR" &&
    typeof o.title === "string" &&
    typeof o.cogs === "number" &&
    typeof o.marginMultiplier === "number" &&
    Array.isArray(o.factors)
  )
}

function isRspSharePayloadV1(x: unknown): x is RspSharePayloadV1 {
  if (!x || typeof x !== "object") return false
  const o = x as Record<string, unknown>
  return (
    o.version === 1 &&
    o.currency === "INR" &&
    typeof o.title === "string" &&
    typeof o.marginMultiplier === "number" &&
    Array.isArray(o.lines)
  )
}

function v2toV3(raw: RspSharePayloadV2): RspSharePayload {
  return recomputePayload({
    ...defaultRspPayload(),
    ...raw,
    version: RSP_SHARE_VERSION,
    inputDutyPct: 0,
    marketingPct: 0,
    companyOverheadPct: 0,
    paymentHandlingPct: 0,
    factors: raw.factors.length ? raw.factors : defaultFactors(),
  })
}

export function normalizeRspPayload(raw: unknown): RspSharePayload {
  if (isRspSharePayload(raw)) {
    return recomputePayload({
      ...raw,
      factors: raw.factors.length ? raw.factors : defaultFactors(),
    })
  }
  if (isRspSharePayloadV2(raw)) {
    return v2toV3(raw)
  }
  if (isRspSharePayloadV1(raw)) {
    const first = raw.lines[0]
    const cogs = first && first.cogs > 0 ? first.cogs : 0
    return recomputePayload({
      ...defaultRspPayload(),
      title: raw.title,
      marginMultiplier: raw.marginMultiplier,
      uaeVatPct: raw.uaeVatPct,
      regionFreightPct: raw.regionFreightPct,
      SaudiVatPct: raw.SaudiVatPct,
      SaudiFreightPct: raw.SaudiFreightPct,
      cogs,
    })
  }
  return recomputePayload(defaultRspPayload())
}
