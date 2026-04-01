import { getOdooStatusPublic } from "@/lib/odoo/env"

export async function GET() {
  return Response.json(getOdooStatusPublic())
}
