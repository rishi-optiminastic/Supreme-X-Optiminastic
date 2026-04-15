import { Suspense } from "react"

import { PredictionWorkspace } from "@/components/prediction-workspace"

export default function PredictionPage() {
  return (
    <Suspense
      fallback={
        <div className="animate-pulse rounded-xl border border-border/50 bg-muted/30 p-12 text-center text-sm text-muted-foreground">
          Loading workspace…
        </div>
      }
    >
      <PredictionWorkspace />
    </Suspense>
  )
}
