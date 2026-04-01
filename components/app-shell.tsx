"use client"

import type { ReactNode } from "react"
import { usePathname } from "next/navigation"

import { TooltipProvider } from "@/components/ui/tooltip"
import {
  SidebarInset,
  SidebarProvider,
  SidebarTrigger,
} from "@/components/ui/sidebar"
import { AppDataProvider } from "@/components/app-data-context"
import { AppSidebar } from "@/components/app-sidebar"
import { Separator } from "@/components/ui/separator"

function ShellHeader() {
  const pathname = usePathname()

  const crumb =
    pathname === "/"
      ? "Overview"
      : pathname.startsWith("/inventory")
        ? "Inventory"
        : pathname.startsWith("/warehouse")
          ? "Warehouse"
          : pathname.startsWith("/trends")
            ? "Trends"
            : pathname.startsWith("/signals")
              ? "Signals"
              : pathname.startsWith("/settings")
                ? "Settings"
                : "App"

  return (
    <header className="flex h-14 shrink-0 items-center gap-3 border-b border-border/60 bg-background/75 px-4 backdrop-blur-md supports-backdrop-filter:bg-background/55">
      <SidebarTrigger />
      {/* <Separator orientation="vertical" className="hidden h-6 sm:block" /> */}
      <p className="hidden min-w-0 truncate text-sm font-medium text-foreground sm:block">
        {crumb}
      </p>
      <div className="ml-auto flex items-center gap-2">
        <span className="inline-flex items-center gap-2 rounded-full border border-border/70 bg-muted/35 px-3 py-1 text-xs font-medium text-muted-foreground tabular-nums shadow-sm">
          <span
            className="size-2 shrink-0 rounded-full bg-emerald-500 shadow-[0_0_0_2px_var(--background)] ring-1 ring-emerald-600/30 dark:bg-emerald-400"
            aria-hidden
          />
          Synced · just now
        </span>
      </div>
    </header>
  )
}

export function AppShell({ children }: { children: ReactNode }) {
  return (
    <TooltipProvider delayDuration={0}>
      <AppDataProvider>
        <SidebarProvider>
          <AppSidebar />
          <SidebarInset className="relative overflow-hidden">
            <div
              className="pointer-events-none absolute inset-0 -z-10 bg-[radial-gradient(ellipse_85%_55%_at_50%_-12%,var(--primary)_0%,transparent_58%)] opacity-[0.11] dark:opacity-[0.14]"
              aria-hidden
            />
            <div className="flex min-h-0 flex-1 flex-col bg-linear-to-b from-muted/25 via-background to-background">
              <ShellHeader />
              <div className="mx-auto flex w-full max-w-[1480px] flex-1 flex-col">
                {children}
              </div>
            </div>
          </SidebarInset>
        </SidebarProvider>
      </AppDataProvider>
    </TooltipProvider>
  )
}
