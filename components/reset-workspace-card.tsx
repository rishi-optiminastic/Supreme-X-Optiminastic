"use client"

import { useAppData } from "@/components/app-data-context"
import { SurfaceCard } from "@/components/surface-card"
import { Button } from "@/components/ui/button"

export function ResetWorkspaceCard() {
  const { resetWorkspace } = useAppData()

  return (
    <SurfaceCard className="border-destructive/20 p-4 ring-destructive/10">
      <h2 className="text-sm font-semibold tracking-tight">Workspace data</h2>
      <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
        Clears saved inventory adjustments, trend sources, purchase signals,
        forecast history, and Odoo connection fields from this browser
        (localStorage).
      </p>
      <Button
        type="button"
        variant="destructive"
        size="sm"
        className="mt-4"
        onClick={() => {
          if (
            typeof window !== "undefined" &&
            window.confirm("Reset all interactive workspace data in this browser?")
          ) {
            resetWorkspace()
          }
        }}
      >
        Reset workspace data
      </Button>
    </SurfaceCard>
  )
}
