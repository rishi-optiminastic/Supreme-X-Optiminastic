import Link from "next/link"
import {
  RiLineChartLine,
  RiPriceTag3Line,
  RiShoppingCart2Line,
  RiStackLine,
  RiLightbulbLine,
} from "@remixicon/react"

import { Panel } from "@/components/panel"

const tools = [
  {
    href: "/prediction",
    title: "Trends",
    body: "Demand spotlight across the catalog: trend scores, weeks of cover, market read, per-SKU planner, AI negotiation hints, and charts.",
    Icon: RiLineChartLine,
    accent: "text-sky-600 dark:text-sky-400",
    bg: "bg-sky-500/10",
    step: 1,
  },
  {
    href: "/rsp",
    title: "RSP",
    body: "Shelf pricing from landed cost: penetration, competitive, and premium scenarios with margin breakdown and reasoning.",
    Icon: RiPriceTag3Line,
    accent: "text-violet-600 dark:text-violet-400",
    bg: "bg-violet-500/10",
    step: 2,
  },
  {
    href: "/purchase",
    title: "Order creation",
    body: "Per-retailer templates, line items with rate and quantity, then mail or download the filled Excel/PDF. Inline stock check against your lines.",
    Icon: RiShoppingCart2Line,
    accent: "text-emerald-600 dark:text-emerald-400",
    bg: "bg-emerald-500/10",
    step: 3,
  },
  {
    href: "/stock-health",
    title: "PO",
    body: "Upload a PO workbook to match lines to the catalog and sellable stock, plus SKU health segments, capital hints, and table export.",
    Icon: RiStackLine,
    accent: "text-amber-600 dark:text-amber-400",
    bg: "bg-amber-500/10",
    step: 4,
  },
  {
    href: "/conversion",
    title: "Sales Ideas",
    body: "AI suggestions for bundles, promos, and channel strategy based on your best and slowest sellers.",
    Icon: RiLightbulbLine,
    accent: "text-rose-600 dark:text-rose-400",
    bg: "bg-rose-500/10",
    step: null,
  },
] as const

export default function HomePage() {
  return (
    <div className="space-y-10">
      <div className="max-w-2xl space-y-3">
        <p className="text-sm font-medium text-primary">AI-Powered Inventory Intelligence</p>
        <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">
          Smarter buying decisions for your Odoo inventory
        </h1>
        <p className="text-base leading-relaxed text-muted-foreground">
          Connect Odoo for a live catalog, then move through the sidebar tools: size demand and trends, set RSP from cost,
          build retailer order files, and double-check sellable stock—including by uploading a PO spreadsheet.
        </p>
      </div>

      {/* Pipeline overview */}
      <Panel className="flex flex-wrap items-center gap-2 px-4 py-3">
        <span className="text-xs font-medium text-muted-foreground">Typical flow:</span>
        {[
          "Trends",
          "RSP",
          "Order creation",
          "PO",
          "Sales ideas",
        ].map((label, i) => (
          <span key={label} className="flex items-center gap-1.5 text-xs">
            <span className="flex size-5 items-center justify-center rounded-full bg-primary/15 text-[10px] font-bold text-primary">{i + 1}</span>
            <span className="text-muted-foreground">{label}</span>
            {i < 4 && <span className="mx-0.5 text-border">→</span>}
          </span>
        ))}
      </Panel>

      <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {tools.map((t) => (
          <li key={t.href}>
            <Link href={t.href} className="group block h-full">
              <Panel className="relative h-full overflow-hidden p-5 transition-all duration-200 hover:border-primary/30 hover:shadow-md">
                <div className="mb-4 flex items-center justify-between">
                  <div
                    className={`inline-flex size-11 items-center justify-center rounded-xl ${t.bg}`}
                  >
                    <t.Icon className={`size-6 ${t.accent}`} aria-hidden />
                  </div>
                  {t.step != null && (
                    <span className="flex size-6 items-center justify-center rounded-full bg-primary/15 text-[10px] font-bold text-primary">
                      {t.step}
                    </span>
                  )}
                </div>
                <h2 className="text-lg font-semibold tracking-tight group-hover:text-primary">
                  {t.title}
                </h2>
                <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{t.body}</p>
                <span className="mt-4 inline-flex items-center gap-1 text-sm font-medium text-primary">
                  Open
                  <span aria-hidden className="transition-transform group-hover:translate-x-0.5">
                    →
                  </span>
                </span>
              </Panel>
            </Link>
          </li>
        ))}
      </ul>
    </div>
  )
}
