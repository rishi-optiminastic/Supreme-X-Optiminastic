import { NextResponse } from "next/server"

import { getPrisma } from "@/lib/prisma"
import { normalizeRspPayload, recomputePayload } from "@/lib/rsp-share-types"

export const runtime = "nodejs"

type Ctx = { params: Promise<{ token: string }> }

export async function GET(_req: Request, ctx: Ctx) {
  try {
    const { token } = await ctx.params
    const prisma = getPrisma()
    const session = await prisma.rspSession.findUnique({ where: { token } })
    if (session) {
      return NextResponse.json({
        id: session.id,
        token: session.token,
        payload: session.payload,
        createdAt: session.createdAt,
        updatedAt: session.updatedAt,
      })
    }
    const row = await prisma.rspShare.findUnique({ where: { token } })
    if (!row) {
      return NextResponse.json({ error: "Not found" }, { status: 404 })
    }
    return NextResponse.json(row)
  } catch (e) {
    console.error(e)
    return NextResponse.json({ error: "Database unavailable" }, { status: 503 })
  }
}

export async function PATCH(req: Request, ctx: Ctx) {
  try {
    const { token } = await ctx.params
    const body = (await req.json()) as { payload?: unknown }
    if (body?.payload == null) {
      return NextResponse.json({ error: "Invalid payload" }, { status: 400 })
    }
    const payload = recomputePayload(normalizeRspPayload(body.payload))
    const prisma = getPrisma()
    const session = await prisma.rspSession.findUnique({ where: { token } })
    if (session) {
      const row = await prisma.rspSession.update({
        where: { token },
        data: { payload: payload as object },
      })
      return NextResponse.json({
        id: row.id,
        token: row.token,
        payload: row.payload,
        createdAt: row.createdAt,
        updatedAt: row.updatedAt,
      })
    }
    try {
      const row = await prisma.rspShare.update({
        where: { token },
        data: { payload: payload as object },
      })
      return NextResponse.json(row)
    } catch {
      return NextResponse.json({ error: "Not found" }, { status: 404 })
    }
  } catch (e) {
    console.error(e)
    return NextResponse.json({ error: "Could not update" }, { status: 503 })
  }
}
