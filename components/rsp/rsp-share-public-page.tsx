"use client"

import * as React from "react"
import Link from "next/link"
import {
  RiCheckLine,
  RiClipboardLine,
  RiEditLine,
  RiFileList3Line,
  RiLinkM,
  RiPriceTag3Line,
} from "@remixicon/react"

import { Panel } from "@/components/panel"
import { Button } from "@/components/ui/button"
import { RspDashboard } from "@/components/rsp/rsp-dashboard"
import {
  defaultRspPayload,
  normalizeRspPayload,
  recomputePayload,
  type RspSharePayload,
} from "@/lib/rsp-share-types"
import { cn } from "@/lib/utils"

export function RspSharePublicPage({ token }: { token: string }) {
  const [payload, setPayload] = React.useState<RspSharePayload | null>(null)
  const [loading, setLoading] = React.useState(true)
  const [error, setError] = React.useState<string | null>(null)
  const [saving, setSaving] = React.useState(false)
  const [saveOk, setSaveOk] = React.useState(false)
  const [copied, setCopied] = React.useState(false)
  const [quoteOpen, setQuoteOpen] = React.useState(false)
  const saveTimer = React.useRef<ReturnType<typeof setTimeout> | null>(null)
  const saveOkTimer = React.useRef<ReturnType<typeof setTimeout> | null>(null)

  React.useEffect(() => {
    let cancelled = false
      ; (async () => {
        setLoading(true)
        setError(null)
        try {
          const r = await fetch(`/api/rsp-share/${encodeURIComponent(token)}`)
          const j = (await r.json()) as { payload?: unknown; error?: string }
          if (!r.ok) {
            setError(j.error ?? "Not found")
            setPayload(null)
            return
          }
          if (!cancelled) {
            const raw = j.payload ?? defaultRspPayload()
            setPayload(recomputePayload(normalizeRspPayload(raw)))
          }
        } catch {
          if (!cancelled) setError("Could not load")
        } finally {
          if (!cancelled) setLoading(false)
        }
      })()
    return () => {
      cancelled = true
    }
  }, [token])

  const persist = React.useCallback(
    (next: RspSharePayload) => {
      if (saveTimer.current) clearTimeout(saveTimer.current)
      saveTimer.current = setTimeout(async () => {
        setSaving(true)
        setSaveOk(false)
        try {
          const r = await fetch(`/api/rsp-share/${encodeURIComponent(token)}`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ payload: next }),
          })
          if (r.ok) {
            setSaveOk(true)
            if (saveOkTimer.current) clearTimeout(saveOkTimer.current)
            saveOkTimer.current = setTimeout(() => setSaveOk(false), 2000)
          }
        } catch {
          /* ignore */
        } finally {
          setSaving(false)
        }
      }, 450)
    },
    [token]
  )

  const onChange = React.useCallback(
    (next: RspSharePayload) => {
      const n = recomputePayload(next)
      setPayload(n)
      persist(n)
    },
    [persist]
  )

  const copyLink = async () => {
    try {
      await navigator.clipboard.writeText(window.location.href)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      setCopied(false)
    }
  }

  if (loading) {
    return (
      <div className="flex min-h-[45vh] flex-col items-center justify-center gap-3 px-4">
        <div className="size-8 animate-pulse rounded-full bg-primary/20" aria-hidden />
        <p className="text-sm text-muted-foreground">Loading shared RSP…</p>
      </div>
    )
  }

  if (error || !payload) {
    return (
      <div className="flex min-h-[40vh] flex-col items-center justify-center gap-3 px-4 text-center">
        <div className="flex size-12 items-center justify-center rounded-2xl bg-rose-500/10">
          <RiLinkM className="size-6 text-rose-500" aria-hidden />
        </div>
        <p className="text-sm font-medium text-destructive">{error ?? "Missing data"}</p>
        <p className="text-xs text-muted-foreground">This link may have expired or the token is invalid.</p>
        <Link href="/rsp" className="mt-2 text-sm font-medium text-primary hover:underline">
          → Create a new RSP calculation
        </Link>
      </div>
    )
  }

  return (
    <div className="max-w-7xl space-y-3 px-4 py-8 sm:py-10">
      {/* Header bar — matches pricing-workspace single-view style */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <div className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-primary/12 ring-1 ring-primary/20">
            <RiPriceTag3Line className="size-4 text-primary" aria-hidden />
          </div>
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="text-sm font-semibold tracking-tight">Shared RSP</h1>
              <span className="inline-flex items-center gap-1 rounded-full border border-emerald-500/25 bg-emerald-500/10 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-emerald-700 dark:text-emerald-300">
                <RiEditLine className="size-3" aria-hidden />
                Editable
              </span>
            </div>
            <p className="text-[11px] text-muted-foreground">
              Anyone with this link can edit — changes save automatically.
            </p>
          </div>
        </div>

        <div className="flex shrink-0 flex-wrap items-center gap-2">
          {/* Save status */}
          <span
            className={cn(
              "inline-flex items-center gap-1.5 rounded-full border border-border/70 bg-background px-2.5 py-1 text-xs text-muted-foreground transition-all",
              saving && "animate-pulse border-amber-500/40 text-amber-600 dark:text-amber-400",
              saveOk && "border-emerald-500/40 text-emerald-600 dark:text-emerald-400"
            )}
          >
            {saveOk ? (
              <RiCheckLine className="size-3.5" aria-hidden />
            ) : (
              <span
                className={cn(
                  "size-2 rounded-full",
                  saving ? "bg-amber-500 animate-pulse" : "bg-muted-foreground/40"
                )}
                aria-hidden
              />
            )}
            {saving ? "Saving…" : saveOk ? "Saved" : "Auto-save"}
          </span>

          <Button
            type="button"
            variant="outline"
            size="sm"
            className="gap-1.5"
            onClick={() => setQuoteOpen(true)}
          >
            <RiFileList3Line className="size-3.5" aria-hidden />
            Quote sheet
          </Button>

          <Button
            type="button"
            variant="outline"
            size="sm"
            className="gap-1.5"
            onClick={() => void copyLink()}
          >
            {copied ? (
              <RiCheckLine className="size-3.5 text-emerald-500" aria-hidden />
            ) : (
              <RiClipboardLine className="size-3.5" aria-hidden />
            )}
            {copied ? "Copied!" : "Copy link"}
          </Button>
        </div>
      </div>

      {/* Price breakdown panel */}
      <Panel className="overflow-hidden p-0">
        <div className="flex items-center gap-2.5 border-b border-border/50 px-4 py-3">
          <div className="flex size-7 shrink-0 items-center justify-center rounded-md bg-muted">
            <RiPriceTag3Line className="size-4 text-muted-foreground" aria-hidden />
          </div>
          <div>
            <h2 className="text-sm font-semibold">Price breakdown</h2>
            <p className="text-[11px] text-muted-foreground">
              Adjust costs, margins, and see real-time shelf prices — edits save to this link
            </p>
          </div>
        </div>
        <div className="p-4">
          <RspDashboard
            payload={payload}
            onChange={onChange}
            quoteOpen={quoteOpen}
            onQuoteOpenChange={setQuoteOpen}
          />
        </div>
      </Panel>

      {/* CTA */}
      <Panel className="border-primary/20 bg-primary/5 px-4 py-3.5">
        <p className="text-sm">
          <RiPriceTag3Line
            className="mr-1.5 inline size-4 align-text-bottom text-primary"
            aria-hidden
          />
          Ready to purchase?{" "}
          <Link href="/purchase" className="font-medium text-primary hover:underline">
            Create order →
          </Link>
        </p>
      </Panel>
    </div>
  )
}
