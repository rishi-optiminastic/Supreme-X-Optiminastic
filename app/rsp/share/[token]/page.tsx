import { RspSharePublicPage } from "@/components/rsp/rsp-share-public-page"

export default async function RspSharePage({
  params,
}: {
  params: Promise<{ token: string }>
}) {
  const { token } = await params
  return <RspSharePublicPage token={token} />
}
