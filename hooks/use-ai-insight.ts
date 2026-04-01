"use client"

import * as React from "react"

export type InsightResult = {
  summary?: string
  bullets?: string[]
  actions?: string[]
  purchaseHints?: { sku?: string; reason?: string; urgency?: string }[]
  error?: string
  parseWarning?: string
}

export function useAiInsight() {
  const [loading, setLoading] = React.useState(false)
  const [data, setData] = React.useState<InsightResult | null>(null)

  const run = React.useCallback(
    async (
      mode: "trends" | "signals" | "overview",
      payload: Record<string, unknown>
    ) => {
      setLoading(true)
      setData(null)
      try {
        const r = await fetch("/api/ai/insights", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ mode, payload }),
        })
        const j = (await r.json()) as InsightResult & { error?: string }
        if (!r.ok) {
          setData({ error: j.error ?? `HTTP ${r.status}` })
        } else {
          setData(j)
        }
      } catch (e) {
        setData({
          error: e instanceof Error ? e.message : "Request failed",
        })
      } finally {
        setLoading(false)
      }
    },
    []
  )

  return { loading, data, run, clear: () => setData(null) }
}
