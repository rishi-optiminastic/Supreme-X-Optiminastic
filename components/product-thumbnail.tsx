"use client"

import { cn } from "@/lib/utils"
import { resolveVariantImageUrl, type VariantImageFields } from "@/lib/variant-image"

const sizeClass = {
  sm: "size-9",
  md: "size-11",
  lg: "size-14",
} as const

export function ProductThumbnail({
  variant,
  size = "md",
  className,
}: {
  variant: VariantImageFields & { productName?: string }
  size?: keyof typeof sizeClass
  className?: string
}) {
  const src = resolveVariantImageUrl(variant)
  const alt = variant.productName
    ? `${variant.productName} (${variant.sku})`
    : `Product ${variant.sku}`

  return (
    <span
      className={cn(
        "relative inline-flex shrink-0 overflow-hidden rounded-lg bg-muted ring-1 ring-border/60",
        sizeClass[size],
        className
      )}
    >
      <img
        src={src}
        alt={alt}
        className="size-full object-cover"
        loading="lazy"
        decoding="async"
      />
    </span>
  )
}
