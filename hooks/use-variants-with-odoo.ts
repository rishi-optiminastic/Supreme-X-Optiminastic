"use client"

import { DEMO_VARIANTS } from "@/lib/demo-variants"
import { useOdooLive } from "@/hooks/use-odoo-live"

export function useVariantsWithOdoo() {
  const live = useOdooLive()

  const useLive =
    live.connected && !live.loading && live.variants.length > 0

  return {
    variants: useLive ? live.variants : DEMO_VARIANTS,
    source: useLive ? ("odoo" as const) : ("demo" as const),
    odooLoading: live.loading,
    odooError: live.error,
    odooMessage: live.message,
    refetchOdoo: live.refetch,
    liveOrders: live.orders,
    odooConnected: live.connected,
    productCount: live.productCount,
  }
}
