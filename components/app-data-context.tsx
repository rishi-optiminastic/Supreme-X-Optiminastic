"use client"

import * as React from "react"

import { downloadVariantsCsv } from "@/lib/export-variants-csv"
import { demoProductImageUrl } from "@/lib/demo-product-images"
import { blendPrediction, computeSeries } from "@/lib/trend-series"

const STORAGE_KEY = "supreme-odoo-app-state-v1"

function uid() {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 9)}`
}

export type InventoryVariant = {
  id: string
  productName: string
  sku: string
  attributes: string
  onHand: number
  reserved: number
  inbound: number
  weeksCover: number
  trendScore: number
  /** Demo: Unsplash URL. Live Odoo: optional `image_128` data URL from API. */
  imageUrl?: string
}

export type TrendSourceKind = "market" | "news" | "pricing" | "internal"

export type TrendSource = {
  id: string
  name: string
  kind: TrendSourceKind
  enabled: boolean
  detail?: string
}

export type PurchaseSignal = {
  id: string
  sku: string
  variantLabel: string
  productName: string
  urgency: "low" | "medium" | "high"
  qtySuggestion: number
  reason: string
  sentToTrends: boolean
  createdAt: string
}

export type TrendEvent = {
  id: string
  label: string
  at: string
  kind: "forecast" | "signal" | "source"
}

/** Last Odoo server test only — credentials live in .env (server-side) */
export type OdooUiState = {
  lastTestAt: string | null
  lastTestOk: boolean | null
  lastTestMessage: string
}

const defaultOdoo: OdooUiState = {
  lastTestAt: null,
  lastTestOk: null,
  lastTestMessage: "",
}

function migrateOdooFromStorage(raw: unknown): OdooUiState {
  if (!raw || typeof raw !== "object") return { ...defaultOdoo }
  const o = raw as Record<string, unknown>
  return {
    lastTestAt: typeof o.lastTestAt === "string" ? o.lastTestAt : null,
    lastTestOk: typeof o.lastTestOk === "boolean" ? o.lastTestOk : null,
    lastTestMessage:
      typeof o.lastTestMessage === "string" ? o.lastTestMessage : "",
  }
}

const INITIAL_VARIANTS: InventoryVariant[] = [
  {
    id: "v1",
    productName: "Ergo Chair Pro",
    sku: "FURN-001",
    attributes: "Mesh / Graphite",
    onHand: 48,
    reserved: 6,
    inbound: 20,
    weeksCover: 3.2,
    trendScore: 72,
    imageUrl: demoProductImageUrl("demo:FURN-001:v1"),
  },
  {
    id: "v2",
    productName: "Ergo Chair Pro",
    sku: "FURN-001-L",
    attributes: "Leather / Sand",
    onHand: 12,
    reserved: 4,
    inbound: 0,
    weeksCover: 1.1,
    trendScore: 58,
    imageUrl: demoProductImageUrl("demo:FURN-001-L:v2"),
  },
  {
    id: "v3",
    productName: "Standing Desk Frame",
    sku: "FURN-210",
    attributes: "Black / Dual motor",
    onHand: 86,
    reserved: 22,
    inbound: 40,
    weeksCover: 4.5,
    trendScore: 81,
    imageUrl: demoProductImageUrl("demo:FURN-210:v3"),
  },
  {
    id: "v4",
    productName: "Monitor Arm 32\"",
    sku: "ACC-884",
    attributes: "Silver / Gas spring",
    onHand: 140,
    reserved: 18,
    inbound: 60,
    weeksCover: 5.8,
    trendScore: 64,
    imageUrl: demoProductImageUrl("demo:ACC-884:v4"),
  },
  {
    id: "v5",
    productName: "USB-C Dock Gen2",
    sku: "EL-442",
    attributes: "100W / Mac certified",
    onHand: 9,
    reserved: 2,
    inbound: 24,
    weeksCover: 0.9,
    trendScore: 91,
    imageUrl: demoProductImageUrl("demo:EL-442:v5"),
  },
]

const INITIAL_SOURCES: TrendSource[] = [
  {
    id: "s1",
    name: "Industry wholesale index",
    kind: "market",
    enabled: true,
    detail: "North America B2B furniture",
  },
  {
    id: "s2",
    name: "Competitor promo tracker",
    kind: "pricing",
    enabled: true,
  },
  {
    id: "s3",
    name: "Odoo stock moves (system)",
    kind: "internal",
    enabled: true,
  },
  {
    id: "s4",
    name: "Supply chain news digest",
    kind: "news",
    enabled: false,
  },
]

type Persisted = {
  variants: InventoryVariant[]
  trendSources: TrendSource[]
  purchaseSignals: PurchaseSignal[]
  trendEvents: TrendEvent[]
  lastForecastAt: string | null
  predictionSummary: string
  odoo: OdooUiState
}

const defaultPersisted: Persisted = {
  variants: INITIAL_VARIANTS,
  trendSources: INITIAL_SOURCES,
  purchaseSignals: [],
  trendEvents: [],
  lastForecastAt: null,
  predictionSummary:
    "Run a composite forecast to blend market, system, and on-hand signals.",
  odoo: { ...defaultOdoo },
}

type AppDataContextValue = Persisted & {
  marketSeries: number[]
  systemSeries: number[]
  predictionBlend: number[]
  addTrendSource: (name: string, kind: TrendSourceKind, detail?: string) => void
  removeTrendSource: (id: string) => void
  toggleTrendSource: (id: string) => void
  refreshStockSnapshot: () => void
  exportVariantsCsv: () => void
  flagReorder: (variantId: string) => void
  generateSignalsFromInventory: (variantPool?: InventoryVariant[]) => number
  createManualSignal: (input: {
    sku: string
    variantLabel: string
    productName: string
    urgency: PurchaseSignal["urgency"]
    qty: number
    reason: string
  }) => void
  sendSignalToTrends: (signalId: string) => void
  dismissSignal: (signalId: string) => void
  runCompositeForecast: () => void
  simulateVariantSale: (variantId: string, qty: number) => void
  resetWorkspace: () => void
  recordOdooTestResult: (r: { ok: boolean; message: string }) => void
}

const AppDataContext = React.createContext<AppDataContextValue | null>(null)

function loadPersisted(): Persisted {
  if (typeof window === "undefined") return defaultPersisted
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return defaultPersisted
    const parsed = JSON.parse(raw) as Partial<Persisted>
    const baseVariants = parsed.variants?.length
      ? parsed.variants
      : defaultPersisted.variants
    const variantsWithImages: InventoryVariant[] = baseVariants.map((v) => ({
      ...v,
      imageUrl:
        typeof v.imageUrl === "string" && v.imageUrl.trim()
          ? v.imageUrl.trim()
          : demoProductImageUrl(`${v.sku}:${v.id}`),
    }))

    return {
      ...defaultPersisted,
      ...parsed,
      variants: variantsWithImages,
      trendSources: parsed.trendSources?.length
        ? parsed.trendSources
        : defaultPersisted.trendSources,
      purchaseSignals: parsed.purchaseSignals ?? [],
      trendEvents: parsed.trendEvents ?? [],
      predictionSummary:
        typeof parsed.predictionSummary === "string"
          ? parsed.predictionSummary
          : defaultPersisted.predictionSummary,
      lastForecastAt:
        parsed.lastForecastAt === undefined
          ? defaultPersisted.lastForecastAt
          : parsed.lastForecastAt,
      odoo: migrateOdooFromStorage(parsed.odoo),
    }
  } catch {
    return defaultPersisted
  }
}

function savePersisted(p: Persisted) {
  if (typeof window === "undefined") return
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(p))
  } catch {
    /* ignore quota */
  }
}

export function AppDataProvider({ children }: { children: React.ReactNode }) {
  const [hydrated, setHydrated] = React.useState(false)
  const [state, setState] = React.useState<Persisted>(defaultPersisted)

  React.useEffect(() => {
    setState(loadPersisted())
    setHydrated(true)
  }, [])

  React.useEffect(() => {
    if (!hydrated) return
    savePersisted(state)
  }, [state, hydrated])

  const marketSeries = React.useMemo(
    () => computeSeries(state.variants, state.trendSources, "market"),
    [state.variants, state.trendSources]
  )

  const systemSeries = React.useMemo(
    () => computeSeries(state.variants, state.trendSources, "system"),
    [state.variants, state.trendSources]
  )

  const predictionBlend = React.useMemo(
    () => blendPrediction(marketSeries, systemSeries),
    [marketSeries, systemSeries]
  )

  const patch = React.useCallback((fn: (prev: Persisted) => Persisted) => {
    setState((prev) => fn(prev))
  }, [])

  const addTrendSource = React.useCallback(
    (name: string, kind: TrendSourceKind, detail?: string) => {
      const trimmed = name.trim()
      if (!trimmed) return
      patch((prev) => ({
        ...prev,
        trendSources: [
          ...prev.trendSources,
          {
            id: uid(),
            name: trimmed,
            kind,
            enabled: true,
            detail,
          },
        ],
      }))
    },
    [patch]
  )

  const removeTrendSource = React.useCallback(
    (id: string) => {
      patch((prev) => ({
        ...prev,
        trendSources: prev.trendSources.filter((s) => s.id !== id),
      }))
    },
    [patch]
  )

  const toggleTrendSource = React.useCallback(
    (id: string) => {
      patch((prev) => ({
        ...prev,
        trendSources: prev.trendSources.map((s) =>
          s.id === id ? { ...s, enabled: !s.enabled } : s
        ),
      }))
    },
    [patch]
  )

  const refreshStockSnapshot = React.useCallback(() => {
    patch((prev) => ({
      ...prev,
      variants: prev.variants.map((v) => ({
        ...v,
        weeksCover: Math.max(
          0.3,
          +(v.weeksCover + (Math.random() * 0.4 - 0.2)).toFixed(1)
        ),
      })),
    }))
  }, [patch])

  const exportVariantsCsv = React.useCallback(() => {
    downloadVariantsCsv(state.variants)
  }, [state.variants])

  const flagReorder = React.useCallback(
    (variantId: string) => {
      const v = state.variants.find((x) => x.id === variantId)
      if (!v) return
      patch((prev) => {
        const exists = prev.purchaseSignals.some(
          (s) => s.sku === v.sku && s.variantLabel === v.attributes && !s.sentToTrends
        )
        if (exists) return prev
        const sig: PurchaseSignal = {
          id: uid(),
          sku: v.sku,
          variantLabel: v.attributes,
          productName: v.productName,
          urgency: v.weeksCover < 1.2 ? "high" : v.weeksCover < 2 ? "medium" : "low",
          qtySuggestion: Math.max(24, Math.round(50 - v.onHand * 0.3)),
          reason: `Weeks cover ${v.weeksCover} — flagged from inventory`,
          sentToTrends: false,
          createdAt: new Date().toISOString(),
        }
        return { ...prev, purchaseSignals: [sig, ...prev.purchaseSignals] }
      })
    },
    [state.variants, patch]
  )

  const generateSignalsFromInventory = React.useCallback(
    (variantPool?: InventoryVariant[]) => {
    let added = 0
    patch((prev) => {
      const pool = variantPool?.length ? variantPool : prev.variants
      const next = [...prev.purchaseSignals]
      for (const v of pool) {
        if (v.weeksCover > 1.5) continue
        const dup = next.some(
          (s) =>
            s.sku === v.sku &&
            s.variantLabel === v.attributes &&
            !s.sentToTrends
        )
        if (dup) continue
        next.unshift({
          id: uid(),
          sku: v.sku,
          variantLabel: v.attributes,
          productName: v.productName,
          urgency: v.weeksCover < 1 ? "high" : "medium",
          qtySuggestion: Math.max(16, 80 - v.onHand),
          reason: `Auto: low cover (${v.weeksCover} wk)`,
          sentToTrends: false,
          createdAt: new Date().toISOString(),
        })
        added++
      }
      return { ...prev, purchaseSignals: next }
    })
    return added
  },
  [patch]
)

  const createManualSignal = React.useCallback(
    (input: {
      sku: string
      variantLabel: string
      productName: string
      urgency: PurchaseSignal["urgency"]
      qty: number
      reason: string
    }) => {
      if (!input.sku.trim()) return
      patch((prev) => ({
        ...prev,
        purchaseSignals: [
          {
            id: uid(),
            sku: input.sku.trim(),
            variantLabel: input.variantLabel.trim() || "Default",
            productName: input.productName.trim() || "Product",
            urgency: input.urgency,
            qtySuggestion: Math.max(1, input.qty),
            reason: input.reason.trim() || "Manual entry",
            sentToTrends: false,
            createdAt: new Date().toISOString(),
          },
          ...prev.purchaseSignals,
        ],
      }))
    },
    [patch]
  )

  const sendSignalToTrends = React.useCallback(
    (signalId: string) => {
      patch((prev) => {
        const sig = prev.purchaseSignals.find((s) => s.id === signalId)
        if (!sig) return prev
        const event: TrendEvent = {
          id: uid(),
          label: `Purchase signal: ${sig.productName} (${sig.sku})`,
          at: new Date().toISOString(),
          kind: "signal",
        }
        return {
          ...prev,
          purchaseSignals: prev.purchaseSignals.map((s) =>
            s.id === signalId ? { ...s, sentToTrends: true } : s
          ),
          trendEvents: [event, ...prev.trendEvents].slice(0, 50),
        }
      })
    },
    [patch]
  )

  const dismissSignal = React.useCallback(
    (signalId: string) => {
      patch((prev) => ({
        ...prev,
        purchaseSignals: prev.purchaseSignals.filter((s) => s.id !== signalId),
      }))
    },
    [patch]
  )

  const runCompositeForecast = React.useCallback(() => {
    const m = marketSeries
    const s = systemSeries
    const last = blendPrediction(m, s)[m.length - 1] ?? 0
    const activeSources = state.trendSources.filter((x) => x.enabled).length
    const low = state.variants.filter((v) => v.weeksCover < 1.5).length
    const summary = `Blend index ${last} (market × system). ${activeSources} active source(s), ${low} variant(s) under 1.5× weeks cover — prioritize replenishment on high trend / low cover SKUs.`
    const forecastEvent = {
      id: uid(),
      label: `Composite forecast run → index ${last}`,
      at: new Date().toISOString(),
      kind: "forecast" as const,
    } satisfies TrendEvent
    patch((prev) => ({
      ...prev,
      lastForecastAt: new Date().toISOString(),
      predictionSummary: summary,
      trendEvents: [forecastEvent, ...prev.trendEvents].slice(0, 50),
    }))
  }, [marketSeries, systemSeries, state.trendSources, state.variants, patch])

  const simulateVariantSale = React.useCallback(
    (variantId: string, qty: number) => {
      patch((prev) => ({
        ...prev,
        variants: prev.variants.map((v) => {
          if (v.id !== variantId) return v
          const nextOn = Math.max(0, v.onHand - qty)
          const cover = +(nextOn / Math.max(8, v.reserved + 4)).toFixed(1)
          return {
            ...v,
            onHand: nextOn,
            weeksCover: Math.min(12, Math.max(0.2, cover)),
            trendScore: Math.min(100, v.trendScore + (qty > 10 ? 2 : 0)),
          }
        }),
      }))
    },
    [patch]
  )

  const resetWorkspace = React.useCallback(() => {
    setState(defaultPersisted)
    savePersisted(defaultPersisted)
  }, [])

  const recordOdooTestResult = React.useCallback(
    (r: { ok: boolean; message: string }) => {
      patch((prev) => ({
        ...prev,
        odoo: {
          lastTestAt: new Date().toISOString(),
          lastTestOk: r.ok,
          lastTestMessage: r.message,
        },
      }))
    },
    [patch]
  )

  const value = React.useMemo<AppDataContextValue>(
    () => ({
      ...state,
      marketSeries,
      systemSeries,
      predictionBlend,
      addTrendSource,
      removeTrendSource,
      toggleTrendSource,
      refreshStockSnapshot,
      exportVariantsCsv,
      flagReorder,
      generateSignalsFromInventory,
      createManualSignal,
      sendSignalToTrends,
      dismissSignal,
      runCompositeForecast,
      simulateVariantSale,
      resetWorkspace,
      recordOdooTestResult,
    }),
    [
      state,
      marketSeries,
      systemSeries,
      predictionBlend,
      addTrendSource,
      removeTrendSource,
      toggleTrendSource,
      refreshStockSnapshot,
      exportVariantsCsv,
      flagReorder,
      generateSignalsFromInventory,
      createManualSignal,
      sendSignalToTrends,
      dismissSignal,
      runCompositeForecast,
      simulateVariantSale,
      resetWorkspace,
      recordOdooTestResult,
    ]
  )

  return (
    <AppDataContext.Provider value={value}>{children}</AppDataContext.Provider>
  )
}

export function useAppData() {
  const ctx = React.useContext(AppDataContext)
  if (!ctx) {
    throw new Error("useAppData must be used within AppDataProvider")
  }
  return ctx
}
