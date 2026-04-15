import { randomBytes } from "node:crypto"

import { NextResponse } from "next/server"

import { getPrisma } from "@/lib/prisma"

export const runtime = "nodejs"

type Ctx = { params: Promise<{ id: string }> }

export async function POST(req: Request, ctx: Ctx) {
  try {
    const { id } = await ctx.params
    const prisma = getPrisma()
    const existing = await prisma.rspSession.findUnique({ where: { id } })
    if (!existing) {
      return NextResponse.json({ error: "Not found" }, { status: 404 })
    }
    if (existing.token) {
      const origin = new URL(req.url).origin
      return NextResponse.json({
        token: existing.token,
        url: `${origin}/rsp/share/${existing.token}`,
      })
    }
    const token = randomBytes(18).toString("base64url")
    await prisma.rspSession.update({
      where: { id },
      data: { token },
    })
    const origin = new URL(req.url).origin
    return NextResponse.json({
      token,
      url: `${origin}/rsp/share/${token}`,
    })
  } catch (e) {
    console.error(e)
    return NextResponse.json({ error: "Could not create share link" }, { status: 503 })
  }
}
