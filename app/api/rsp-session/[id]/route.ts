import { NextResponse } from "next/server"

import { Prisma } from "@/generated/prisma/client"
import { getPrisma } from "@/lib/prisma"
import { normalizeRspPayload, recomputePayload } from "@/lib/rsp-share-types"

export const runtime = "nodejs"

type Ctx = { params: Promise<{ id: string }> }

export async function GET(_req: Request, ctx: Ctx) {
  try {
    const { id } = await ctx.params
    const prisma = getPrisma()
    const row = await prisma.rspSession.findUnique({ where: { id } })
    if (!row) {
      return NextResponse.json({ error: "Not found" }, { status: 404 })
    }
    return NextResponse.json({
      id: row.id,
      createdAt: row.createdAt.toISOString(),
      updatedAt: row.updatedAt.toISOString(),
      kind: row.kind,
      payload: row.payload,
      bulkRows: row.bulkRows,
      token: row.token,
    })
  } catch (e) {
    console.error(e)
    return NextResponse.json({ error: "Database unavailable" }, { status: 503 })
  }
}

export async function PATCH(req: Request, ctx: Ctx) {
  try {
    const { id } = await ctx.params
    const body = (await req.json()) as { payload?: unknown; promoteToSingle?: boolean }
    if (body?.payload == null) {
      return NextResponse.json({ error: "Invalid payload" }, { status: 400 })
    }
    const payload = recomputePayload(normalizeRspPayload(body.payload))
    const prisma = getPrisma()
    try {
      const row = await prisma.rspSession.update({
        where: { id },
        data: {
          payload: payload as object,
          ...(body.promoteToSingle
            ? { kind: "single", bulkRows: Prisma.DbNull }
            : {}),
        },
      })
      return NextResponse.json({
        id: row.id,
        updatedAt: row.updatedAt.toISOString(),
        payload,
        kind: row.kind,
      })
    } catch {
      return NextResponse.json({ error: "Not found" }, { status: 404 })
    }
  } catch (e) {
    console.error(e)
    return NextResponse.json({ error: "Could not update" }, { status: 503 })
  }
}
