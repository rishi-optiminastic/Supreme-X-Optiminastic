"use client"

import * as React from "react"

import {
  approveRspForSku,
  clearRspApproval,
  loadWorkflowState,
  type RspApproval,
  type WorkflowPersisted,
} from "@/lib/workflow-storage"
import type { InventoryVariant } from "@/lib/inventory-types"

export function useWorkflowState() {
  const [state, setState] = React.useState<WorkflowPersisted>(() => ({
    rspBySku: {},
  }))

  React.useEffect(() => {
    setState(loadWorkflowState())
  }, [])

  const approveRsp = React.useCallback(
    (
      v: InventoryVariant,
      rspInr: number,
      extras?: { landedCost?: number; competitorPrice?: number }
    ) => {
      const next = approveRspForSku(v, rspInr, extras)
      setState(next)
    },
    []
  )

  const revokeRsp = React.useCallback((sku: string) => {
    const next = clearRspApproval(sku)
    setState(next)
  }, [])

  const refresh = React.useCallback(() => {
    setState(loadWorkflowState())
  }, [])

  const approvals = React.useMemo(
    () => Object.values(state.rspBySku) as RspApproval[],
    [state.rspBySku]
  )

  return { state, approvals, approveRsp, revokeRsp, refresh }
}
