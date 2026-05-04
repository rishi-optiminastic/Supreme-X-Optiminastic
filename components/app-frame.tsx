"use client"

import * as React from "react"
import Link from "next/link"
import { usePathname } from "next/navigation"
import { useTheme } from "next-themes"
import {
  RiCloseLine,
  RiHome5Line,
  RiMenuLine,
  RiMoonLine,
  RiPriceTag3Line,
  RiPulseLine,
  RiShoppingCart2Line,
  RiStackLine,
  RiSunLine,
  RiTimeLine,
} from "@remixicon/react"

import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import Image from "next/image"

type NavChild = { href: string; label: string }

type NavItem =
  | { href: string; label: string; icon: typeof RiHome5Line; children?: undefined }
  | {
    href: string
    label: string
    icon: typeof RiPulseLine
    children: readonly NavChild[]
  }

const links: readonly NavItem[] = [
  { href: "/", label: "Home", icon: RiHome5Line },
  {
    href: "/prediction",
    label: "Trends",
    icon: RiPulseLine,
    children: [
      { href: "/prediction", label: "Overview" },
      { href: "/prediction/trending-toys", label: "Global Trends" },
    ],
  },
  { href: "/rsp", label: "RSP", icon: RiPriceTag3Line },
  { href: "/purchase", label: "Order creation", icon: RiShoppingCart2Line },
  { href: "/pi", label: "PI", icon: RiStackLine },
  { href: "/stock-health", label: "PO", icon: RiStackLine },
] as const

const sectionHints: Record<string, string> = {
  "/": "Choose a workspace from the sidebar",
  "/prediction": "Demand strength, cover weeks, market read, and AI",
  "/prediction/trending-toys":
    "Search, filter by region, photos or links to shop and images",
  "/rsp": "Enter COGS, then review shelf prices, quote sheet, and share if needed",
  "/purchase": "Retailer templates, lines, mail or export filled files",
  "/stock-health": "Upload a PO, match lines to sellable stock, portfolio snapshot below",
  "/pi": "Upload a PI workbook, match lines to sellable stock, portfolio snapshot below",
  "/workflow": "Saved draft lines → Odoo PO / SO helpers",
}

function sectionForPath(pathname: string) {
  if (pathname === "/") {
    return { title: "Home", hint: sectionHints["/"]! }
  }
  if (pathname === "/prediction/trending-toys") {
    return {
      title: "Global toy trends",
      hint: sectionHints["/prediction/trending-toys"] ?? "",
    }
  }
  if (pathname.startsWith("/rsp/share/") || pathname.startsWith("/pricing/share/")) {
    return {
      title: "Shared RSP",
      hint: "Anyone with the link can edit this sheet.",
    }
  }
  if (pathname === "/pricing" || pathname.startsWith("/pricing/")) {
    return { title: "RSP", hint: sectionHints["/rsp"] ?? "" }
  }
  const hit = links.find(
    (l) => l.href !== "/" && (pathname === l.href || pathname.startsWith(`${l.href}/`))
  )
  if (hit) {
    return { title: hit.label, hint: sectionHints[hit.href] ?? "" }
  }
  if (pathname.startsWith("/inventory")) {
    return { title: "PO", hint: sectionHints["/stock-health"]! }
  }
  if (pathname.startsWith("/workflow")) {
    return { title: "Workflow", hint: sectionHints["/workflow"]! }
  }
  return { title: "Supreme Odoo", hint: "" }
}

function WorkspaceClock({ compact }: { compact?: boolean }) {
  const [now, setNow] = React.useState(() => new Date())
  React.useEffect(() => {
    const id = window.setInterval(() => setNow(new Date()), 30_000)
    return () => window.clearInterval(id)
  }, [])

  const time = now.toLocaleTimeString(undefined, {
    hour: "2-digit",
    minute: "2-digit",
  })
  const full = now.toLocaleString(undefined, {
    weekday: "short",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  })

  return (
    <div
      className={cn(
        "inline-flex items-center gap-2 rounded-lg border border-border/60 bg-muted/35 px-2.5 py-1 text-muted-foreground shadow-sm",
        compact ? "text-[11px] tabular-nums" : "text-xs tabular-nums"
      )}
      title="Local workspace time (updates every 30s)"
    >
      <RiTimeLine className="size-3.5 shrink-0 opacity-80" aria-hidden />
      <time dateTime={now.toISOString()} suppressHydrationWarning>
        {compact ? time : full}
      </time>
    </div>
  )
}

function ThemeToggle() {
  const { resolvedTheme, setTheme } = useTheme()
  const [mounted, setMounted] = React.useState(false)
  React.useEffect(() => setMounted(true), [])

  if (!mounted) {
    return <span className="size-9 shrink-0" aria-hidden />
  }

  const dark = resolvedTheme === "dark"
  return (
    <Button
      type="button"
      variant="ghost"
      size="icon"
      className="size-9 shrink-0"
      aria-label={dark ? "Switch to light mode" : "Switch to dark mode"}
      onClick={() => setTheme(dark ? "light" : "dark")}
    >
      {dark ? <RiSunLine className="size-5" /> : <RiMoonLine className="size-5" />}
    </Button>
  )
}

/** Surfaces the global “D” shortcut from theme-provider.tsx */
function ThemeHotkeyHint() {
  return (
    <p
      className="hidden max-w-[220px] truncate text-[11px] leading-snug text-muted-foreground lg:block"
      title="Press D when not typing in a field"
    >
      <kbd className="rounded border border-border/70 bg-muted/50 px-1 py-px font-mono text-[10px] text-foreground">
        D
      </kbd>{" "}
      outside inputs toggles theme
    </p>
  )
}

function NavLinks({
  pathname,
  onNavigate,
}: {
  pathname: string
  onNavigate?: () => void
}) {
  return (
    <nav className="flex flex-col gap-0.5 p-2">
      {links.map((item) => {
        const Icon = item.icon
        if (!item.children) {
          const active =
            item.href === "/"
              ? pathname === "/"
              : pathname === item.href || pathname.startsWith(`${item.href}/`)
          return (
            <Link
              key={item.href}
              href={item.href}
              onClick={onNavigate}
              className={cn(
                "flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
                active
                  ? "bg-primary text-primary-foreground shadow-sm"
                  : "text-muted-foreground hover:bg-muted hover:text-foreground"
              )}
            >
              <Icon className="size-[18px] shrink-0 opacity-90" aria-hidden />
              {item.label}
            </Link>
          )
        }

        const parentActive =
          pathname === item.href || pathname.startsWith(`${item.href}/`)

        return (
          <div key={item.href} className="flex flex-col gap-0.5">
            <Link
              href={item.href}
              onClick={onNavigate}
              className={cn(
                "flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
                parentActive
                  ? "bg-primary text-primary-foreground shadow-sm"
                  : "text-muted-foreground hover:bg-muted hover:text-foreground"
              )}
            >
              <Icon className="size-[18px] shrink-0 opacity-90" aria-hidden />
              {item.label}
            </Link>
            <div className="ml-2 flex flex-col gap-0.5 border-l border-border/60 pl-2">
              {item.children.map((child) => {
                const childActive =
                  child.href === "/prediction"
                    ? pathname === "/prediction"
                    : pathname === child.href
                return (
                  <Link
                    key={child.href + child.label}
                    href={child.href}
                    onClick={onNavigate}
                    className={cn(
                      "rounded-md px-3 py-1.5 text-[13px] font-medium transition-colors",
                      childActive
                        ? "bg-primary/15 text-primary"
                        : "text-muted-foreground hover:bg-muted hover:text-foreground"
                    )}
                  >
                    {child.label}
                  </Link>
                )
              })}
            </div>
          </div>
        )
      })}
    </nav>
  )
}

export function AppFrame({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const [mobileOpen, setMobileOpen] = React.useState(false)
  const section = sectionForPath(pathname)

  React.useEffect(() => {
    setMobileOpen(false)
  }, [pathname])

  React.useEffect(() => {
    if (!mobileOpen) return
    const prev = document.body.style.overflow
    document.body.style.overflow = "hidden"
    return () => {
      document.body.style.overflow = prev
    }
  }, [mobileOpen])

  return (
    <div className="flex min-h-svh flex-col bg-muted/40 text-foreground dark:bg-background md:flex-row">
      {/* Mobile: top bar (menu + context + new controls) */}
      <header className="sticky top-0 z-40 flex h-14 shrink-0 items-center gap-2 border-b border-border/40 bg-background/90 px-3 shadow-sm backdrop-blur-md dark:bg-background/80 md:hidden">
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="size-9 shrink-0"
          aria-expanded={mobileOpen}
          aria-label="Open menu"
          onClick={() => setMobileOpen(true)}
        >
          <RiMenuLine className="size-5" />
        </Button>
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-semibold text-foreground">{section.title}</p>
          {section.hint ? (
            <p className="truncate text-[10px] text-muted-foreground">{section.hint}</p>
          ) : null}
        </div>
        {/* <WorkspaceClock compact /> */}
        <ThemeToggle />
      </header>

      {mobileOpen ? (
        <>
          <button
            type="button"
            aria-label="Close menu"
            className="fixed inset-0 z-40 bg-black/50 md:hidden"
            onClick={() => setMobileOpen(false)}
          />
          <aside className="fixed left-0 top-0 z-50 flex h-full w-[min(18rem,100vw)] flex-col border-r border-border/40 bg-background shadow-xl md:hidden">
            <div className="flex h-14 items-center justify-between border-b border-border/40 px-4">
              <Link
                href="/"
                className="text-base font-semibold tracking-tight"
                onClick={() => setMobileOpen(false)}
              >
                Supreme <span className="text-primary">Odoo</span>
              </Link>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="size-9"
                aria-label="Close menu"
                onClick={() => setMobileOpen(false)}
              >
                <RiCloseLine className="size-5" />
              </Button>
            </div>
            <NavLinks pathname={pathname} onNavigate={() => setMobileOpen(false)} />
          </aside>
        </>
      ) : null}

      <aside className="hidden w-56 shrink-0 flex-col border-r border-border/40 bg-background/90 backdrop-blur-md dark:bg-background/80 md:sticky md:top-0 md:flex md:h-svh">
        <div className="border-b border-border/40 px-4 py-4">
          <Image src={"https://www.supremeworlds.com/wp-content/uploads/2022/11/supreme-world-logo-xl.png"} alt="Supreme AI" width={100} height={100} />
          {/* <span className="text-primary">AI</span> */}
        </div>
        <NavLinks pathname={pathname} />
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-30 hidden h-[54px] shrink-0 items-center justify-between gap-4 border-b border-border/40 bg-background/85 px-4  backdrop-blur-md dark:bg-background/80 md:flex lg:px-6">
          <div className="min-w-0">
            <h2 className="truncate text-sm font-semibold tracking-tight text-foreground">
              {section.title}
            </h2>
            {section.hint ? (
              <p className="truncate text-xs text-muted-foreground">{section.hint}</p>
            ) : null}
          </div>
          <div className="flex shrink-0 items-center gap-3">
            <ThemeHotkeyHint />
            {/* <WorkspaceClock /> */}
            <ThemeToggle />
          </div>
        </header>

        <main className=" max-w-7xl px-4 py-8 sm:py-10">
          {children}
        </main>
      </div>
    </div>
  )
}
