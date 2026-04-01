"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import {
  RiBarChartBoxLine,
  RiBox3Line,
  RiDashboardLine,
  RiSettings3Line,
  RiShoppingBag3Line,
  RiStore2Line,
} from "@remixicon/react"

import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarRail,
} from "@/components/ui/sidebar"
import { AnimatedGradientText } from "./ui/animated-gradient-text"

const nav = [
  { href: "/", label: "Overview", icon: RiDashboardLine },
  { href: "/inventory", label: "Inventory", icon: RiBox3Line },
  { href: "/trends", label: "Trends", icon: RiBarChartBoxLine },
  { href: "/signals", label: "Signals", icon: RiShoppingBag3Line },
  { href: "/warehouse", label: "Warehouse", icon: RiStore2Line },
  { href: "/settings", label: "Settings", icon: RiSettings3Line },
] as const

export function AppSidebar() {
  const pathname = usePathname()

  return (
    <Sidebar collapsible="icon">
      <SidebarHeader className="h-14 border-b border-sidebar-border/80 px-2 py-4">
        <div className="flex items-center gap-3 px-2">
          {/* <div className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-sidebar-primary text-sidebar-primary-foreground shadow-md shadow-sidebar-primary/25 ring-1 ring-sidebar-primary/20">
            <RiStore2Line className="size-[1.15rem]" aria-hidden />
          </div> */}
          <div className="grid min-w-0 flex-1 text-left leading-tight group-data-[collapsible=icon]:hidden">
            <AnimatedGradientText
              speed={2}
              colorFrom="#3b82f6"
              colorTo="#6366f1"
              className="truncate text-xl font-semibold tracking-tight text-sidebar-foreground/65"
            >
              SupremeWorlds AI
            </AnimatedGradientText>
          </div>
        </div>
      </SidebarHeader>
      <SidebarContent className="px-1 pt-2">
        <SidebarGroup className="px-0">
          <SidebarGroupLabel className="px-3 text-[11px] tracking-wider text-sidebar-foreground/55 uppercase">
            Main
          </SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu className="gap-0.5">
              {nav.map(({ href, label, icon: Icon }) => {
                const isActive =
                  href === "/"
                    ? pathname === "/"
                    : pathname === href || pathname.startsWith(`${href}/`)

                return (
                  <SidebarMenuItem key={href}>
                    <SidebarMenuButton
                      asChild
                      isActive={isActive}
                      tooltip={label}
                    >
                      <Link href={href}>
                        <Icon
                          className="size-4 shrink-0 opacity-90"
                          aria-hidden
                        />
                        <span>{label}</span>
                      </Link>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                )
              })}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
      <SidebarFooter className="border-t border-sidebar-border/80 p-2">
        <p className="truncate px-2 py-1 text-[10px] leading-relaxed text-sidebar-foreground/45 group-data-[collapsible=icon]:hidden">
          Ctrl/⌘ + B toggles this panel
        </p>
      </SidebarFooter>
      <SidebarRail />
    </Sidebar>
  )
}
