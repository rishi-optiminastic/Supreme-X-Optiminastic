import { OdooIntegrationCard } from "@/components/odoo-integration-card"
import { PageHeader } from "@/components/page-header"
import { ResetWorkspaceCard } from "@/components/reset-workspace-card"
import { SurfaceCard } from "@/components/surface-card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"

export default function SettingsPage() {
  return (
    <div className="flex flex-1 flex-col gap-8 px-4 py-6 pb-12 md:px-6 md:py-8">
      <PageHeader
        title="Settings"
        description="Company profile, Odoo connection (saved in this browser), notifications, and workspace reset."
      />

      <div className="grid max-w-2xl gap-6">
        <OdooIntegrationCard />

        <SurfaceCard className="p-0 overflow-hidden">
          <div className="border-b border-border/60 bg-muted/20 px-6 py-4">
            <h2 className="text-sm font-semibold tracking-tight">Company</h2>
            <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
              Shown in reports and exports
            </p>
          </div>
          <div className="space-y-5 p-6">
            <div className="space-y-2">
              <label
                className="text-xs font-semibold text-foreground"
                htmlFor="company"
              >
                Display name
              </label>
              <Input id="company" defaultValue="Supreme Odoo" />
            </div>
            <div className="space-y-2">
              <label
                className="text-xs font-semibold text-foreground"
                htmlFor="timezone"
              >
                Time zone
              </label>
              <Input id="timezone" defaultValue="UTC" />
            </div>
          </div>
        </SurfaceCard>

        <SurfaceCard className="p-0 overflow-hidden">
          <div className="border-b border-border/60 bg-muted/20 px-6 py-4">
            <h2 className="text-sm font-semibold tracking-tight">
              Notifications
            </h2>
            <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
              Email digests for order exceptions
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-3 p-6">
            <Button type="button" variant="secondary">
              Daily summary
            </Button>
            <Button type="button" variant="outline">
              Weekly rollup
            </Button>
          </div>
        </SurfaceCard>

        <ResetWorkspaceCard />
      </div>
    </div>
  )
}
