import { NextResponse } from "next/server"

import { getPrisma } from "@/lib/prisma"
import {
  defaultRspPayload,
  normalizeRspPayload,
  recomputePayload,
} from "@/lib/rsp-share-types"

export const runtime = "nodejs"

type BulkRow = { id: string; label: string; cogs: number }

function isBulkRow(x: unknown): x is BulkRow {
  if (!x || typeof x !== "object") return false
  const o = x as Record<string, unknown>
  return (
    typeof o.id === "string" &&
    typeof o.label === "string" &&
    typeof o.cogs === "number"
  )
}

export async function GET() {
  try {
    const prisma = getPrisma()
    const rows = await prisma.rspSession.findMany({
      orderBy: { createdAt: "desc" },
      take: 40,
      select: {
        id: true,
        createdAt: true,
        kind: true,
        payload: true,
        bulkRows: true,
        token: true,
      },
    })
    const sessions = rows.map((r) => {
      const payload = normalizeRspPayload(r.payload)
      const cogs = payload.cogs
      const title =
        typeof payload?.title === "string" && payload.title.trim()
          ? payload.title.trim()
          : r.kind === "bulk"
            ? "Bulk import"
            : `COGS ${cogs > 0 ? `₹${Math.round(cogs).toLocaleString("en-IN")}` : "—"}`
      const bulkCount =
        r.kind === "bulk" && Array.isArray(r.bulkRows) ? (r.bulkRows as unknown[]).length : 0
      return {
        id: r.id,
        createdAt: r.createdAt.toISOString(),
        kind: r.kind,
        title,
        subtitle:
          r.kind === "bulk"
            ? `${bulkCount} line${bulkCount === 1 ? "" : "s"}`
            : cogs > 0
              ? "Single scenario"
              : "Draft",
        hasShare: Boolean(r.token),
      }
    })
    return NextResponse.json({ sessions })
  } catch (e) {
    console.error(e)
    return NextResponse.json({ sessions: [] as unknown[] })
  }
}

export async function POST(req: Request) {
  try {
    const body = (await req.json().catch(() => ({}))) as {
      payload?: unknown
      kind?: string
      bulkRows?: unknown
    }
    const kind = body.kind === "bulk" ? "bulk" : "single"
    const payload = recomputePayload(normalizeRspPayload(body.payload ?? defaultRspPayload()))

    let bulkJson: object | undefined
    if (kind === "bulk" && Array.isArray(body.bulkRows)) {
      const rows = body.bulkRows.filter(isBulkRow)
      if (rows.length) bulkJson = rows as object
    }

    const prisma = getPrisma()
    const row = await prisma.rspSession.create({
      data: {
        kind,
        payload: payload as object,
        ...(bulkJson ? { bulkRows: bulkJson } : {}),
      },
    })
    return NextResponse.json({
      id: row.id,
      payload,
      createdAt: row.createdAt.toISOString(),
      kind: row.kind,
    })
  } catch (e) {
    console.error(e)
    return NextResponse.json(
      { error: "Could not save session. Check DATABASE_URL and run pnpm prisma db push." },
      { status: 503 }
    )
  }
}
