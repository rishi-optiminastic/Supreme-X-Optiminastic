import Link from "next/link"
import {
  RiGuideLine,
  RiLightbulbLine,
  RiLineChartLine,
  RiPriceTag3Line,
  RiShoppingCart2Line,
  RiStackLine,
} from "@remixicon/react"

import { Panel } from "@/components/panel"

const cards = [
  {
    href: "/workflow",
    title: "Workflow",
    body: "Demand → approved shelf price → purchase presets → stock check. Ties the screens together for your team.",
    Icon: RiGuideLine,
    accent: "text-primary",
    bg: "bg-primary/10",
  },
  {
    href: "/prediction",
    title: "Demand",
    body: "See how strong sales look for one SKU, what to order, and a simple weekly chart.",
    Icon: RiLineChartLine,
    accent: "text-sky-600 dark:text-sky-400",
    bg: "bg-sky-500/10",
  },
  {
    href: "/pricing",
    title: "Price",
    body: "Start from cost and competitor price, then get a suggested shelf price in rupees.",
    Icon: RiPriceTag3Line,
    accent: "text-violet-600 dark:text-violet-400",
    bg: "bg-violet-500/10",
  },
  {
    href: "/smart-orders",
    title: "Restock",
    body: "Suggested order quantities per SKU, with order now / wait hints you can copy out.",
    Icon: RiShoppingCart2Line,
    accent: "text-emerald-600 dark:text-emerald-400",
    bg: "bg-emerald-500/10",
  },
  {
    href: "/stock-health",
    title: "Inventory",
    body: "Which items look low, slow, or overstocked — at a glance and in a table.",
    Icon: RiStackLine,
    accent: "text-amber-600 dark:text-amber-400",
    bg: "bg-amber-500/10",
  },
  {
    href: "/conversion",
    title: "Ideas",
    body: "Starter promos and bundles based on your best and slow movers.",
    Icon: RiLightbulbLine,
    accent: "text-rose-600 dark:text-rose-400",
    bg: "bg-rose-500/10",
  },
] as const

export default function HomePage() {
  return (
    <div className="space-y-10">
      <div className="max-w-2xl space-y-3">
        <p className="text-sm font-medium text-primary">Shop tools</p>
        <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">
          Plan stock and prices from one place
        </h1>
        <p className="text-base leading-relaxed text-muted-foreground">
          Connect your client&apos;s Odoo in{" "}
          <code className="rounded-md bg-muted px-1.5 py-0.5 text-sm text-foreground">
            .env
          </code>{" "}
          for live products and optional 90-day sales. No Odoo? Demo data still runs the full
          workflow.
        </p>
      </div>
      <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {cards.map((c) => (
          <li key={c.href}>
            <Link href={c.href} className="group block h-full">
              <Panel className="relative h-full overflow-hidden p-5 transition-all duration-200 hover:border-primary/30 hover:shadow-md">
                <div
                  className={`mb-4 inline-flex size-11 items-center justify-center rounded-xl ${c.bg}`}
                >
                  <c.Icon className={`size-6 ${c.accent}`} aria-hidden />
                </div>
                <h2 className="text-lg font-semibold tracking-tight group-hover:text-primary">
                  {c.title}
                </h2>
                <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{c.body}</p>
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
