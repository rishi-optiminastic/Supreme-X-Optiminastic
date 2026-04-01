import type { Metadata } from "next"

import { WarehouseDashboard } from "@/components/warehouse-dashboard"

export const metadata: Metadata = {
  title: "Warehouse operations",
  description:
    "Floor control: dock utilization, zone capacity, inbound vs outbound, and live catalog context for stakeholder walkthroughs.",
}

export default function WarehousePage() {
  return <WarehouseDashboard />
}
