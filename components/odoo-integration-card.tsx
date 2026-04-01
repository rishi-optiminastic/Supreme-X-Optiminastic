"use client"

import * as React from "react"
import { RiCheckboxCircleLine, RiCloseCircleLine, RiExternalLinkLine, RiLoader4Line } from "@remixicon/react"

import { useAppData } from "@/components/app-data-context"
import { SurfaceCard } from "@/components/surface-card"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"

type Status = {
  configured: boolean
  urlHost: string
  databaseSet: boolean
  usernameSet: boolean
  apiKeySet: boolean
  openrouterConfigured: boolean
}

export function OdooIntegrationCard() {
  const { odoo, recordOdooTestResult } = useAppData()
  const [testing, setTesting] = React.useState(false)
  const [status, setStatus] = React.useState<Status | null>(null)

  React.useEffect(() => {
    let cancel = false
    ;(async () => {
      try {
        const r = await fetch("/api/odoo/status", { cache: "no-store" })
        const j = (await r.json()) as Status
        if (!cancel) setStatus(j)
      } catch {
        if (!cancel) setStatus(null)
      }
    })()
    return () => {
      cancel = true
    }
  }, [])

  const onTest = async () => {
    setTesting(true)
    try {
      const r = await fetch("/api/odoo/test", { method: "POST" })
      const j = (await r.json()) as {
        ok?: boolean
        message?: string
        uid?: number
        odooVersion?: string
      }
      const ok = j.ok === true
      const msg =
        j.message ??
        (ok
          ? `Authenticated (uid ${j.uid ?? "?"})${j.odooVersion ? ` · ${j.odooVersion}` : ""}`
          : "Request failed")
      recordOdooTestResult({ ok, message: msg })
    } catch (e) {
      recordOdooTestResult({
        ok: false,
        message: e instanceof Error ? e.message : "Network error",
      })
    } finally {
      setTesting(false)
    }
  }

  const Row = ({
    ok,
    label,
  }: {
    ok: boolean
    label: string
  }) => (
    <li className="flex items-center gap-2 text-xs">
      {ok ? (
        <RiCheckboxCircleLine className="size-4 shrink-0 text-emerald-600 dark:text-emerald-400" />
      ) : (
        <RiCloseCircleLine className="size-4 shrink-0 text-muted-foreground" />
      )}
      <span className={ok ? "text-foreground" : "text-muted-foreground"}>
        {label}
      </span>
    </li>
  )

  return (
    <SurfaceCard className="overflow-hidden p-0">
      <div className="border-b border-border/60 bg-linear-to-r from-primary/[0.07] via-muted/30 to-transparent px-6 py-4">
        <h2 className="text-sm font-semibold tracking-tight">Odoo integration</h2>
        <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
          Connection uses{" "}
          <span className="font-medium text-foreground">
            server environment variables
          </span>{" "}
          only — credentials are never stored in the browser.
          Add variables to{" "}
          <code className="rounded bg-muted px-1 py-0.5 text-[10px]">.env</code>{" "}
          and restart{" "}
          <code className="rounded bg-muted px-1 py-0.5 text-[10px]">
            next dev
          </code>
          .
        </p>
        <a
          href="https://www.odoo.com/documentation/master/developer/misc/api/odoo.html"
          target="_blank"
          rel="noopener noreferrer"
          className="mt-2 inline-flex items-center gap-1 text-xs font-medium text-primary underline-offset-4 hover:underline"
        >
          Odoo external API
          <RiExternalLinkLine className="size-3.5" aria-hidden />
        </a>
      </div>
      <div className="space-y-5 p-6">
        <div>
          <p className="mb-2 text-xs font-semibold text-foreground">
            Environment checklist
          </p>
          {status ? (
            <ul className="space-y-1.5 rounded-lg border border-border/60 bg-muted/25 p-3">
              <Row ok={status.configured} label="All Odoo variables set" />
              <Row
                ok={Boolean(status.urlHost)}
                label={`ODOO_URL${status.urlHost ? ` → ${status.urlHost}` : " (missing)"}`}
              />
              <Row ok={status.databaseSet} label="ODOO_DATABASE" />
              <Row ok={status.usernameSet} label="ODOO_USERNAME" />
              <Row ok={status.apiKeySet} label="ODOO_API_KEY" />
              <Row
                ok={status.openrouterConfigured}
                label="OPENROUTER_API_KEY (AI insights)"
              />
            </ul>
          ) : (
            <p className="text-xs text-muted-foreground">Loading status…</p>
          )}
        </div>

        <div className="rounded-lg border border-dashed border-border/80 bg-muted/15 p-3 font-mono text-[10px] leading-relaxed text-muted-foreground">
          ODOO_URL=https://yourcompany.odoo.com
          <br />
          ODOO_DATABASE=your_db_name
          <br />
          ODOO_USERNAME=your@login
          <br />
          ODOO_API_KEY=your_user_api_key
          <br />
          OPENROUTER_API_KEY=sk-or-…
          <br />
          <span className="text-foreground/80">
            OPENROUTER_MODEL=openai/gpt-4o-mini
          </span>{" "}
          (optional)
        </div>

        <div className="flex flex-wrap items-center gap-2 border-t border-border/50 pt-4">
          <Button
            type="button"
            disabled={testing || !status?.configured}
            className="gap-2"
            onClick={onTest}
          >
            {testing ? (
              <>
                <RiLoader4Line className="size-4 animate-spin" aria-hidden />
                Testing…
              </>
            ) : (
              "Test Odoo connection"
            )}
          </Button>
          {!status?.configured && (
            <p className="text-[11px] text-muted-foreground">
              Complete all Odoo env vars to enable the test.
            </p>
          )}
        </div>

        {odoo.lastTestAt && (
          <div
            className={cn(
              "rounded-lg border px-3 py-2 text-xs",
              odoo.lastTestOk
                ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-900 dark:text-emerald-200"
                : "border-amber-500/35 bg-amber-500/10 text-amber-950 dark:text-amber-200"
            )}
            role="status"
          >
            <p className="font-medium">
              {odoo.lastTestOk ? "Last test: success" : "Last test: failed"}
            </p>
            <p className="mt-1 text-xs opacity-90">{odoo.lastTestMessage}</p>
            <p className="mt-1 font-mono text-[10px] text-muted-foreground">
              {new Date(odoo.lastTestAt).toLocaleString()}
            </p>
          </div>
        )}
      </div>
    </SurfaceCard>
  )
}
