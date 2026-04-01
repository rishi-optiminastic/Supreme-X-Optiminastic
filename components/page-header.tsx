import { cn } from "@/lib/utils"

type PageHeaderProps = {
  title: string
  description: string
  eyebrow?: string
  className?: string
  /** For aria-labelledby on parent sections */
  id?: string
}

export function PageHeader({
  title,
  description,
  eyebrow = "Operations",
  className,
  id,
}: PageHeaderProps) {
  return (
    <header className={cn("relative space-y-3", className)}>
      <div className="flex items-center gap-3">
        <span
          className="h-1 w-10 shrink-0 rounded-full bg-linear-to-r from-primary/40 to-primary"
          aria-hidden
        />
        <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground/90">
          {eyebrow}
        </p>
      </div>
      <h1
        id={id}
        className="text-balance text-3xl font-semibold tracking-tight text-foreground sm:text-[2rem] sm:leading-tight"
      >
        {title}
      </h1>
      <p className="max-w-2xl text-pretty text-sm leading-relaxed text-muted-foreground">
        {description}
      </p>
    </header>
  )
}
