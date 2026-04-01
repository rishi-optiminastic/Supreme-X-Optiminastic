import type { InventoryVariant } from "@/components/app-data-context"

export function downloadVariantsCsv(
  variants: InventoryVariant[],
  filenamePrefix = "inventory-variants"
) {
  const rows = [
    [
      "sku",
      "product",
      "variant",
      "on_hand",
      "reserved",
      "inbound",
      "weeks_cover",
      "trend_score",
    ],
    ...variants.map((v) => [
      v.sku,
      v.productName,
      v.attributes,
      String(v.onHand),
      String(v.reserved),
      String(v.inbound),
      String(v.weeksCover),
      String(v.trendScore),
    ]),
  ]
  const blob = new Blob([rows.map((r) => r.join(",")).join("\n")], {
    type: "text/csv;charset=utf-8",
  })
  const a = document.createElement("a")
  a.href = URL.createObjectURL(blob)
  a.download = `${filenamePrefix}-${new Date().toISOString().slice(0, 10)}.csv`
  a.click()
  URL.revokeObjectURL(a.href)
}
