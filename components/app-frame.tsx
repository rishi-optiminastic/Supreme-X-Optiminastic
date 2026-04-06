"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"

import { cn } from "@/lib/utils"

const links = [
  { href: "/", label: "Home" },
  { href: "/workflow", label: "Workflow" },
  { href: "/prediction", label: "Demand" },
  { href: "/pricing", label: "Price" },
  { href: "/smart-orders", label: "Restock" },
  { href: "/stock-health", label: "Inventory" },
  { href: "/conversion", label: "Ideas" },
] as const

export function AppFrame({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()

  return (
    <div className="min-h-svh bg-muted/40 text-foreground dark:bg-background">
      <header className="sticky top-0 z-40 border-b border-border/40 bg-background/90 shadow-sm backdrop-blur-md dark:bg-background/80">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center gap-3 px-4 py-3.5 sm:gap-4">
          <Link
            href="/"
            className="mr-1 text-base font-semibold tracking-tight text-foreground"
          >
            Supreme{" "}
            <span className="text-primary">Odoo</span>
          </Link>
          <nav className="flex flex-wrap gap-1.5">
            {links.map(({ href, label }) => {
              const active =
                href === "/"
                  ? pathname === "/"
                  : pathname === href || pathname.startsWith(`${href}/`)
              return (
                <Link
                  key={href}
                  href={href}
                  className={cn(
                    "rounded-full px-3 py-1.5 text-xs font-medium transition-all",
                    active
                      ? "bg-primary text-primary-foreground shadow-sm"
                      : "text-muted-foreground hover:bg-muted hover:text-foreground"
                  )}
                >
                  {label}
                </Link>
              )
            })}
          </nav>
        </div>
      </header>
      <main className="mx-auto max-w-6xl px-4 py-8 sm:py-10">{children}</main>
    </div>
  )
}
