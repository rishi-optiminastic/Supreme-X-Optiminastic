import type { InventoryVariant } from "@/lib/inventory-types"

const STORAGE_KEY = "supreme-odoo-workflow-v1"

export type RspApproval = {
  sku: string
  productId: string
  productName: string
  rspInr: number
  approvedAtIso: string
  landedCost?: number
  competitorPrice?: number
}

export type WorkflowPersisted = {
  rspBySku: Record<string, RspApproval>
}

function defaultState(): WorkflowPersisted {
  return { rspBySku: {} }
}

export function loadWorkflowState(): WorkflowPersisted {
  if (typeof window === "undefined") return defaultState()
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY)
    if (!raw) return defaultState()
    const parsed = JSON.parse(raw) as unknown
    if (!parsed || typeof parsed !== "object") return defaultState()
    const rspBySku = (parsed as WorkflowPersisted).rspBySku
    if (!rspBySku || typeof rspBySku !== "object") return defaultState()
    return { rspBySku }
  } catch {
    return defaultState()
  }
}

export function saveWorkflowState(next: WorkflowPersisted) {
  if (typeof window === "undefined") return
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next))
  } catch {
    /* ignore quota */
  }
}

export function approveRspForSku(
  v: InventoryVariant,
  rspInr: number,
  extras?: { landedCost?: number; competitorPrice?: number }
) {
  const cur = loadWorkflowState()
  const next: WorkflowPersisted = {
    rspBySku: {
      ...cur.rspBySku,
      [v.sku]: {
        sku: v.sku,
        productId: v.id,
        productName: v.productName,
        rspInr,
        approvedAtIso: new Date().toISOString(),
        landedCost: extras?.landedCost,
        competitorPrice: extras?.competitorPrice,
      },
    },
  }
  saveWorkflowState(next)
  return next
}

export function clearRspApproval(sku: string) {
  const cur = loadWorkflowState()
  const { [sku]: _, ...rest } = cur.rspBySku
  const next = { rspBySku: rest }
  saveWorkflowState(next)
  return next
}
