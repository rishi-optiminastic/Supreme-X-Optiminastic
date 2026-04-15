import { randomBytes } from "node:crypto"

import { NextResponse } from "next/server"

import { getPrisma } from "@/lib/prisma"
import {
  defaultRspPayload,
  normalizeRspPayload,
  recomputePayload,
  type RspSharePayload,
} from "@/lib/rsp-share-types"

export const runtime = "nodejs"

export async function POST(req: Request) {
  try {
    let payload: RspSharePayload
    const body = (await req.json().catch(() => ({}))) as { payload?: unknown }
    if (body?.payload != null) {
      payload = recomputePayload(normalizeRspPayload(body.payload))
    } else {
      payload = recomputePayload(defaultRspPayload())
    }

    const token = randomBytes(18).toString("base64url")
    const prisma = getPrisma()
    await prisma.rspShare.create({
      data: {
        token,
        payload: payload as object,
      },
    })
    const origin = new URL(req.url).origin
    return NextResponse.json({
      token,
      url: `${origin}/rsp/share/${token}`,
    })
  } catch (e) {
    console.error(e)
    return NextResponse.json(
      { error: "Could not create share. Check DATABASE_URL and run prisma db push." },
      { status: 503 }
    )
  }
}
