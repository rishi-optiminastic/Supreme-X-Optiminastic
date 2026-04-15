import { redirect } from "next/navigation"

export default async function LegacyPricingSharePage({
  params,
}: {
  params: Promise<{ token: string }>
}) {
  const { token } = await params
  redirect(`/rsp/share/${encodeURIComponent(token)}`)
}
