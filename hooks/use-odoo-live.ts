"use client"

import * as React from "react"

import type { InventoryVariant } from "@/lib/inventory-types"
import type { OdooOrderDTO, OdooVariantDTO } from "@/lib/odoo/types"

export type OdooLiveState = {
  loading: boolean
  connected: boolean
  variants: InventoryVariant[]
  orders: OdooOrderDTO[]
  error: string | null
  message?: string
  productCount?: number
}

export function useOdooLive() {
  const [state, setState] = React.useState<OdooLiveState>({
    loading: true,
    connected: false,
    variants: [],
    orders: [],
    error: null,
  })

  const load = React.useCallback(async () => {
    setState((s) => ({ ...s, loading: true, error: null }))
    try {
      const r = await fetch("/api/odoo/dashboard", { cache: "no-store" })
      const j = (await r.json()) as {
        connected?: boolean
        variants?: OdooVariantDTO[]
        orders?: OdooOrderDTO[]
        error?: string
        message?: string
        productCount?: number
      }
      setState({
        loading: false,
        connected: j.connected === true,
        variants: (j.variants ?? []) as InventoryVariant[],
        orders: j.orders ?? [],
        error: j.error ?? null,
        message: j.message,
        productCount: j.productCount,
      })
    } catch (e) {
      setState({
        loading: false,
        connected: false,
        variants: [],
        orders: [],
        error: e instanceof Error ? e.message : "Network error",
      })
    }
  }, [])

  React.useEffect(() => {
    void load()
  }, [load])

  return { ...state, refetch: load }
}
