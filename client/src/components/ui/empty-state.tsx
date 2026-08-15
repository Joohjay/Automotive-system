import type { LucideIcon } from 'lucide-react'

export function EmptyState({
  icon: Icon,
  title,
  description,
  action,
}: {
  icon?: LucideIcon
  title: string
  description?: string
  action?: React.ReactNode
}) {
  return (
    <div className="flex flex-col items-center justify-center gap-2 py-16 text-center">
      {Icon ? (
        <div className="bg-muted flex size-12 items-center justify-center rounded-full">
          <Icon className="text-muted-foreground size-6" />
        </div>
      ) : null}
      <h3 className="text-base font-semibold">{title}</h3>
      {description ? <p className="text-muted-foreground max-w-sm text-sm">{description}</p> : null}
      {action ? <div className="mt-2">{action}</div> : null}
    </div>
  )
}