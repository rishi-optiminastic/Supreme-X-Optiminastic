import { cn } from "@/lib/utils"

const box = "shrink-0 overflow-hidden rounded-[2px]"

/** Recognizable marks (not official logos — simplified shapes for UI clarity). */
export function TrendingSourceBrandMark({
  type,
  className,
}: {
  type: string
  className?: string
}) {
  const c = cn(box, className)
  switch (type) {
    case "youtube":
      return (
        <span className={c} title="YouTube">
          <svg viewBox="0 0 24 18" className="size-4" aria-hidden>
            <rect width="24" height="18" rx="4" fill="#FF0000" />
            <path d="M10 5v8l7-4-7-4z" fill="#fff" />
          </svg>
        </span>
      )
    case "tiktok":
      return (
        <span className={c} title="TikTok">
          <svg viewBox="0 0 24 24" className="size-4" aria-hidden>
            <rect width="24" height="24" rx="5" fill="#000" />
            <path
              d="M14.5 6.5v7.5c0 1.7-1.3 3-3 3s-3-1.3-3-3V13h2v1c0 .6.4 1 1 1s1-.4 1-1V6.5h2z"
              fill="#25F4EE"
            />
            <path d="M14.5 6.5h2.5c0 2.2.2 3.8-.2 5.2-.3 1.2-.8 2-1.8 2.5V6.5z" fill="#FE2C55" />
          </svg>
        </span>
      )
    case "magazine":
      return (
        <span className={c} title="Magazine">
          <svg viewBox="0 0 24 24" className="size-4" aria-hidden>
            <rect x="4" y="3" width="16" height="18" rx="1" fill="#c2410c" />
            <rect x="6" y="5" width="12" height="3" fill="#fff7ed" />
            <rect x="6" y="10" width="12" height="1.5" fill="#fed7aa" opacity="0.9" />
            <rect x="6" y="13" width="8" height="1.5" fill="#fed7aa" opacity="0.7" />
            <rect x="6" y="16" width="10" height="1.5" fill="#fed7aa" opacity="0.5" />
          </svg>
        </span>
      )
    case "retail":
      return (
        <span className={c} title="Retail">
          <svg viewBox="0 0 24 24" className="size-4" aria-hidden>
            <path
              d="M5 9l1.5-4h11L19 9v10a2 2 0 01-2 2H7a2 2 0 01-2-2V9z"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.75"
              className="text-emerald-700 dark:text-emerald-400"
            />
            <path
              d="M9 13h6"
              stroke="currentColor"
              strokeWidth="1.5"
              className="text-emerald-700 dark:text-emerald-400"
            />
          </svg>
        </span>
      )
    case "blog":
      return (
        <span className={c} title="Blog">
          <svg viewBox="0 0 24 24" className="size-4" aria-hidden>
            <rect x="5" y="4" width="14" height="16" rx="1.5" fill="#0ea5e9" />
            <rect x="7.5" y="7" width="9" height="1.2" fill="#e0f2fe" />
            <rect x="7.5" y="10" width="7" height="1" fill="#bae6fd" />
            <rect x="7.5" y="12.5" width="9" height="1" fill="#bae6fd" />
          </svg>
        </span>
      )
    case "trade_show":
      return (
        <span className={c} title="Trade">
          <svg viewBox="0 0 24 24" className="size-4" aria-hidden>
            <path
              d="M12 3l2.4 5 5.4.8-3.9 3.8.9 5.4L12 15.9 7.2 18l.9-5.4L4.2 8.8l5.4-.8L12 3z"
              fill="#0891b2"
            />
          </svg>
        </span>
      )
    case "podcast":
      return (
        <span className={c} title="Podcast">
          <svg viewBox="0 0 24 24" className="size-4" aria-hidden>
            <circle cx="12" cy="14" r="4" fill="#6366f1" />
            <path
              d="M8 10v-1a4 4 0 018 0v1M10 8V7a2 2 0 014 0v1"
              stroke="#6366f1"
              strokeWidth="1.5"
              fill="none"
            />
          </svg>
        </span>
      )
    case "social":
      return (
        <span className={c} title="Social">
          <svg viewBox="0 0 24 24" className="size-4" aria-hidden>
            <circle cx="9" cy="10" r="3" fill="#8b5cf6" />
            <circle cx="16" cy="11" r="2.5" fill="#a78bfa" />
            <path
              d="M4 20c0-3 3-5 7-5s7 2 7 5"
              stroke="#8b5cf6"
              strokeWidth="1.5"
              fill="none"
            />
          </svg>
        </span>
      )
    default:
      return (
        <span className={c} title={type}>
          <svg viewBox="0 0 24 24" className="size-4 text-muted-foreground" aria-hidden>
            <circle cx="12" cy="12" r="8" fill="none" stroke="currentColor" strokeWidth="1.5" />
            <path d="M12 8v4l2 2" stroke="currentColor" strokeWidth="1.5" fill="none" />
          </svg>
        </span>
      )
  }
}
