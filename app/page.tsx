import Link from "next/link"
import {
  RiGuideLine,
  RiLineChartLine,
  RiPriceTag3Line,
  RiShoppingCart2Line,
  RiStackLine,
  RiLightbulbLine,
} from "@remixicon/react"

import { Panel } from "@/components/panel"

const tools = [
  {
    href: "/workflow",
    title: "Workflow",
    body: "End-to-end execution flow: retailer order creation, Odoo purchase/sales steps, then verify stock availability before committing.",
    Icon: RiGuideLine,
    accent: "text-primary",
    bg: "bg-primary/10",
    step: null,
  },
  {
    href: "/prediction",
    title: "Trend Prediction",
    body: "AI-powered demand analysis. Is this product worth buying? Get a demand score, supplier negotiation tips, and market signals.",
    Icon: RiLineChartLine,
    accent: "text-sky-600 dark:text-sky-400",
    bg: "bg-sky-500/10",
    step: 1,
  },
  {
    href: "/pricing",
    title: "RSP Generator",
    body: "AI pricing strategies: Penetration, Competitive, Premium. Enter your cost → get a shelf price with margin analysis and reasoning.",
    Icon: RiPriceTag3Line,
    accent: "text-violet-600 dark:text-violet-400",
    bg: "bg-violet-500/10",
    step: 2,
  },
  {
    href: "/purchase",
    title: "Retailer order creation",
    body: "Store each retailer’s order template, add products with rate and quantity, then mail or download the filled order form. Save lines for Odoo when needed.",
    Icon: RiShoppingCart2Line,
    accent: "text-emerald-600 dark:text-emerald-400",
    bg: "bg-emerald-500/10",
    step: 3,
  },
  {
    href: "/stock-health",
    title: "Stock Health",
    body: "Every SKU labelled: running low, selling well, overstocked, dead stock. Filter, sort, estimate tied-up capital, export CSV.",
    Icon: RiStackLine,
    accent: "text-amber-600 dark:text-amber-400",
    bg: "bg-amber-500/10",
    step: null,
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
          Connect your Odoo account and run one clean process: create retailer orders from saved templates,
          push lines through purchase and sales in Odoo when needed, and verify whether requested quantities are available in inventory.
        </p>
      </div>

      {/* Pipeline overview */}
      <Panel className="flex flex-wrap items-center gap-2 px-4 py-3">
        <span className="text-xs font-medium text-muted-foreground">Pipeline:</span>
        {[
          "Trend Prediction",
          "RSP Generator",
          "Retailer order creation",
          "Convert PO to SO",
          "Verify Inventory Stock",
          "Finalize Action",
        ].map((label, i) => (
          <span key={label} className="flex items-center gap-1.5 text-xs">
            <span className="flex size-5 items-center justify-center rounded-full bg-primary/15 text-[10px] font-bold text-primary">{i + 1}</span>
            <span className="text-muted-foreground">{label}</span>
            {i < 5 && <span className="mx-0.5 text-border">→</span>}
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
