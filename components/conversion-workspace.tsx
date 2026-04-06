"use client"

import * as React from "react"

import { Panel } from "@/components/panel"
import { useVariantsWithOdoo } from "@/hooks/use-variants-with-odoo"
import { purchaseToSalesIdeas } from "@/lib/intelligence"

export function ConversionWorkspace() {
  const { variants } = useVariantsWithOdoo()
  const ideas = React.useMemo(() => purchaseToSalesIdeas(variants), [variants])

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Ideas</h1>
        <p className="mt-1 max-w-2xl text-sm leading-relaxed text-muted-foreground">
          Simple prompts for bundles and sales built from your best and slow SKUs — swap in your
          own plans anytime.
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        {ideas.map((idea) => (
          <Panel key={idea.title} className="space-y-2 border-primary/15 p-5">
            <p className="text-xs font-medium text-primary">{idea.channel}</p>
            <h2 className="text-base font-semibold">{idea.title}</h2>
            <p className="text-sm text-muted-foreground">{idea.detail}</p>
          </Panel>
        ))}
      </div>
    </div>
  )
}
