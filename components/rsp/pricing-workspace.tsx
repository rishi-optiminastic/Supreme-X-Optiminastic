"use client"

import * as React from "react"
import Link from "next/link"
import { useRouter, useSearchParams } from "next/navigation"
import {
  RiExternalLinkLine,
  RiFileList3Line,
  RiFundsLine,
  RiGlobalLine,
  RiHistoryLine,
  RiMapPinLine,
  RiPriceTag3Line,
  RiShareLine,
  RiStackLine,
} from "@remixicon/react"

import { Panel } from "@/components/panel"
import { Button } from "@/components/ui/button"
import { RspBulkTable, type RspBulkRow } from "@/components/rsp/rsp-bulk-table"
import { RspComposer } from "@/components/rsp/rsp-composer"
import { RspDashboard } from "@/components/rsp/rsp-dashboard"
import { RspHistorySidebar, type RspHistoryItem } from "@/components/rsp/rsp-history-sidebar"
import { RspMetricCard } from "@/components/rsp/rsp-metric-card"
import { parseExcelCogs } from "@/lib/parse-excel-cogs"
import {
  defaultRspPayload,
  deriveRspNumbers,
  normalizeRspPayload,
  recomputePayload,
  type RspSharePayload,
} from "@/lib/rsp-share-types"
import { cn } from "@/lib/utils"

function newRowId() {
  return typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : `r-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`
}

function toMoney(n: number) {
  return `AED ${Math.round(n).toLocaleString("en-AE")}`
}

type View = "idle" | "single" | "bulk"

function PricingWorkspaceClient() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const sessionParam = searchParams.get("session")

  const [view, setView] = React.useState<View>("idle")
  const [hydrating, setHydrating] = React.useState(Boolean(sessionParam))
  const [cogsInput, setCogsInput] = React.useState("")
  const [payload, setPayload] = React.useState<RspSharePayload>(() =>
    recomputePayload(defaultRspPayload())
  )
  const [bulkRows, setBulkRows] = React.useState<RspBulkRow[]>([])
  const [composerError, setComposerError] = React.useState<string | null>(null)
  const [excelBusy, setExcelBusy] = React.useState(false)

  const [sessionId, setSessionId] = React.useState<string | null>(null)
  const [history, setHistory] = React.useState<RspHistoryItem[]>([])
  const [historyLoading, setHistoryLoading] = React.useState(true)

  const [shareUrl, setShareUrl] = React.useState<string | null>(null)
  const [creatingLink, setCreatingLink] = React.useState(false)
  const [linkError, setLinkError] = React.useState<string | null>(null)
  const [copied, setCopied] = React.useState(false)
  const [recentOpen, setRecentOpen] = React.useState(false)
  const [quoteOpen, setQuoteOpen] = React.useState(false)

  const applyPayload = React.useCallback((next: RspSharePayload) => {
    setPayload(recomputePayload(next))
  }, [])

  const fetchHistory = React.useCallback(async () => {
    try {
      const r = await fetch("/api/rsp-session")
      const j = (await r.json()) as { sessions?: RspHistoryItem[] }
      if (Array.isArray(j.sessions)) setHistory(j.sessions)
    } catch {
      setHistory([])
    } finally {
      setHistoryLoading(false)
    }
  }, [])

  React.useEffect(() => {
    void fetchHistory()
  }, [fetchHistory])

  React.useEffect(() => {
    if (!sessionParam) {
      setHydrating(false)
      return
    }
    let cancelled = false
      ; (async () => {
        try {
          const r = await fetch(`/api/rsp-session/${encodeURIComponent(sessionParam)}`)
          if (!r.ok || cancelled) return
          const j = (await r.json()) as {
            id?: string
            kind?: string
            payload?: unknown
            bulkRows?: unknown
            token?: string | null
          }
          if (!j.id || cancelled) return
          const p = recomputePayload(normalizeRspPayload(j.payload))
          setPayload(p)
          setSessionId(j.id)
          if (j.kind === "bulk" && Array.isArray(j.bulkRows)) {
            setBulkRows(j.bulkRows as RspBulkRow[])
            setView("bulk")
          } else {
            setView("single")
          }
          if (j.token && typeof window !== "undefined") {
            setShareUrl(`${window.location.origin}/rsp/share/${j.token}`)
          } else {
            setShareUrl(null)
          }
        } catch {
          /* ignore */
        } finally {
          if (!cancelled) setHydrating(false)
        }
      })()
    return () => {
      cancelled = true
    }
  }, [sessionParam])

  React.useEffect(() => {
    if (view !== "single" || !sessionId) return
    const t = setTimeout(() => {
      void fetch(`/api/rsp-session/${encodeURIComponent(sessionId)}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ payload }),
      }).catch(() => { })
    }, 500)
    return () => clearTimeout(t)
  }, [payload, view, sessionId])

  const parseCogsFromText = (raw: string) => {
    const n = Number(String(raw).replace(/,/g, "").trim())
    if (!Number.isFinite(n) || n <= 0) return null
    return n
  }

  const persistRoute = React.useCallback(
    (id: string) => {
      router.replace(`/rsp?session=${encodeURIComponent(id)}`, { scroll: false })
    },
    [router]
  )

  const generateSingle = async () => {
    setComposerError(null)
    const n = parseCogsFromText(cogsInput)
    if (n == null) {
      setComposerError("Enter a positive COGS amount in AED (or upload a spreadsheet).")
      return
    }
    const nextPayload = recomputePayload({ ...payload, cogs: n })
    setPayload(nextPayload)
    try {
      const r = await fetch("/api/rsp-session", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ payload: nextPayload }),
      })
      const j = (await r.json()) as { id?: string }
      if (r.ok && j.id) {
        setSessionId(j.id)
        setShareUrl(null)
        persistRoute(j.id)
      }
    } catch {
      /* still show UI */
    }
    setView("single")
    void fetchHistory()
  }

  const onExcelFile = async (file: File) => {
    setComposerError(null)
    setExcelBusy(true)
    try {
      const buf = await file.arrayBuffer()
      const parsed = parseExcelCogs(buf)
      if (!parsed.length) {
        setComposerError(
          "No valid COGS rows found. Use a column named COGS, Cost, or Unit cost, or place amounts in the first numeric column."
        )
        return
      }
      const rows: RspBulkRow[] = parsed.map((r) => ({
        id: newRowId(),
        label: r.label,
        cogs: r.cogs,
      }))
      setBulkRows(rows)
      const base = recomputePayload(defaultRspPayload())
      setPayload(base)
      try {
        const r = await fetch("/api/rsp-session", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ kind: "bulk", payload: base, bulkRows: rows }),
        })
        const j = (await r.json()) as { id?: string }
        if (r.ok && j.id) {
          setSessionId(j.id)
          setShareUrl(null)
          persistRoute(j.id)
        }
      } catch {
        /* ignore */
      }
      setView("bulk")
      void fetchHistory()
    } catch {
      setComposerError("Could not read that file. Try .xlsx, .xls, or .csv.")
    } finally {
      setExcelBusy(false)
    }
  }

  const startOver = () => {
    setView("idle")
    setCogsInput("")
    setBulkRows([])
    setComposerError(null)
    setSessionId(null)
    setShareUrl(null)
    setLinkError(null)
    setPayload(recomputePayload(defaultRspPayload()))
    router.replace("/rsp", { scroll: false })
  }

  const loadSession = React.useCallback(
    async (id: string) => {
      try {
        const r = await fetch(`/api/rsp-session/${encodeURIComponent(id)}`)
        if (!r.ok) return
        const j = (await r.json()) as {
          kind?: string
          payload?: unknown
          bulkRows?: unknown
          token?: string | null
        }
        const p = recomputePayload(normalizeRspPayload(j.payload))
        setPayload(p)
        setSessionId(id)
        if (j.kind === "bulk" && Array.isArray(j.bulkRows)) {
          setBulkRows(j.bulkRows as RspBulkRow[])
          setView("bulk")
        } else {
          setView("single")
        }
        if (j.token && typeof window !== "undefined") {
          setShareUrl(`${window.location.origin}/rsp/share/${j.token}`)
        } else {
          setShareUrl(null)
        }
        router.replace(`/rsp?session=${encodeURIComponent(id)}`, { scroll: false })
        setRecentOpen(false)
      } catch {
        /* ignore */
      }
    },
    [router]
  )

  const createShareLink = React.useCallback(async () => {
    if (!sessionId) {
      setLinkError("Save a session first.")
      return
    }
    if (view !== "single") {
      setLinkError("Share link is available for single-scenario breakdowns.")
      return
    }
    setCreatingLink(true)
    setLinkError(null)
    try {
      const r = await fetch(`/api/rsp-session/${encodeURIComponent(sessionId)}/share`, {
        method: "POST",
      })
      const j = (await r.json()) as { url?: string; error?: string }
      if (!r.ok || !j.url) {
        setLinkError(j.error ?? "Could not create link.")
        setShareUrl(null)
        return
      }
      setShareUrl(j.url)
      void fetchHistory()
    } catch {
      setLinkError("Network error")
      setShareUrl(null)
    } finally {
      setCreatingLink(false)
    }
  }, [sessionId, view, fetchHistory])

  const copyLink = async () => {
    if (!shareUrl) return
    try {
      await navigator.clipboard.writeText(shareUrl)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      setCopied(false)
    }
  }

  // ─── Loading ──────────────────────────────────────────────────────────────
  if (hydrating) {
    return (
      <div className="flex h-full min-h-0 flex-1 flex-col items-center justify-center gap-3 px-4">
        <div className="size-8 animate-pulse rounded-full bg-primary/20" aria-hidden />
        <p className="text-sm text-muted-foreground">Loading session…</p>
      </div>
    )
  }

  // ─── Idle ─────────────────────────────────────────────────────────────────
  if (view === "idle") {
    return (
      <div className="flex h-full min-h-0 flex-col lg:flex-row">
        {/* Recent sessions sidebar — fixed width, full height */}
        <div className="flex w-full shrink-0 flex-col border-b border-border/40 lg:w-[280px] lg:border-b-0 lg:border-r">
          <div className="flex items-center gap-2.5 border-b border-border/50 px-4 py-3">
            <div className="flex size-7 shrink-0 items-center justify-center rounded-md bg-muted">
              <RiHistoryLine className="size-4 text-muted-foreground" aria-hidden />
            </div>
            <div className="min-w-0 flex-1">
              <h2 className="text-sm font-semibold tracking-tight">Recent sessions</h2>
              <p className="text-[11px] text-muted-foreground">Your saved RSP calculations</p>
            </div>
            {history.length > 0 && (
              <span className="ml-auto rounded-full bg-muted px-2 py-0.5 text-[11px] font-medium tabular-nums text-muted-foreground">
                {history.length}
              </span>
            )}
          </div>
          <div className="min-h-0 flex-1 overflow-y-auto p-2">
            <RspHistorySidebar
              className="rounded-none border-0 shadow-none ring-0"
              items={history}
              loading={historyLoading}
              activeId={sessionParam}
              onSelect={(id) => void loadSession(id)}
            />
          </div>
        </div>

        {/* Composer — fills remaining width + full height */}
        <div className="flex min-h-0 min-w-0 flex-1 flex-col">
          <div className="flex items-center gap-2.5 border-b border-border/50 px-4 py-3">
            <div className="flex size-7 shrink-0 items-center justify-center rounded-md bg-primary/10">
              <RiPriceTag3Line className="size-4 text-primary" aria-hidden />
            </div>
            <div>
              <h2 className="text-sm font-semibold tracking-tight">New calculation</h2>
              <p className="text-[11px] text-muted-foreground">
                Enter COGS or upload a spreadsheet to begin
              </p>
            </div>
          </div>
          <div className="flex min-h-0 flex-1 flex-col items-center justify-center px-6 py-10">
            <div className="w-full max-w-2xl">
              <RspComposer
                minimal
                fill
                docked
                className="max-w-none"
                value={cogsInput}
                onChange={setCogsInput}
                onSubmit={() => void generateSingle()}
                onExcelSelected={onExcelFile}
                excelBusy={excelBusy}
                error={composerError}
              />
            </div>
          </div>
        </div>
      </div>
    )
  }

  // ─── Bulk ─────────────────────────────────────────────────────────────────
  if (view === "bulk") {
    return (
      <div className="max-w-7xl space-y-3 px-4 py-8 sm:py-10">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <div className="flex size-7 shrink-0 items-center justify-center rounded-md bg-primary/10">
              <RiPriceTag3Line className="size-4 text-primary" aria-hidden />
            </div>
            <div>
              <h1 className="text-sm font-semibold tracking-tight">RSP · Bulk mode</h1>
              <p className="text-[11px] text-muted-foreground">
                Results from your spreadsheet — export or promote one row
              </p>
            </div>
          </div>
          <Button type="button" variant="outline" size="sm" onClick={startOver}>
            Start over
          </Button>
        </div>

        <div className="grid gap-3 lg:grid-cols-12">
          <Panel className="overflow-hidden p-0 lg:col-span-8">
            <div className="flex items-center gap-2.5 border-b border-border/50 px-4 py-3">
              <div className="flex size-7 shrink-0 items-center justify-center rounded-md bg-muted">
                <RiStackLine className="size-4 text-muted-foreground" aria-hidden />
              </div>
              <div>
                <h2 className="text-sm font-semibold">Bulk results</h2>
                <p className="text-[11px] text-muted-foreground">
                  {bulkRows.length} product{bulkRows.length !== 1 ? "s" : ""} loaded
                </p>
              </div>
            </div>
            <div className="p-3">
              <RspBulkTable payload={payload} rows={bulkRows} />
            </div>
          </Panel>

          <div className="space-y-3 lg:col-span-4">
            <Panel className="overflow-hidden p-0">
              <div className="flex items-center gap-2.5 border-b border-border/50 px-4 py-3">
                <div className="flex size-7 shrink-0 items-center justify-center rounded-md bg-muted">
                  <RiPriceTag3Line className="size-4 text-muted-foreground" aria-hidden />
                </div>
                <h2 className="text-sm font-semibold">Bulk actions</h2>
              </div>
              <div className="space-y-3 p-4">
                <div className="rounded-lg border border-border/60 bg-muted/30 p-3 text-xs text-muted-foreground">
                  Export controls and quote sheet are available in the table header above.
                </div>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="w-full gap-1.5"
                  onClick={() => {
                    const first = bulkRows[0]
                    if (!first || !sessionId) return
                    const next = recomputePayload({
                      ...payload,
                      cogs: first.cogs,
                      title: first.label,
                    })
                    setPayload(next)
                    void (async () => {
                      try {
                        await fetch(`/api/rsp-session/${encodeURIComponent(sessionId)}`, {
                          method: "PATCH",
                          headers: { "Content-Type": "application/json" },
                          body: JSON.stringify({ payload: next, promoteToSingle: true }),
                        })
                      } catch {
                        /* ignore */
                      }
                    })()
                    setView("single")
                    router.replace(`/rsp?session=${encodeURIComponent(sessionId)}`, {
                      scroll: false,
                    })
                    void fetchHistory()
                  }}
                >
                  Open first row in calculator
                </Button>
              </div>
            </Panel>

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
        </div>
      </div>
    )
  }

  // ─── Single / Calculator ──────────────────────────────────────────────────
  // Derive RSP numbers here so sidebar metric cards stay in sync with RspDashboard
  const d = deriveRspNumbers(payload)
  const maxRsp = Math.max(d.uaeRsp, d.regionRsp, d.SaudiRsp) || 1

  return (
    <div className="max-w-7xl space-y-3 px-4 py-8 sm:py-10">
      {/* Page header */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <div className="flex size-7 shrink-0 items-center justify-center rounded-md bg-primary/10">
            <RiStackLine className="size-4 text-primary" aria-hidden />
          </div>
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="text-sm font-semibold tracking-tight">RSP · Calculator</h1>
              {sessionId && (
                <span className="rounded-full border border-emerald-500/25 bg-emerald-500/10 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-emerald-700 dark:text-emerald-300">
                  Saved
                </span>
              )}
            </div>
            <p className="text-[11px] text-muted-foreground">
              Shelf prices once; edit everything on this page or the share link
            </p>
          </div>
        </div>

        <div className="flex shrink-0 flex-wrap items-center gap-2">
          {/* Share controls — leftmost, before Quote sheet */}
          {sessionId && (
            <>
              <Button
                type="button"
                variant="secondary"
                size="sm"
                className="gap-1.5"
                disabled={creatingLink || !payload.cogs}
                onClick={() => void createShareLink()}
              >
                <RiShareLine className="size-3.5" aria-hidden />
                {shareUrl ? "Link ready" : creatingLink ? "Creating…" : "Share link"}
              </Button>
              {shareUrl && (
                <>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="gap-1.5"
                    onClick={() => void copyLink()}
                  >
                    {copied ? (
                      <>✓ Copied</>
                    ) : (
                      "Copy link"
                    )}
                  </Button>
                  <a
                    href={shareUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex max-w-[min(200px,42vw)] items-center gap-1 truncate rounded-lg border border-border/60 bg-muted/30 px-2.5 py-1.5 text-xs font-medium text-primary hover:bg-muted/50"
                  >
                    Open
                    <RiExternalLinkLine className="size-3.5 shrink-0" aria-hidden />
                  </a>
                </>
              )}
            </>
          )}

          {/* Quote sheet */}
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

          <Button type="button" variant="outline" size="sm" onClick={startOver}>
            Start over
          </Button>
        </div>
      </div>

      {linkError && (
        <p className="text-xs text-rose-600 dark:text-rose-400">{linkError}</p>
      )}

      {/* Bento grid — left 8: full breakdown · right 4: metric cards + session */}
      <div className="grid gap-3 lg:grid-cols-6">
        {/* Main price breakdown panel */}
        <Panel className="overflow-hidden p-0 lg:col-span-8">
          {/* <div className="flex items-center gap-2.5 border-b border-border/50 px-4 py-3">
            <div className="flex size-7 shrink-0 items-center justify-center rounded-md bg-muted">
              <RiPriceTag3Line className="size-4 text-muted-foreground" aria-hidden />
            </div>
            <div>
              <h2 className="text-sm font-semibold">Price breakdown</h2>
              <p className="text-[11px] text-muted-foreground">
                Adjust costs, margins, and see real-time shelf prices
              </p>
            </div>
          </div> */}
          <div className="p-4">
            <RspDashboard
              payload={payload}
              onChange={applyPayload}
              quoteOpen={quoteOpen}
              onQuoteOpenChange={setQuoteOpen}
            />
          </div>
        </Panel>

        {/* <div className="space-y-3 lg:col-span-4">
          <RspMetricCard
            title="UAE RSP"
            value={toMoney(d.uaeRsp)}
            helper={`${payload.uaeVatPct}% VAT on shelf · pre-VAT ${toMoney(d.uaeBase)}`}
            tone="default"
            barPct={(d.uaeRsp / maxRsp) * 100}
            icon={<RiGlobalLine className="size-3.5" aria-hidden />}
          />

          <RspMetricCard
            title="Region RSP"
            value={toMoney(d.regionRsp)}
            helper={`${payload.regionFreightPct}% freight · landed ${toMoney(d.regionLanded)}`}
            tone="good"
            barPct={(d.regionRsp / maxRsp) * 100}
            icon={<RiMapPinLine className="size-3.5" aria-hidden />}
          />

          <RspMetricCard
            title="Saudi RSP"
            value={toMoney(d.SaudiRsp)}
            helper={`${payload.SaudiFreightPct}% freight + ${payload.SaudiVatPct}% VAT`}
            tone="warn"
            barPct={(d.SaudiRsp / maxRsp) * 100}
            icon={<RiFundsLine className="size-3.5" aria-hidden />}
          />

          {shareUrl && (
            <Panel className="overflow-hidden border-border/60 p-0">
              <div className="flex items-center gap-2.5 border-b border-border/50 px-3 py-2.5">
                <RiShareLine className="size-4 shrink-0 text-primary" aria-hidden />
                <p className="text-xs font-semibold">Share link ready</p>
              </div>
              <div className="space-y-2 p-3">
                <a
                  href={shareUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="block truncate text-xs font-medium text-primary hover:underline"
                >
                  {shareUrl}
                </a>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="w-full gap-1.5"
                  onClick={() => void copyLink()}
                >
                  {copied ? "Copied!" : "Copy link"}
                </Button>
              </div>
            </Panel>
          )}

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
        </div> */}
      </div>
    </div>
  )
}

export function PricingWorkspace() {
  return (
    <React.Suspense
      fallback={
        <div className="flex h-full min-h-0 flex-1 items-center justify-center px-4">
          <p className="text-sm text-muted-foreground">Loading workspace…</p>
        </div>
      }
    >
      <PricingWorkspaceInner />
    </React.Suspense>
  )
}

/** Thin shell that gives the idle view full-height treatment and non-idle views a padded container */
function PricingWorkspaceInner() {
  // We render PricingWorkspaceClient which manages view state.
  // We need to know if we're in idle mode to apply full-height styles.
  // Since PricingWorkspaceClient owns view state, we lift it slightly here
  // by passing a render prop pattern — simplest: just wrap with h-full always,
  // idle uses it, non-idle adds its own max-w padding inside.
  return (
    <div className="flex h-full min-h-0 flex-col">
      <PricingWorkspaceClient />
    </div>
  )
}